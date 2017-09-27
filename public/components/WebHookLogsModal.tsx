import * as React from 'react';
import { connect, Dispatch } from 'react-redux';

import AkButton from '@atlaskit/button';
import AkFieldBase, { Label as AkLabel } from '@atlaskit/field-base';
import AkFieldTextExported from '@atlaskit/field-text';
import AkModalDialog from '@atlaskit/modal-dialog';
import AkSpinner from '@atlaskit/spinner';

import { fetchApps, setApps } from '../actions/apps';

import * as styles from './WebHookLogsModal.scss';

/* tslint:disable */
const AkFieldText = AkFieldTextExported as any;
/* tslint:enable */

interface WebHookLogsModalProps {
  onDismiss: () => void;
  isOpen: boolean;
  hook: NucleusWebHook;
}

export default class WebHookLogsModal extends React.PureComponent<WebHookLogsModalProps, null> {
  close = () => {
    this.props.onDismiss();
  }

  render() {
    return (
      <AkModalDialog
        header={<h4 style={{ marginBottom: 0 }}>Logs: {this.props.hook ? this.props.hook.url : ''}</h4>}
        footer={<div style={{ textAlign: 'right' }}>
          <AkButton onClick={this.close}>Close</AkButton>
        </div>}
        isOpen={this.props.isOpen}
        onDialogDismissed={this.close}
      >
        {
          this.props.hook
          ? (
            <div className={styles.loaderWrapper}>
              {
                this.props.hook.errors.length > 0
                ? (
                  this.props.hook.errors
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors)
                    .concat(this.props.hook.errors).map(error => (
                    <pre className={styles.error}>
                      Message:       {error.message}{'\n'}
                      Response Code: {error.responseCode}{'\n'}
                      Response Body: {error.responseBody}
                    </pre>
                  ))
                ) : (
                  <p>No Logs</p>
                )
              }
            </div>
          ) : null
        }
      </AkModalDialog>
    );
  }
}
