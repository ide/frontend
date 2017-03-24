import React from 'react';
import Relay from 'react-relay';
import { second } from 'metrick/duration';
import DocumentTitle from 'react-document-title';
import shallowCompare from 'react-addons-shallow-compare';

import PageHeader from '../shared/PageHeader';
import Panel from '../shared/Panel';
import Button from '../shared/Button';
import Spinner from '../shared/Spinner';
import permissions from '../../lib/permissions';
import { formatNumber } from '../../lib/number';

import InvitationRow from './InvitationRow';
import Row from './Row';
// TODO: Make this a generic component
import Search from '../agent/Index/search';

const PAGE_SIZE = 10;

class MemberIndex extends React.Component {
  static propTypes = {
    organization: React.PropTypes.shape({
      name: React.PropTypes.string.isRequired,
      slug: React.PropTypes.string.isRequired,
      permissions: React.PropTypes.object.isRequired,
      members: React.PropTypes.shape({
        count: React.PropTypes.number.isRequired,
        pageInfo: React.PropTypes.shape({
          hasNextPage: React.PropTypes.bool.isRequired
        }).isRequired,
        edges: React.PropTypes.arrayOf(
          React.PropTypes.shape({
            node: React.PropTypes.object.isRequired
          }).isRequired
        ).isRequired
      }),
      invitations: React.PropTypes.shape({
        pageInfo: React.PropTypes.shape({
          hasNextPage: React.PropTypes.bool.isRequired
        }).isRequired,
        edges: React.PropTypes.arrayOf(
          React.PropTypes.shape({
            node: React.PropTypes.object.isRequired
          })
        ).isRequired
      })
    }).isRequired,
    relay: React.PropTypes.object.isRequired
  };

  state = {
    loadingMembers: false,
    loadingInvitations: false
  };

  shouldComponentUpdate(nextProps, nextState) {
    return shallowCompare(this, nextProps, nextState);
  }

  componentDidMount() {
    // Use a `forceFetch` so every time the user comes back to this page we'll
    // grab fresh data.
    this.props.relay.forceFetch({ isMounted: true });
  }

  render() {
    return (
      <DocumentTitle title={`Users · ${this.props.organization.name}`}>
        <div>
          <PageHeader>
            <PageHeader.Title>
              Users
            </PageHeader.Title>
            <PageHeader.Description>
              Invite people to this organization so they can see and create builds, manage pipelines, and customize their notification preferences.
            </PageHeader.Description>
            <PageHeader.Menu>{this.renderNewMemberButton()}</PageHeader.Menu>
          </PageHeader>
          <Panel className="mb4">
            <div className="bg-silver semi-bold flex items-center">
              <div className="flex-auto py2 px3">
                {this.props.organization.name} members
              </div>
              <div className="flex items-center mr3">
                {this.renderMemberSearchSpinner()}
                <Search
                  className="input py1 px2"
                  placeholder="Filter"
                  style={{ fontSize: 12, lineHeight: 1.1, height: 30, width: 160 }}
                  onSearch={this.handleMemberSearch}
                />
              </div>
            </div>
            {this.renderMemberSearchInfo()}
            {this.renderMembers()}
            {this.renderMemberFooter()}
          </Panel>

          <Panel>
            <Panel.Header>Invitations</Panel.Header>
            {this.renderInvitations()}
            {this.renderInvitationFooter()}
          </Panel>
        </div>
      </DocumentTitle>
    );
  }

  renderNewMemberButton() {
    return permissions(this.props.organization.permissions).check(
      {
        allowed: "organizationInvitationCreate",
        render: () => <PageHeader.Button link={`/organizations/${this.props.organization.slug}/users/new`} theme="default" outline={true}>Invite Users</PageHeader.Button>
      }
    );
  }

  renderMemberSearchSpinner() {
    if (this.state.searchingMembersIsSlow) {
      return (
        <Spinner className="mr2" />
      );
    }
  }

  renderMemberSearchInfo() {
    const { organization: { members }, relay: { variables: { memberSearch } } } = this.props;

    if (memberSearch && members) {
      return (
        <div className="bg-silver semi-bold py2 px3">
          <small className="dark-gray">
            {formatNumber(members.count)} matching members
          </small>
        </div>
      );
    }
  }

  renderMembers() {
    const { members } = this.props.organization;

    if (!members) {
      return (
        <Panel.Section className="center">
          <Spinner />
        </Panel.Section>
      );
    } else {
      return members.edges.map((edge) => {
        return (
          <Row
            key={edge.node.id}
            organization={this.props.organization}
            organizationMember={edge.node}
          />
        );
      });
    }
  }

