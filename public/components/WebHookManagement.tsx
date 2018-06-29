import * as React from 'react';

import AkButton from '@atlaskit/button';
import { FieldTextStateless } from '@atlaskit/field-text';
import AkSpinner from '@atlaskit/spinner';
import AkToolTip from '@atlaskit/tooltip';
import LockIcon from '@atlaskit/icon/glyph/lock';
import WarningIcon from '@atlaskit/icon/glyph/warning';

import WebHookLogsModal from './WebHookLogsModal';

import * as styles from './WebHookManagement.scss';

export interface WebHookManagementProps {
  app: NucleusApp;
  setApps: (apps: NucleusApp[]) => void;
  apps: NucleusApp[];
  hasPendingMigration: boolean;
}

export interface WebHookManagementState {
  creatingWebHook: boolean;
  deletingWebHooks: Set<number>;
  newWebHookURL: string;
  newWebHookSecret: string;
  showingLogsHook: boolean;
  showingLogsHookId: number | null;
}

export default class WebHookManagement extends React.PureComponent<WebHookManagementProps, WebHookManagementState> {
  state = {
    deletingWebHooks: new Set(),
    creatingWebHook: false,
    newWebHookURL: '',
    newWebHookSecret: '',
    showingLogsHook: false,
    showingLogsHookId: null,
  };

  private createWebHook = async () => {
    const { app } = this.props;
    if (!app) return;
    if (!this.state.newWebHookURL.match(/^https?:\/\/.+$/g)) {
      return alert('Invalid WebHook URL');
    }
    this.setState({
      creatingWebHook: true,
    });
    try {
      const { hook, success }: { hook: NucleusWebHook, success: boolean } = await (await fetch(
        `/rest/app/${app.id}/webhook`,
        {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            url: this.state.newWebHookURL,
            secret: this.state.newWebHookSecret,
          }),
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        },
      )).json();
      const newApp = Object.assign({}, app);
      newApp.webHooks.push(hook);
      this.props.setApps(this.props.apps.map((tApp) => {
        if (tApp.id !== newApp.id) return tApp;
        return newApp;
      }));
    } catch (err) {
      // Ignore
    } finally {
      this.setState({
        creatingWebHook: false,
        newWebHookURL: '',
      });
    }
  }

  private removeWebHook = (hook: NucleusWebHook) => async () => {
    const { app } = this.props;
    if (!app) return;
    if (this.state.deletingWebHooks.has(hook.id)) return;
    this.setState({
      deletingWebHooks: new Set(this.state.deletingWebHooks.add(hook.id)),
    });
    try {
      const { success, errors }: { success: boolean, errors: NucleusWebHookError[] } = await (await fetch(
        `/rest/app/${app.id}/webhook/${hook.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )).json();
      const newApp = Object.assign({}, app);
      if (success) {
        newApp.webHooks = newApp.webHooks.filter(tHook => tHook.id !== hook.id);
      } else {
        newApp.webHooks = newApp.webHooks.map((tHook) => {
          if (tHook.id !== hook.id) return tHook;
          tHook.errors = errors;
          return tHook;
        });
      }
      this.props.setApps(this.props.apps.map((tApp) => {
        if (tApp.id !== newApp.id) return tApp;
        return newApp;
      }));
    } catch (err) {
      // Ignore
    } finally {
      const newSet = new Set(this.state.deletingWebHooks);
      newSet.delete(hook.id);
      this.setState({
        deletingWebHooks: newSet,
      });
    }
  }

  private saveWebHookURL = (e) => {
    this.setState({
      newWebHookURL: e.target.value,
    });
  }

  private saveWebHookSecret = (e) => {
    this.setState({
      newWebHookSecret: e.target.value,
    });
  }

  private showWebHookLogs = (hook: NucleusWebHook) => () => {
    this.setState({
      showingLogsHook: true,
      showingLogsHookId: hook.id,
    });
  }

  private closeWebHookLogs = () => {
    this.setState({
      showingLogsHook: false,
    });
  }

  render() {
    const { app } = this.props;
    const logHook = app.webHooks.find(hook => hook.id === this.state.showingLogsHookId);
    return (
      <div className={styles.container}>
        <h4>WebHooks</h4>
        <WebHookLogsModal hook={logHook} isOpen={this.state.showingLogsHook} onDismiss={this.closeWebHookLogs} />
        <div className={styles.webHookList}>
          {
            app.webHooks.map((hook, index) => (
              <div className={styles.webHook} key={`hook-${index}-${hook.url}`}>
                {
                  !hook.registered
                  ? (
                    <AkToolTip description="Registration Failed" position="top">
                      <WarningIcon label="Warning" size="small" />
                    </AkToolTip>
                  ) : null
                }
                <span className={styles.url}>{hook.url}</span>
                <AkButton appearance="warning" onClick={this.showWebHookLogs(hook)}>Logs</AkButton>
                <AkButton appearance="danger" onClick={this.removeWebHook(hook)} isDisabled={this.props.hasPendingMigration}>
                  {
                    this.state.deletingWebHooks.has(hook.id)
                    ? (
                      <div className={styles.verticalSpinner}>
                        <AkSpinner invertColor size="small" />
                      </div>
                    ) : 'Remove'
                  }
                </AkButton>
              </div>
            ))
          }
        </div>
        <div className={styles.createWebHookContainer}>
          <div className={styles.createWebHookInput}>
            <FieldTextStateless onChange={this.saveWebHookURL} label="New Web Hook" placeholder="E.g. https://my.site.com/foo" value={this.state.newWebHookURL} />
            <FieldTextStateless onChange={this.saveWebHookSecret} label="Web Hook Secret" placeholder="MagicalCat24" value={this.state.newWebHookSecret} />
          </div>
          <div className={styles.createWebHookButton}>
            <AkButton appearance="primary" onClick={this.createWebHook} isDisabled={this.props.hasPendingMigration}>
            {
              this.state.creatingWebHook
              ? (
                <div className={styles.verticalSpinner}>
                  <AkSpinner invertColor size="small" />
                </div>
              ) : 'Create'
            }
            </AkButton>
          </div>
        </div>
      </div>
    );
  }
}
