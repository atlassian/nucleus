import * as React from 'react';
import { withRouter, RouteComponentProps } from 'react-router';

import DropdownList, { Group, Item } from '@atlaskit/droplist';

class UserDropDown extends React.PureComponent<RouteComponentProps<void, void> & {
  user: User;
}, { open: boolean }> {
  constructor(props, context) {
    super(props, context);

    this.state = {
      open: false,
    };
  }

  private goToApps = () => {
    if (this.props.location.pathname !== '/apps') {
      this.props.history.push('/apps');
    }
    this.setState({
      open: false,
    });
  }

  private goToMigrations = () => {
    if (this.props.location.pathname !== '/migrations') {
      this.props.history.push('/migrations');
    }
    this.setState({
      open: false,
    });
  }

  private openChange = (attrs) => {
    this.setState({
      open: attrs.isOpen,
    });
  }

  private toggle = () => {
    this.setState({
      open: !this.state.open,
    });
  }

  render() {
    return (
      <DropdownList
        appearance="default"
        isOpen={this.state.open}
        isTriggerNotTabbable
        onOpenChange={this.openChange}
        position="right bottom"
        trigger={<div onClick={this.toggle}>{this.props.children}</div>}
      >
        <Group heading={this.props.user.displayName}>
          <Item onActivate={this.goToApps}>My Applications</Item>
          {
            this.props.user.isAdmin
            ? (
              <Item onActivate={this.goToMigrations}>Migrations</Item>
            ) : null
          }
          <Item href="/rest/auth/logout">Logout</Item>
        </Group>
      </DropdownList>
    );
  }
}

export default withRouter(UserDropDown);
