import * as React from 'react';
import { connect } from 'react-redux';

import AkButton from '@atlaskit/button';
import AkSpinner from '@atlaskit/spinner';

import * as styles from './MigrationList.scss';

interface MigrationListReduxProps {
  migrations: MigrationSubState;
}
interface MigrationListReduxDispatchProps {
}
interface MigrationListComponentProps {}

interface MigrationListState {
  activeMigration: string;
  migrationItems: any[] | null;
  stopping: boolean;
}

class MigrationList extends React.PureComponent<MigrationListComponentProps & MigrationListReduxProps & MigrationListReduxDispatchProps, MigrationListState> {
  state: MigrationListState = {
    activeMigration: '',
    migrationItems: null,
    stopping: false,
  };

  get pending() {
    return this.props.migrations.items.filter(m => !m.complete);
  }

  get completed() {
    return this.props.migrations.items.filter(m => m.complete);
  }

  private runMigration = async () => {
    const done = () => {
      setTimeout(() => this.runMigration(), 0);
    };

    if (!this.state.activeMigration)  {
      this.setState({
        migrationItems: null,
        stopping: false,
      });
      return;
    }

    // Fetch all migration items
    if (this.state.migrationItems === null) {
      const response = await fetch(
        `/rest/migration/${this.state.activeMigration}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );
      if (response.status !== 200) {
        this.setState({
          activeMigration: '',
        }, done);
      }
      this.setState({
        migrationItems: await response.json(),
      }, done);
      return;
    }

    const item = this.state.migrationItems.find(item => !item.done);
    if (!item) {
      this.setState({
        activeMigration: '',
        migrationItems: null,
        stopping: false,
      }, () => {
        alert('Migration Complete');
        window.location.reload();
      });
      return;
    }
    const response = await fetch(
      `rest/migration/${this.state.activeMigration}`,
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          item,
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      },
    );
    item.done = response.status === 200;
    if (!item.done) {
      alert('Migration failed on an item, click start to try again');
      this.setState({
        activeMigration: '',
      }, done);
      return;
    }
    this.setState({
      migrationItems: [].concat(this.state.migrationItems),
    }, done);
  }

  private startMigration = (migration: NucleusMigration) => () => {
    this.setState({
      activeMigration: migration.key,
    }, () => {
      this.runMigration();
    });
  }

  private stopMigration = (migration: NucleusMigration) => () => {
    if (this.state.activeMigration !== migration.key) return;

    this.setState({
      activeMigration: '',
      stopping: true,
    });
  }

  private hasPendingDep = (migration: any) => {
    return (this.pending as any[]).find(m => migration.dependsOn.indexOf(m.key) !== -1);
  }

  private renderPendingMigration = (migration: NucleusMigration) => {
    const done = this.state.migrationItems ? this.state.migrationItems.filter(i => i.done).length : 0;
    const total = this.state.migrationItems ? this.state.migrationItems.length : 0;
    return (
      <div key={migration.key} className={styles.migrationContainer}>
        <div className={styles.migration}>
          <b>{migration.friendlyName}</b>
          {
            (migration as any).dependsOn.length > 0
            ? (
              <div><i>Depends On: {(migration as any).dependsOn.map(k => this.props.migrations.items.find(m => m.key === k)!.friendlyName).join(', ')}</i></div>
            ) : null
          }
          {
            this.state.migrationItems && this.state.activeMigration === migration.key
            ? (
              <div className={styles.migrationProgress}>
                <i>{done} / {total}</i>
                <div className={styles.migrationProgressWrapper}>
                  <div className={styles.migrationProgressInner} style={{ width: total === 0 ? '0%' : `${100 * (done / total)}%` }} />
                </div>
              </div>
            ) : null
          }
          <div className={styles.migrationActions}>
            <AkButton
              appearance="danger"
              onClick={this.stopMigration(migration)}
              isDisabled={this.state.activeMigration !== migration.key || this.state.stopping}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60 }}>
                {
                  this.state.stopping
                    ? <AkSpinner size={16} />
                    : 'Stop'
                }
              </div>
            </AkButton>
            <div style={{ width: 8 }} />
            <AkButton
              appearance="primary"
              onClick={this.startMigration(migration)}
              isDisabled={!!this.state.activeMigration || this.state.stopping || this.hasPendingDep(migration)}
            >
              Start
            </AkButton>
          </div>
        </div>
      </div>
    );
  }

  private renderCompletedMigration = (migration: NucleusMigration) => {
    return (
      <div key={migration.key} className={styles.migrationContainer}>
        <div className={styles.migration}>
          <b>{migration.friendlyName}</b>
        </div>
      </div>
    );
  }

  render() {
    const { pending, completed } = this;

    return (
      <div>
        <h3>Migrations</h3>
        <h4>Pending Migrations</h4>
        {
          pending.length > 0
          ? (
            pending.map(this.renderPendingMigration)
          ) : (
            <p>No migrations are currently pending</p>
          )
        }
        <h4>Completed Migrations</h4>
        {
          completed.length > 0
          ? (
            completed.map(this.renderCompletedMigration)
          ) : (
            <p>You have completed no migrations</p>
          )
        }
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  migrations: state.migrations,
});

export default connect<MigrationListReduxProps, MigrationListReduxDispatchProps, MigrationListComponentProps>(mapStateToProps, null)(MigrationList);
