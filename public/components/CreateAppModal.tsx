import * as React from 'react';
import { connect, Dispatch } from 'react-redux';

import AkButton from '@atlaskit/button';
import AkFieldBase, { Label as AkLabel } from '@atlaskit/field-base';
import AkFieldTextExported from '@atlaskit/field-text';
import AkModalDialog from '@atlaskit/modal-dialog';
import AkSpinner from '@atlaskit/spinner';

import { fetchApps, setApps } from '../actions/apps';

import * as styles from './CreateAppModal.scss';

/* tslint:disable */
const AkFieldText = AkFieldTextExported as any;
/* tslint:enable */

interface CreateAppModalReduxProps {
  hasPendingMigration: boolean;
}
interface CreateAppModalReduxDispatchProps {
  setApps: (apps: NucleusApp[]) => any;
}
interface CreateAppModalComponentProps {
  onDismiss: () => void;
  isOpen: boolean;
}

class CreateAppModal extends React.PureComponent<CreateAppModalComponentProps & CreateAppModalReduxDispatchProps & CreateAppModalReduxProps, {
  name: string
  creating: boolean;
  nameInvalid: boolean;
  fileInvalid: boolean;
}> {
  private fileInput: HTMLInputElement;
  state = {
    name: '',
    creating: false,
    nameInvalid: false,
    fileInvalid: false,
  };

  close = () => {
    if (this.state.creating) return;

    this.props.onDismiss();
    this.setState({
      name: '',
      nameInvalid: false,
      fileInvalid: false,
    });
  }

  private isPng = (file: File) => {
    return file.type === 'image/png';
  }

  create = async () => {
    const fileInvalid = !this.fileInput.value || !this.fileInput.files.length
      || !this.fileInput.files[0] || !this.isPng(this.fileInput.files[0]);
    const nameInvalid = !this.state.name;
    this.setState({
      fileInvalid,
      nameInvalid,
    });
    if (!nameInvalid && !fileInvalid) {
      this.setState({ 
        creating: true,
      });
      const form = new FormData();
      form.append('name', this.state.name);
      form.append('icon', this.fileInput.files[0]);
      const response = await fetch('/rest/app', {
        credentials: 'include',
        method: 'POST',
        body: form,
      });
      if (response.status !== 200) {
        if (response.status !== 400) return this.props.onDismiss();
        alert((await response.json()).error);
        this.props.onDismiss();
      }
      const app = await response.json();
      this.setState({
        creating: false,
      });
      this.props.setApps(app);
      this.props.onDismiss();
    }
  }

  private nameChange = (e) => {
    this.setState({
      name: e.target.value,
    });
  }

  private refFile = (input) => {
    this.fileInput = input;
  }

  render() {
    return (
      <AkModalDialog
        header={<h4 style={{ marginBottom: 0 }}>New Application</h4>}
        footer={<div style={{ textAlign: 'right' }}>
          <AkButton onClick={this.close} isDisabled={this.state.creating}>Cancel</AkButton>
          <div style={{ marginRight: 8, display: 'inline-block' }} />
          <AkButton appearance="primary" onClick={this.create} isDisabled={this.state.creating || this.props.hasPendingMigration}>Create</AkButton>
        </div>}
        isOpen={this.props.isOpen}
        onDialogDismissed={this.close}
      >
        <div className={styles.loaderWrapper}>
          {
            this.state.creating
            ? <div className={styles.loader}><AkSpinner /></div>
            : null
          }
          <AkFieldText
            placeholder="E.g. Banana"
            label="Application Name"
            value={this.state.name}
            onChange={this.nameChange}
            shouldFitContainer
            isInvalid={this.state.nameInvalid}
            required
          />
          <div className={styles.file}>
            <AkLabel label="Icon" isRequired isInvalid />
            <AkFieldBase
              shouldFitContainer
              isInvalid={this.state.fileInvalid}
              invalidMessage={this.state.fileInvalid ? 'This is not a valid PNG icon file' : null}
            >
              <input ref={this.refFile} type="file" accept=".png" />
            </AkFieldBase>
          </div>
        </div>
      </AkModalDialog>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  hasPendingMigration: state.migrations.hasPendingMigration,
});

const mapDispatchToProps = (dispatch: Dispatch<void>) => ({
  setApps: (apps: NucleusApp[]) => dispatch(setApps(apps)),
});

export default connect<CreateAppModalReduxProps, CreateAppModalReduxDispatchProps, CreateAppModalComponentProps>(mapStateToProps, mapDispatchToProps)(CreateAppModal);
