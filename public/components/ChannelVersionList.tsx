import * as React from 'react';

import AkBanner from '@atlaskit/banner';
import AkButton from '@atlaskit/button';
import AkModalDialog from '@atlaskit/modal-dialog';
import AkSpinner from '@atlaskit/spinner';
import AkTabs from '@atlaskit/tabs';
import DownloadIcon from '@atlaskit/icon/glyph/download';
import WarningIcon from '@atlaskit/icon/glyph/warning';

import * as styles from './ChannelVersionList.scss';

export interface ChannelVersionListProps {
  app: NucleusApp;
  channel: NucleusChannel;
  baseUpdateUrl: string;
  updateApps: (showLoading: boolean) => Promise<void>;
}

interface PossiblePreReleaseVersion {
  version: NucleusVersion;
  isPreRelease: boolean;
  preReleaseId: number | null;
  preReleaseDate: string | null;
}

interface ChannelVersionListState {
  loading: boolean;
  temporaryVersions: ITemporarySave[];
  modalVersion: PossiblePreReleaseVersion | null;
  modalOpen: boolean;
  releasing: boolean;
}

export default class ChannelVersionList extends React.PureComponent<ChannelVersionListProps, ChannelVersionListState> {
  state = {
    loading: true,
    temporaryVersions: [],
    modalVersion: null as (PossiblePreReleaseVersion | null),
    modalOpen: false,
    releasing: false,
  };

  componentDidMount() {
    this.fetch();
  }

  componentDidUpdate(prevProps: ChannelVersionListProps) {
    if (prevProps.app.id !== this.props.app.id || prevProps.channel.id !== this.props.channel.id) {
      this.fetch();
    }
  }

  private fetch = async () => {
    this.setState({
      loading: true,
      temporaryVersions: [],
    });
    const resp = await fetch(`/rest/app/${this.props.app.id}/channel/${this.props.channel.id}/temporary_releases`, {
      credentials: 'include',
    });
    this.setState({
      loading: false,
      temporaryVersions: await resp.json(),
    });
  }

  showVersionModal = (version: NucleusVersion, isPreRelease = false, preReleaseId = null, preReleaseDate = null) => () => {
    this.setState({
      modalVersion: {
        version,
        isPreRelease,
        preReleaseId,
        preReleaseDate,
      },
      modalOpen: true,
    });
  }

  remapDraft(draftVersion: ITemporarySave) {
    const ret: NucleusVersion = {
      name: draftVersion.version,
      dead: false,
      files: draftVersion.filenames.map(fileName => ({
        fileName,
        arch: draftVersion.arch,
        platform: draftVersion.platform,
        type: 'unknown' as FileType,
      })),
    };
    return ret;
  }

  showDraftVersionModal = (draftVersion: ITemporarySave) => {
    return this.showVersionModal(this.remapDraft(draftVersion), true, draftVersion.id, draftVersion.date);
  }

  closeModal = () => {
    if (this.state.releasing) return;
    this.setState({
      modalOpen: false,
    });
  }

  getTabs = () => {
    return [{
      defaultSelected: true,
      label: 'Released',
      content: (
        <div style={{ width: '100%' }}>
          {
            this.props.channel.versions.length === 0
            ? <h5>No Released Versions</h5>
            : (
              this.props.channel.versions.map((version, index) => (
                <div key={index} className={styles.versionSelect} onClick={this.showVersionModal(version)}>
                  {version.name}
                </div>
              ))
            )
          }
        </div>
      ),
    }, {
      label: 'Draft',
      content: (
        <div style={{ width: '100%' }}>
          {
            this.state.temporaryVersions.length === 0
            ? <h5>No Draft Versions</h5>
            : (
              this.state.temporaryVersions.map((version, index) => (
                <div key={index} className={styles.versionSelect} onClick={this.showDraftVersionModal(version)}>
                  {version.version}
                </div>
              ))
            )
          }
        </div>
      ),
    }];
  }

  private fileExt(fileName) {
    const arr = fileName.split('.');
    return arr[arr.length - 1];
  }

