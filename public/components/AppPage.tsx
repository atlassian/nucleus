import * as React from 'react';
import { connect, Dispatch } from 'react-redux';
import { UploadField } from '@navjobs/upload';

import AkButton from '@atlaskit/button';
import AkFieldBase, { Label as AkLabel } from '@atlaskit/field-base';
import AkFieldText from '@atlaskit/field-text';
import { MultiSelectStateless as AkMultiSelect } from '@atlaskit/multi-select';
import AkTabs from '@atlaskit/tabs';

import ChannelVersionList from './ChannelVersionList';
import HelpHeader from './HelpHeader';
import Highlight from './Highlight';
import PageLoader from './PageLoader';
import WebHookManagement from './WebHookManagement';

import { fetchApps, setApps } from '../actions/apps';

import * as styles from './AppPage.scss';

import 'highlight.js/styles/vs.css';

interface AppPageReduxProps {
  apps: AppsSubState;
  baseUpdateUrl: string;
  user: User;
  hasPendingMigration: boolean;
}
interface AppPageReduxDispatchProps {
  setApps: (apps: NucleusApp[]) => any;
}
interface AppPageComponentProps {}
interface AppPageState {
  loading: boolean;
  resetting: boolean;
  newChannelName: string;
  isTeamListOpen: boolean;
  teamFilterValue: string;
  teamUpdating: boolean;
  multiDraw: number;
}

class AppPage extends React.PureComponent<AppPageReduxProps & AppPageReduxDispatchProps & AppPageComponentProps, AppPageState> {
  props: AppPageReduxProps & AppPageReduxDispatchProps & AppPageComponentProps & {
    routeParams: {
      appSlug: string;
    },
  };
  state = {
    loading: false,
    resetting: false,
    newChannelName: '',
    isTeamListOpen: false,
    teamFilterValue: '',
    teamUpdating: false,
    multiDraw: 1,
  };

  componentDidMount() {
    if (!this.props.apps) {
      this.fetchApps();
    }
  }

  private handleOpenChange = ({ isOpen }) => {
    this.setState({
      isTeamListOpen: isOpen,
    });
  }

  private updateFilterValue = (teamFilterValue) => {
    this.setState({
      teamFilterValue,
    });
  }

  private donePersistingTeam = () => {
    this.setState({
      teamFilterValue: '',
      teamUpdating: false,
      multiDraw: this.state.multiDraw + 1,
    });
  }

