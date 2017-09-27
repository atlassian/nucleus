import * as React from 'react';

import AkSpinner from '@atlaskit/spinner';

import * as styles from './PageLoader.scss';

export default class PageLoader extends React.PureComponent<{ visible: boolean }, {}> {
  render() {
    return (
      <div className={`${styles.spinnerContainer} ${this.props.visible ? styles.visible : ''}`}>
        <AkSpinner size={80} />
      </div>
    );
  }
}