  private download = file => () => {
    let downloadURL = `${this.props.baseUpdateUrl}/${this.props.app.slug}/${this.props.channel.id}/${file.platform}/${file.arch}/${file.fileName}`;
    if (this.state.modalVersion && this.state.modalVersion.isPreRelease) {
      downloadURL = `/rest/app/${this.props.app.id}/channel/${this.props.channel.id}/temporary_releases/${this.state.modalVersion.preReleaseId}/${file.fileName}`;
    }
    const aTag = document.createElement('a');
    aTag.href = downloadURL;
    aTag.download = 'true';
    aTag.click();
  }

  private release = async () => {
    if (this.state.modalVersion && this.state.modalVersion.isPreRelease) {
      if (!confirm('Are you sure you want to release this pre-release?')) return;
      this.setState({
        releasing: true,
      });
      const response = await fetch(`/rest/app/${this.props.app.id}/channel/${this.props.channel.id}/temporary_releases/${this.state.modalVersion.preReleaseId}/release`, {
        credentials: 'include',
        method: 'POST',
      });
      await this.fetch();
      await this.props.updateApps(false);
      this.setState({
        releasing: false,
        modalOpen: false,
      });
    }
  }

  private delete = async () => {
    if (this.state.modalVersion && this.state.modalVersion.isPreRelease) {
      if (!confirm('Are you sure you want to delete this pre-release?')) return;
      this.setState({
        releasing: true,
      });
      const response = await fetch(`/rest/app/${this.props.app.id}/channel/${this.props.channel.id}/temporary_releases/${this.state.modalVersion.preReleaseId}/delete`, {
        credentials: 'include',
        method: 'POST',
      });
      await this.fetch();
      this.setState({
        releasing: false,
        modalOpen: false,
      });
    }
  }

  render() {
    if (this.state.loading) {
      return <AkSpinner size={40} />;
    }
    return (
      <div style={{ width: '100%' }}>
        <AkTabs
          tabs={this.getTabs()}
        />
        {
          this.state.modalVersion
          ? (
            <AkModalDialog
              header={<h4 style={{ marginBottom: 0 }}>Version: {this.state.modalVersion.version.name}</h4>}
              footer={<div style={{ textAlign: 'right' }}>
                <AkButton appearance="primary" onClick={this.closeModal} isDisabled={this.state.releasing}>Done</AkButton>
                { this.state.modalVersion.isPreRelease ? <div style={{ marginRight: 8, display: 'inline-block' }} /> : null }
                { this.state.modalVersion.isPreRelease ? <AkButton appearance="primary" onClick={this.release} isDisabled={this.state.releasing}>Release</AkButton> : null }
                { this.state.modalVersion.isPreRelease ? <div style={{ marginRight: 8, display: 'inline-block' }} /> : null }
                { this.state.modalVersion.isPreRelease ? <AkButton appearance="danger" onClick={this.delete} isDisabled={this.state.releasing}>Delete</AkButton> : null }
              </div>}
              isOpen={this.state.modalOpen}
              onDialogDismissed={this.closeModal}
            >
              {
                this.state.modalVersion.isPreRelease
                ? (
                  <AkBanner icon={<WarningIcon label="Warning" />} isOpen>
                    This is a set of pre-release files, click Publish to make them public
                  </AkBanner>
                ) : null
              }
              {
                this.state.modalVersion.isPreRelease
                ? (
                  <p>
                    Uploaded: {this.state.modalVersion.preReleaseDate}
                  </p>
                ) : null
              }
              {
                this.state.modalVersion.version.files.map((file, index) => (
                  <div key={index} className={styles.fileDownloadContainer} onClick={this.download(file)}>
                    <div className={styles.fileDownload}>
                      <div className={styles.fileName}>
                        <DownloadIcon label="Download" />
                        <div>{file.fileName}</div>
                      </div>
                      <div className={styles.fileInfo}>
                        <span>Arch: {file.arch}</span>
                        <span>Platform: {file.platform}</span>
                        <span>Ext: {this.fileExt(file.fileName)}</span>
                      </div>
                    </div>
                  </div>
                ))
              }
            </AkModalDialog>
          )
          : null
        }
      </div>
    );
  }
}

const mapStateToProps = state => ({
  baseUpdateUrl: state.base,
});
