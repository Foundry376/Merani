import React, { Component } from 'react';
import PropTypes from 'prop-types';
import TopBar from '../../common/TopBar';
import ContactAvatar from '../../common/ContactAvatar';
import xmpp from '../../../xmpp';
import GroupChatAvatar from '../../common/GroupChatAvatar';

export default class MessagesTopBar extends Component {
  static propTypes = {
    onBackPressed: PropTypes.func,
    onInfoPressed: PropTypes.func,
    availableUsers: PropTypes.arrayOf(PropTypes.string),
    infoActive: PropTypes.bool,
    selectedConversation: PropTypes.shape({
      isGroup: PropTypes.bool.isRequired,
      jid: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,//.isRequired,
      avatar: PropTypes.string,
      occupants: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  }
  static defaultProps = {
    onBackPressed: () => { },
    onInfoPressed: () => { },
    availableUsers: [],
    infoActive: false,
    selectedConversation: null,
  }
  constructor(props) {
    super();
    this.state = { inviting: false }
  }
  _onkeyDown = (e) => {
    if (e.keyCode === 13) {
      e.currentTarget.blur();
      this.saveRoomName(e.currentTarget.innerText);
      e.preventDefault();
    }
  }

  _onBlur = (e) => {
    this.saveRoomName(e.currentTarget.innerText);
  }

  async saveRoomName(name) {
    const { selectedConversation } = this.props;
    if (name && name !== selectedConversation.name) {
      await xmpp.setRoomName(selectedConversation.jid, {
        name
      })
      selectedConversation && selectedConversation.update && selectedConversation.update({
        $set: { name }
      })
    }
  }

  render() {
    const {
      selectedConversation,
      onInfoPressed
    } = this.props;
    const conversation = selectedConversation;

    return (
      <div>
        <TopBar
          left={
            <div
              contentEditable={conversation.isGroup}
              dangerouslySetInnerHTML={{ __html: conversation.name }}
              onKeyDown={this._onkeyDown}
              onBlur={this._onBlur}
              spellCheck="false"
              className="conversationName">
            </div>
          }
          right={
            <div className="avatarWrapper">
              <div id="open-info" onClick={() => onInfoPressed()}>
                {conversation.isGroup ?
                  <GroupChatAvatar conversation={conversation} size={35} /> :
                  <ContactAvatar conversation={conversation} jid={conversation.jid} name={conversation.name}
                    email={conversation.email} avatar={conversation.avatar} size={35} />
                }
              </div>
            </div>
          }
        />
      </div>
    );
  }
}
