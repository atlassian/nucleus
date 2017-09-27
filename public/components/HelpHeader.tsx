import * as React from 'react';

import AkInlineDialog from '@atlaskit/inline-dialog';
import QuestionIcon from '@atlaskit/icon/glyph/question-circle';

import * as styles from './HelpHeader.scss';

export interface HelpHeaderProps {
  help: React.ReactNode;
  title: string;
  position?: string;
}

export interface HelpHeaderState {
  helpOpen: boolean;
}

export default class HelpHeader extends React.PureComponent<HelpHeaderProps, HelpHeaderState> {
  state = {
    helpOpen: false,
  };

  closeHelp = () => this.setState({
    helpOpen: false,
  })

  toggleHelp = () => this.setState({
    helpOpen: !this.state.helpOpen,
  })

  render() {
    return (
      <div className={styles.helpContainer}>
        <h4 className={styles.title}>{this.props.title}</h4>
        <AkInlineDialog
          content={
            <div style={{ maxWidth: 280 }}>
              {this.props.help}
            </div>
          }
          position={this.props.position || 'right middle'}
          isOpen={this.state.helpOpen}
          onClose={this.closeHelp}
          shouldFlip
        >
          <span style={{ cursor: 'pointer', display: 'flex' }} onClick={this.toggleHelp}>
            <QuestionIcon label="Info" size="small" />
          </span>
        </AkInlineDialog>
      </div>
    );
  }
}
