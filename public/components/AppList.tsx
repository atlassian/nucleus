import * as React from 'react';
import { connect, Dispatch } from 'react-redux';

import AppCard from './AppCard';
import PageLoader from './PageLoader';

import { fetchApps, setApps } from '../actions/apps';

import * as styles from './AppList.scss';

interface AppListReduxProps {
  apps: AppsSubState;
}
interface AppListReduxDispatchProps {
  setApps: (apps: NucleusApp[]) => any;
}
interface AppListComponentProps {}

class AppList extends React.PureComponent<AppListComponentProps & AppListReduxProps & AppListReduxDispatchProps, { loading: boolean }> {
  state = { loading: false };

  componentDidMount() {
    if (!this.props.apps) {
      this.fetchApps();
    }
  }

  async fetchApps() {
    this.setState({
      loading: true,
    });
    this.props.setApps(await fetchApps());
    this.setState({
      loading: false,
    });
  }

  render() {
    return (
      <div>
        <h3>Applications</h3>
        <PageLoader visible={this.state.loading} />
        {
          !this.state.loading && this.props.apps
          ? (
            this.props.apps.length > 0
            ? (
              this.props.apps.map((app) => {
                return (
                  <AppCard app={app} key={app.id} />
                );
              })
            ) : (
              <div className={styles.noApps}>
                <h3>You don't have access to any Applications yet</h3>
                <h5>Make your own using the Create button in the sidebar, or ask one of your teammates to give you access</h5>
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
});

const mapDispatchToProps = (dispatch: Dispatch<void>) => ({
  setApps: (apps: NucleusApp[]) => dispatch(setApps(apps)),
});

export default connect<AppListReduxProps, AppListReduxDispatchProps, AppListComponentProps>(mapStateToProps, mapDispatchToProps)(AppList);
