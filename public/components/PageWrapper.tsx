import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, Link } from 'react-router';
import AkAvatar from '@atlaskit/avatar';
import AddIcon from '@atlaskit/icon/glyph/add';
import AkNavigation, { AkContainerTitle, AkNavigationItemGroup, AkNavigationItem, AkGlobalItem } from '@atlaskit/navigation';

import CreateAppModal from './CreateAppModal';
import UserDropDown from './UserDropDown';
import Logo from '../assets/Logo';

import * as styles from './PageWrapper.scss';

/* tslint:disable */
const LinkWrapper = (props) => <Link {...props} to={props.href} />;
/* tslint:enable */

interface PageWrapperReduxProps {
  user: UserSubState;
}
interface PageWrapperComponentProps {}

class PageWrapper extends React.PureComponent<PageWrapperReduxProps & PageWrapperComponentProps & RouteComponentProps<void, void>, {
  creatingApp: boolean,
}> {
  state = {
    creatingApp: false,
  };

  private toggleCreate = () => {
    this.setState({
      creatingApp: !this.state.creatingApp,
    });
  }

  signedInSecondaryActions() {
    const photoUrl = (this.props.user.user.photos && this.props.user.user.photos.length > 0) ? this.props.user.user.photos[0].value : '';
    return [
      <UserDropDown user={this.props.user.user}>
        <AkGlobalItem size="small"><AkAvatar size="small" src={photoUrl} /></AkGlobalItem>
      </UserDropDown>,
    ];
  }

  signedOutSecondaryActions() {
    return [<AkGlobalItem size="small" href="/rest/auth/login"><AkAvatar size="small" /></AkGlobalItem>];
  }

  render() {
    const isSignedIn = this.props.user.signedIn;
    const navProps = isSignedIn ? () => ({
      globalSecondaryActions: this.signedInSecondaryActions(),
    }) : () => ({
      globalSecondaryActions: this.signedOutSecondaryActions(),
    });
    const isAdmin = this.props.user.signedIn ? this.props.user.user.isAdmin : false;
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.navContainer}>
          <AkNavigation
            globalPrimaryIcon={<Logo />}
            globalPrimaryItemHref="/apps"
            isResizeable={false}
            globalCreateIcon={<AddIcon label="Add App" />}
            onCreateDrawerOpen={this.toggleCreate}
            {...navProps()}
          >
            <AkContainerTitle text={`Applications`} subText="Powered by Nucleus" />
            <AkNavigationItemGroup title="My Apps">
              <AkNavigationItem text="View" linkComponent={LinkWrapper} href="/apps" />
            </AkNavigationItemGroup>
          </AkNavigation>
        </div>
        <div className={styles.pageContainer}>{this.props.children}</div>
        <CreateAppModal onDismiss={this.toggleCreate} isOpen={this.state.creatingApp} />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  user: state.user,
});

export default connect<PageWrapperReduxProps, void, PageWrapperComponentProps>(mapStateToProps, null)(PageWrapper as any);