  renderMemberFooter() {
    // don't show any footer if we haven't ever loaded
    // any members, or if there's no next page
    if (!this.props.organization.members || !this.props.organization.members.pageInfo.hasNextPage) {
      return;
    }

    let footerContent = (
      <Button
        outline={true}
        theme="default"
        onClick={this.handleLoadMoreMembersClick}
      >
        Load more users…
      </Button>
    );

    // show a spinner if we're loading more members
    if (this.state.loadingMembers) {
      footerContent = <Spinner style={{ margin: 9.5 }} />;
    }

    return (
      <Panel.Footer className="center">
        {footerContent}
      </Panel.Footer>
    );
  }

  handleMemberSearch = (memberSearch) => {
    this.setState({ searchingMembers: true });

    if (this.memberSearchIsSlowTimeout) {
      clearTimeout(this.memberSearchIsSlowTimeout);
    }

    this.memberSearchIsSlowTimeout = setTimeout(() => {
      this.setState({ searchingMembersIsSlow: true });
    }, 1::second);

    this.props.relay.forceFetch(
      { memberSearch },
      (readyState) => {
        if (readyState.done) {
          if (this.memberSearchIsSlowTimeout) {
            clearTimeout(this.memberSearchIsSlowTimeout);
          }
          this.setState({
            searchingMembers: false,
            searchingMembersIsSlow: false
          });
        }
      }
    );
  };

  handleLoadMoreMembersClick = () => {
    this.setState({ loadingMembers: true });

    let { memberPageSize } = this.props.relay.variables;

    memberPageSize += PAGE_SIZE;

    this.props.relay.setVariables(
      { memberPageSize },
      (readyState) => {
        if (readyState.done) {
          this.setState({ loadingMembers: false });
        }
      }
    );
  };

  renderInvitations() {
    const invitations = this.props.organization.invitations;

    if (!invitations) {
      return (
        <Panel.Section className="center">
          <Spinner />
        </Panel.Section>
      );
    } else {
      if (invitations.edges.length > 0) {
        return (
          invitations.edges.map((edge) => {
            return (
              <InvitationRow
                key={edge.node.id}
                organization={this.props.organization}
                organizationInvitation={edge.node}
              />
            );
          })
        );
      } else {
        return (
          <Panel.Section>
            <div className="dark-gray">There are no pending invitations</div>
          </Panel.Section>
        );
      }
    }
  }

  renderInvitationFooter() {
    // don't show any footer if we haven't ever loaded
    // any invitations, or if there's no next page
    if (!this.props.organization.invitations || !this.props.organization.invitations.pageInfo.hasNextPage) {
      return;
    }

    let footerContent = (
      <Button
        outline={true}
        theme="default"
        onClick={this.handleLoadMoreInvitationsClick}
      >
        Load more invitations…
      </Button>
    );

    // show a spinner if we're loading more invitations
    if (this.state.loadingInvitations) {
      footerContent = <Spinner style={{ margin: 9.5 }} />;
    }

    return (
      <Panel.Footer className="center">
        {footerContent}
      </Panel.Footer>
    );
  }

  handleLoadMoreInvitationsClick = () => {
    this.setState({ loadingInvitations: true });

    let { invitationPageSize } = this.props.relay.variables;

    invitationPageSize += PAGE_SIZE;

    this.props.relay.setVariables(
      { invitationPageSize },
      (readyState) => {
        if (readyState.done) {
          this.setState({ loadingInvitations: false });
        }
      }
    );
  };
}

export default Relay.createContainer(MemberIndex, {
  initialVariables: {
    isMounted: false,
    memberPageSize: PAGE_SIZE,
    memberSearch: null,
    invitationPageSize: PAGE_SIZE
  },

  fragments: {
    organization: () => Relay.QL`
      fragment on Organization {
        name
        slug
        ${Row.getFragment('organization')}
        permissions {
          organizationInvitationCreate {
            allowed
          }
        }
        members(first: $memberPageSize, search: $memberSearch, order: NAME) @include(if: $isMounted) {
          count
          edges {
            node {
              id
              ${Row.getFragment('organizationMember')}
            }
          }
          pageInfo {
            hasNextPage
          }
        }
        invitations(first: $invitationPageSize, state: PENDING) @include(if: $isMounted) {
          edges {
            node {
              id
              ${InvitationRow.getFragment('organizationInvitation')}
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
  }
});
