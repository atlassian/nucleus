import * as React from 'react';
import { connect } from 'react-redux';

import AkButton from '@atlaskit/button';
import AkFieldBase, { Label as AkLabel } from '@atlaskit/field-base';
import AkFieldTextExported from '@atlaskit/field-text';
import AkModalDialog from '@atlaskit/modal-dialog';
import AkSpinner from '@atlaskit/spinner';

import * as styles from './UploadBuildModal.scss';

/* tslint:disable */
const AkFieldText = AkFieldTextExported as any;
/* tslint:enable */

interface UploadBuildModalReduxProps {
  app: NucleusApp;
  channel: NucleusChannel;
  hasPendingMigration: boolean;
}

interface UploadBuildModalReduxDispatchProps {
  setApps: (channel: NucleusChannel) => any;
}

interface UploadBuildModalComponentProps {
  onDismiss: () => void;
  fetchVersions: () => void;
  isOpen: boolean;
}

class UploadBuildModal extends React.PureComponent<
  UploadBuildModalComponentProps &
    UploadBuildModalReduxDispatchProps &
    UploadBuildModalReduxProps,
  {
    platform: string;
    arch: string;
    version: string;
    creating: boolean;
    platformInvalid: boolean;
    archInvalid: boolean;
    versionInvalid: boolean;
    fileInvalid: boolean;
  }
> {
  private fileInput: HTMLInputElement;
  state = {
    platform: '',
    arch: '',
    version: '',
    creating: false,
    platformInvalid: false,
    archInvalid: false,
    versionInvalid: false,
    fileInvalid: false
  };

  close = () => {
    if (this.state.creating) return;
    this.props.onDismiss();
    this.setState({
      platform: '',
      arch: '',
      version: '',
      creating: false,
      platformInvalid: false,
      archInvalid: false,
      versionInvalid: false,
      fileInvalid: false
    });
  };

  create = async () => {
    const fileInvalid =
      !this.fileInput.value ||
      !this.fileInput.files.length ||
      !this.fileInput.files[0];
    const platformInvalid = !this.state.platform;
    const archInvalid = !this.state.arch;
    const versionInvalid = !this.state.version;
    this.setState({
      platformInvalid,
      archInvalid,
      versionInvalid,
      fileInvalid
    });
    if (!platformInvalid && !archInvalid && !versionInvalid && !fileInvalid) {
      this.setState({
        creating: true
      });
      const form = new FormData();
      form.append('platform', this.state.platform);
      form.append('arch', this.state.arch);
      form.append('version', this.state.version);
      form.append('files', this.fileInput.files[0]);
      const response = await fetch(
        `/rest/app/${this.props.app.id}/channel/${
          this.props.channel.id
        }/upload`,
        {
          headers: {
            Authorization: '4cd3c006c222f3af527a42925853302a'
          },
          credentials: 'include',
          method: 'POST',
          body: form
        }
      );
      if (response.status !== 200) {
        if (response.status !== 400) return this.props.onDismiss();
        alert((await response.json()).error);
        this.props.onDismiss();
      }
      this.props.fetchVersions();
      this.setState({
        creating: false
      });
      this.props.onDismiss();
    }
  };

  private platformChange = e => {
    this.setState({
      platform: e.target.value
    });
  };

  private archChange = e => {
    this.setState({
      arch: e.target.value
    });
  };
  private versionChange = e => {
    this.setState({
      version: e.target.value
    });
  };

  private refFile = input => {
    this.fileInput = input;
  };

  render() {
    return (
      <AkModalDialog
        header={<h4 style={{ marginBottom: 0 }}>Upload new Build</h4>}
        footer={
          <div style={{ textAlign: 'right' }}>
            <AkButton onClick={this.close} isDisabled={this.state.creating}>
              Cancel
            </AkButton>
            <div style={{ marginRight: 8, display: 'inline-block' }} />
            <AkButton
              appearance="primary"
              onClick={this.create}
              isDisabled={this.state.creating || this.props.hasPendingMigration}
            >
              Create
            </AkButton>
          </div>
        }
        isOpen={this.props.isOpen}
        onDialogDismissed={this.close}
      >
        <div className={styles.loaderWrapper}>
          {this.state.creating ? (
            <div className={styles.loader}>
              <AkSpinner />
            </div>
          ) : null}
          <AkFieldText
            placeholder="E.g. 'darwin', 'win32' or 'linux'"
            label="Platform"
            value={this.state.platform}
            onChange={this.platformChange}
            shouldFitContainer
            isInvalid={this.state.platformInvalid}
            required
          />
          <AkFieldText
            placeholder="E.g. 'ia32' or 'x64'"
            label="Architecture"
            value={this.state.arch}
            onChange={this.archChange}
            shouldFitContainer
            isInvalid={this.state.archInvalid}
            required
          />
          <AkFieldText
            placeholder="Semver.org format E.g. '1.0.0-beta', '1.0.0', '2.0.1'"
            label="Version"
            value={this.state.version}
            onChange={this.versionChange}
            shouldFitContainer
            isInvalid={this.state.versionInvalid}
            required
          />
          <div className={styles.file}>
            <AkLabel label="Build" isRequired isInvalid />
            <AkFieldBase
              shouldFitContainer
              isInvalid={this.state.fileInvalid}
              invalidMessage={
                this.state.fileInvalid ? 'This is not a valid Build file' : null
              }
            >
              <input ref={this.refFile} type="file" accept=".exe,.dmg" />
            </AkFieldBase>
          </div>
        </div>
      </AkModalDialog>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  hasPendingMigration: state.migrations.hasPendingMigration
});

export default connect<
  UploadBuildModalReduxProps,
  UploadBuildModalReduxDispatchProps,
  UploadBuildModalComponentProps
>(mapStateToProps)(UploadBuildModal);