  private persistTeam = async (tmpTeam) => {
    this.setState({
      isTeamListOpen: false,
      teamUpdating: true,
    });

    const response = await fetch(
      `/rest/app/${this.getApp().id}/team`,
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          team: JSON.stringify(tmpTeam.filter((a, index) => tmpTeam.indexOf(a) === index)),
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      },
    );
    if (response.status !== 200) {
      this.props.setApps(this.props.apps.map(app => Object.assign({}, app)));
      this.donePersistingTeam();
      return;
    }
    const newApp = await response.json();
    this.props.setApps(this.props.apps.map((tApp) => {
      if (tApp.id !== newApp.id) return tApp;
      return newApp;
    }));
    this.donePersistingTeam();
  }

  private handleTeamAdd = async (item) => {
    const app = this.getApp();
    const tmpTeam = [].concat(app.team);
    tmpTeam.push(item.value);
    await this.persistTeam(tmpTeam);
  }

  private handleTeamRemove = async (item) => {
    const app = this.getApp();
    const tmpTeam = [].concat(app.team).filter(a => a !== item.content);
    await this.persistTeam(tmpTeam);
  }

  private saveChannelName = (e) => {
    this.setState({
      newChannelName: e.target.value,
    });
  }

  private fetchApps = async (showLoading = true) => {
    if (showLoading) {
      this.setState({
        loading: true,
      });
    }
    this.props.setApps(await fetchApps());
    this.setState({
      loading: false,
    });
  }

  createChannel = async () => {
    const app = this.getApp();
    if (!app) return;
    this.setState({
      loading: true,
    });
    try {
      const newChannel = await (await fetch(
        `/rest/app/${app.id}/channel`,
        {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            name: this.state.newChannelName,
          }),
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        },
      )).json();
      const newApp = Object.assign({}, app);
      newApp.channels.push(newChannel);
      this.props.setApps(this.props.apps.map((tApp) => {
        if (tApp.id !== newApp.id) return tApp;
        return newApp;
      }));
    } catch (err) {
      // Ignore
    } finally {
      this.setState({
        loading: false,
      });
    }
  }

  getApp() {
    if (!this.props.apps) return null;
    return this.props.apps.find(app => app.slug === this.props.routeParams.appSlug);
  }

  getTabs() {
    const app = this.getApp();
    const channels = app.channels.sort((a, b) => {
      return a.name.localeCompare(b.name);
    }).map((channel, index) => {
      return {
        defaultSelected: index === 0,
        label: channel.name,
        content: (
          <div className={styles.tab}>
            <h5>Versions</h5>
            <div className={styles.codeCard}>
              <ChannelVersionList
                app={app}
                channel={channel}
                baseUpdateUrl={this.props.baseUpdateUrl}
                updateApps={this.fetchApps}
                hasPendingMigration={this.props.hasPendingMigration}
              />
            </div>
            <h5>Updater Usage</h5>
            <div className={styles.codeCard}>
              <Highlight className="javascript">
{`import { app, autoUpdater } from 'electron';

const DOMAIN = '${this.props.baseUpdateUrl}';
const suffix = process.platform === 'darwin' ? \`/RELEASES.json?method=JSON&version=$\{app.getVersion()\}\` : '';
autoUpdater.setFeedURL({
  url: \`$\{DOMAIN\}/${app.slug}/${channel.id}/$\{process.platform\}/$\{process.arch\}$\{suffix\}\`,
  serverType: 'json',
});`}
              </Highlight>
            </div>
            <h5>Publisher Usage (Electron Forge >= 6)</h5>
            <div className={styles.codeCard}>
              <Highlight className="javascript">
{`const forgeConfig = {
  // More config
  publishers: [
    {
      name: '@electron-forge/publisher-nucleus',
      config: {
        host: '${window.location.protocol}//${window.location.host}',
        appId: '${app.id}',
        channelId: '${channel.id}',
        token: process.env.NUCLEUS_TOKEN // This should be set securely
      }
    }
  ]
  // More config
};`}
              </Highlight>
            </div>
            <h5>Latest Release Download</h5>
            <div className={styles.codeCard} style={{ fontSize: 14, fontFamily: '"SFMono-Medium", "SF Mono", "Segoe UI Mono", "Roboto Mono", "Ubuntu Mono", Menlo, Courier, monospace' }}>
              <p>The latest release in this channel which is set to 100% rollout will be available at:</p>
              <p>{`${this.props.baseUpdateUrl}/${app.slug}/${channel.id}/latest/{platform}/{arch}/${app.name}.{extension}`}</p>
              <br />
              <p>For example, your .EXE installer</p>
              <p>{`${this.props.baseUpdateUrl}/${app.slug}/${channel.id}/latest/win32/x64/${app.name}.exe`}</p>
            </div>
            <h5>Yum Repo Usage</h5>
            <div className={styles.codeCard}>
              <Highlight className="bash">
{`wget "${this.props.baseUpdateUrl}/${app.slug}/${channel.id}/linux/${app.slug}.repo"
sudo mv "${app.slug}.repo" "/etc/yum.repos.d/${app.slug}.repo"
rpm --import ${this.props.baseUpdateUrl}/public.key
yum install <package-name>`}
              </Highlight>
            </div>
            <h5>Apt Repo Usage</h5>
            <div className={styles.codeCard}>
              <Highlight className="bash">
{`sudo sh -c 'echo "deb \"${this.props.baseUpdateUrl}/${app.slug}/${channel.id}/linux/debian/\" binary/" > /etc/apt/sources.list.d/${app.slug}.list'
wget -O - ${this.props.baseUpdateUrl}/public.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install <package-name>`}
              </Highlight>
            </div>
          </div>
        ),
      };
    });
    return channels.concat({
      label: '+ New',
      content: (
        <div style={{ flex: 1 }}>
          <AkFieldText label="Name" placeholder="E.g. Stable" shouldFitContainer required onChange={this.saveChannelName} />
          <div style={{ height: 8 }} />
          <AkButton appearance="primary" onClick={this.createChannel} isDisabled={this.props.hasPendingMigration}>Create</AkButton>
        </div>
      ),
      defaultSelected: channels.length === 0,
    });
  }

  resetToken = async () => {
    const app = this.getApp();
    if (!app) return;
    if (!confirm('Are you sure? Resetting the token will break any existing upload configs in builds!!')) return;
    this.setState({
      resetting: true,
    });
    const newApp = await (await fetch(`/rest/app/${app.id}/refresh_token`, {
      credentials: 'include',
      method: 'POST',
    })).json();
    this.props.setApps(this.props.apps.map((tApp) => {
      if (tApp.id !== newApp.id) return tApp;
      return newApp;
    }));
    this.setState({
      resetting: false,
    });
  }

  private onNewIcon = async (files: FileList) => {
    const app = this.getApp();
    if (app && files && files.length &&
        files[0] && files[0].type === 'image/png') {
      const form = new FormData();
      form.append('icon', files[0]);
      await fetch(`/rest/app/${app.id}/icon`, {
        credentials: 'include',
        method: 'POST',
        body: form,
      });
      (document.querySelector('#app-logo') as HTMLImageElement).src += '?bump';
      alert('Although the image has been uploaded, please be aware that on ' +
        'some Nucleus configuration the image may not update for 15-30 ' +
        'minutes due to the use of a CDN');
    }
    (document.querySelector(`.${styles.img} input[type="file"]`) as HTMLInputElement).value = '';
  }

  render() {
    const app = this.getApp();

    return (
      <div>
        <PageLoader visible={this.state.loading} />
        {
          !this.state.loading && this.props.apps ? 
          (
            app
            ? <div>
              <h3 style={{ marginBottom: 8 }}>{app.name}</h3>
              <div style={{ display: 'flex' }}>
                <div className={styles.tokenContainer}>
                  <HelpHeader
                    title="API Token"
                    help={
                      <p>
                        This is the API token to use in the code examples provided in the Channel's
                        section.  Make sure you don't share with anyone or hard code this value
                        into Version Control.
                      </p>
                    }
                    position="right top"
                  />
                  <AkFieldBase isLoading={this.state.resetting} isReadyOnly shouldFitContainer>
                    <input className={styles.token} type="text" defaultValue={app.token} disabled />
                  </AkFieldBase>
                  <div style={{ height: 8 }} />
                  <AkButton appearance="danger" onClick={this.resetToken} isDisabled={this.props.hasPendingMigration}>Reset Token</AkButton>
                </div>
                <div className={styles.iconContainer}>
                  <UploadField
                    onFiles={this.onNewIcon}
                    containerProps={{
                      className: styles.img,
                    }}
                    uploadProps={{
                      accept: '.png',
                    }}
                  >
                    <img id="app-logo" src={`${this.props.baseUpdateUrl}/${app.slug}/icon.png`} />
                    <div className={styles.after}>Change Icon</div>
                  </UploadField>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <h4>Channels</h4>
                <AkTabs
                  tabs={this.getTabs()}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <HelpHeader
                  title="Team"
                  help={
                    <div>
                      <p>This list should contain user identifiers for members of your team.</p>
                      <p>Anyone in this list will have permissions to view this app and make changes to it's Nucleus configuration.</p>
                      <p>For reference your identifier is <b>"{this.props.user.id}"</b></p>
                    </div>
                  }
                />
                <AkMultiSelect
                  key={this.state.multiDraw}
                  createNewItemLabel="Add Team Member"
                  selectedItems={app.team.map(member => ({
                    content: member,
                  })).sort()}
                  label="Team Members"
                  shouldFitContainer
                  shouldAllowCreateItem
                  filterValue={this.state.teamFilterValue}
                  isOpen={this.state.isTeamListOpen}
                  onFilterChange={this.updateFilterValue}
                  onOpenChange={this.handleOpenChange}
                  onNewItemCreated={this.handleTeamAdd}
                  onRemoved={this.handleTeamRemove}
                  isDisabled={this.state.teamUpdating || this.props.hasPendingMigration}
                />
              </div>
              <WebHookManagement
                app={app}
                apps={this.props.apps}
                setApps={this.props.setApps}
                hasPendingMigration={this.props.hasPendingMigration}
              />
            </div>
            : (
              <div className={styles.notFound}>
                <h1>404</h1>
                <h3>App Not Found</h3>
              </div>
            )
          )
          : null
        }
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  apps: state.apps,
  baseUpdateUrl: state.base,
  user: state.user.user,
  hasPendingMigration: state.migrations.hasPendingMigration,
});

const mapDispatchToProps = (dispatch: Dispatch<void>) => ({
  setApps: (apps: NucleusApp[]) => dispatch(setApps(apps)),
});

export default connect<AppPageReduxProps, AppPageReduxDispatchProps, AppPageComponentProps>(mapStateToProps, mapDispatchToProps)(AppPage);
