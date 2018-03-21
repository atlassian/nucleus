import * as React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router';

import * as styles from './AppCard.scss';
import * as favicon from '../favicon.png';

export interface AppCardReduxProps {
  baseUpdateUrl: string;
}

export interface AppCardDispatchProps {}

export interface AppCardComponentProps {
  app: NucleusApp;
}

class AppCard extends React.PureComponent<AppCardReduxProps & AppCardComponentProps, null> {
  private badImage = (e) => {
    e.currentTarget.src = favicon;
  }

  render() {
    return (
      <div className={styles.appContainer}>
        <Link to={`/apps/${this.props.app.slug}`}>
          <div className={styles.app}>
            <div className={styles.imgContainer}>
              <img src={`${this.props.baseUpdateUrl}/${this.props.app.slug}/icon.png`} onError={this.badImage} />
            </div>
            <h4>{this.props.app.name}</h4>
          </div>
        </Link>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  baseUpdateUrl: state.base,
});

export default connect<AppCardReduxProps, AppCardDispatchProps, AppCardComponentProps>(mapStateToProps, null)(AppCard);
