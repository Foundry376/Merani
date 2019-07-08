import classNames from 'classnames';
import _ from 'underscore';
import {
  React,
  ReactDOM,
  PropTypes,
  Utils,
  Actions,
  MessageStore,
  SearchableComponentStore,
  SearchableComponentMaker,
  EmailAvatar
} from 'mailspring-exports';

import {
  Spinner,
  RetinaImg,
  MailLabelSet,
  ScrollRegion,
  MailImportantIcon,
  KeyCommandsRegion,
  InjectedComponentSet,
} from 'mailspring-component-kit';

import FindInThread from './find-in-thread';
import MessageItemContainer from './message-item-container';
import { remote } from 'electron';
const { Menu, MenuItem } = remote;

const buttonTimeout = 700;

class MessageListScrollTooltip extends React.Component {
  static displayName = 'MessageListScrollTooltip';
  static propTypes = {
    viewportCenter: PropTypes.number.isRequired,
    totalHeight: PropTypes.number.isRequired,
  };

  componentWillMount() {
    this.setupForProps(this.props);
  }

  componentWillReceiveProps(newProps) {
    this.setupForProps(newProps);
  }

  shouldComponentUpdate(newProps, newState) {
    return !Utils.isEqualReact(this.state, newState);
  }

  setupForProps(props) {
    // Technically, we could have MessageList provide the currently visible
    // item index, but the DOM approach is simple and self-contained.
    //
    const els = document.querySelectorAll('.message-item-wrap');
    let idx = Array.from(els).findIndex(el => el.offsetTop > props.viewportCenter);
    if (idx === -1) {
      idx = els.length;
    }

    this.setState({
      idx: idx,
      count: els.length,
    });
  }

  render() {
    return (
      <div className="scroll-tooltip">
        {this.state.idx} of {this.state.count}
      </div>
    );
  }
}

class MessageList extends React.Component {
  static displayName = 'MessageList';
  static containerStyles = {
    minWidth: 500,
    maxWidth: 999999,
  };

  static default = {
    buttonTimeout: 700, // in milliseconds
  };

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
    this.state.minified = true;
    this.state.isReplyAlling = false;
    this.state.isReplying = false;
    this.state.isForwarding = false;
    this._replyTimer = null;
    this._replyAllTimer = null;
    this._forwardTimer = null;
    this._mounted = false;
    this._draftScrollInProgress = false;
    this.MINIFY_THRESHOLD = 3;
  }

  componentDidMount() {
    this._mounted = true;
    this._unsubscribers = [
      MessageStore.listen(this._onChange),
      Actions.draftReplyForwardCreated.listen(this._onDraftCreated, this),
      Actions.composeReply.listen(this._onCreatingDraft, this),
    ];
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentDidUpdate() {
    // cannot remove
  }

  componentWillUnmount() {
    // console.log('unmounting message-list');
    for (const unsubscribe of this._unsubscribers) {
      unsubscribe();
    }
    this._mounted = false;
    clearTimeout(this._forwardTimer);
    clearTimeout(this._replyAllTimer);
    clearTimeout(this._replyTimer);
  }

  _timeoutButton = (type) => {
    if (type === 'reply') {
      if (!this._replyTimer) {
        this._replyTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplying: false });
            this._replyTimer = null;
          }
        }, buttonTimeout);
      }
    } else if (type === 'reply-all') {
      if (!this._replyAllTimer) {
        this._replyAllTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplyAlling: false });
            this._replyAllTimer = null;
          }
        }, buttonTimeout);
      }
    } else {
      if (!this._forwardTimer) {
        this._forwardTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isForwarding: false });
            this._forwardTimer = null;
          }
        }, buttonTimeout);
      }
    }
  };

  _onCreatingDraft = ({ message = {}, type = '' }) => {
    if (this._mounted && (!this._lastMessage() || message.id === this._lastMessage().id)) {
      if (type === 'reply') {
        this.setState({ isReplying: true }, this._timeoutButton.bind(this, 'reply'));
      } else if (type === 'reply-all') {
        this.setState({ isReplyAlling: true }, this._timeoutButton.bind(this, 'reply-all'));
      } else {
        this.setState({ isForwarding: true }, this._timeoutButton.bind(this, 'forward'));
      }
    }
  };

  _onDraftCreated = ({ messageId, type = '' }) => {
    if (this._mounted && (!this._lastMessage() || messageId && messageId === this._lastMessage().id)) {
      if (type === 'reply') {
        if (this._replyTimer) {
          return;
        }
        this._replyTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplying: false });
          }
          this._replyTimer = null;
        }, buttonTimeout);
      } else if (type === 'reply-all') {
        if (this._replyAllTimer) {
          return;
        }
        this._replyAllTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplyAlling: false });
          }
          this._replyAllTimer = null;
        }, buttonTimeout);
      } else {
        if (this._forwardTimer) {
          return;
        }
        this._forwardTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isForwarding: false });
          }
          this._forwardTimer = null;
        }, buttonTimeout);
      }
    }
  };

  _globalKeymapHandlers() {
    const handlers = {
      'core:reply': () => {
        if (this._mounted && !this.state.isReplying && !this._replyTimer) {
          this._timeoutButton('reply');
          this.setState({ isReplying: true });
          Actions.composeReply({
            thread: this.state.currentThread,
            message: this._lastMessage(),
            type: 'reply',
            behavior: 'prefer-existing',
          });
        }
      },
      'core:reply-all': () => {
        if (this._mounted && !this.state.isReplyAlling && !this._replyAllTimer) {
          this._timeoutButton('reply-all');
          this.setState({ isReplyAlling: true });
          Actions.composeReply({
            thread: this.state.currentThread,
            message: this._lastMessage(),
            type: 'reply-all',
            behavior: 'prefer-existing',
          });
        }
      },
      'core:forward': () => this._onForward(),
      'core:print-thread': () => this._onPrintThread(),
      'core:export-pdf': this._onPdfThread,
      'core:messages-page-up': () => this._onScrollByPage(-1),
      'core:messages-page-down': () => this._onScrollByPage(1),
    };

    if (this.state.canCollapse) {
      handlers['message-list:toggle-expanded'] = () => this._onToggleAllMessagesExpanded();
    }

    return handlers;
  }

  _getMessageContainer(headerMessageId) {
    return this.refs[`message-container-${headerMessageId}`];
  }

  _onForward = () => {
    if (!this.state.currentThread || this.state.isForwarding || !this._mounted || this._forwardTimer) {
      return;
    }
    this._timeoutButton('forward');
    this.setState({ isForwarding: true });
    Actions.composeForward({
      thread: this.state.currentThread,
      message: this._lastMessage(),
    });
  };

  _lastMessage() {
    return (this.state.messages || []).filter(m => !m.draft).pop();
  }

  // Returns either "reply" or "reply-all"
  _replyType() {
    const defaultReplyType = AppEnv.config.get('core.sending.defaultReplyType');
    const lastMessage = this._lastMessage();
    if (!lastMessage) {
      return 'reply';
    }

    if (lastMessage.canReplyAll()) {
      return defaultReplyType === 'reply-all' ? 'reply-all' : 'reply';
    }
    return 'reply';
  }

  _onToggleAllMessagesExpanded = () => {
    Actions.toggleAllMessagesExpanded();
  };
  _onPdfThread = () => {
    const node = ReactDOM.findDOMNode(this);
    Actions.pdfThread(this.state.currentThread, node.innerHTML);
  };

  _onPrintThread = () => {
    const node = ReactDOM.findDOMNode(this);
    Actions.printThread(this.state.currentThread, node.innerHTML);
  };

  _onPopThreadIn = () => {
    if (!this.state.currentThread) {
      return;
    }
    Actions.focusThreadMainWindow(this.state.currentThread);
    AppEnv.close({ threadId: this.state.currentThread.id });
  };

  _onPopoutThread = () => {
    if (!this.state.currentThread) {
      return;
    }
    Actions.popoutThread(this.state.currentThread);
    // This returns the single-pane view to the inbox, and does nothing for
    // double-pane view because we're at the root sheet.
    Actions.popSheet();
  };

  _onClickReplyArea = () => {
    if (!this.state.currentThread || this.state.isReplying || this.state.isReplyAlling || !this._mounted) {
      return;
    }
    if (this._replyType() === 'reply-all') {
      this.setState({ isReplyAlling: true }, this._timeoutButton.bind(this, 'reply-all'));
    } else {
      this.setState({ isReplying: true }, this._timeoutButton.bind(this, 'reply'));
    }
    Actions.composeReply({
      thread: this.state.currentThread,
      message: this._lastMessage(),
      type: this._replyType(),
      behavior: 'prefer-existing-if-pristine',
    });
  };

  _messageElements() {
    const { messagesExpandedState, currentThread } = this.state;
    const elements = [];

    let messages = this._messagesWithMinification(this.state.messages);
    const mostRecentMessage = messages[messages.length - 1];
    const hasReplyArea = mostRecentMessage && !mostRecentMessage.draft;

    // Invert the message list if the descending option is set
    if (AppEnv.config.get('core.reading.descendingOrderMessageList')) {
      messages = messages.reverse();
    }

    messages.forEach(message => {
      if (message.type === 'minifiedBundle') {
        elements.push(this._renderMinifiedBundle(message));
        return;
      }

      const collapsed = !messagesExpandedState[message.id];
      const isMostRecent = message === mostRecentMessage;
      const isBeforeReplyArea = isMostRecent && hasReplyArea;

      elements.push(
        <MessageItemContainer
          key={message.id}
          ref={`message-container-${message.headerMessageId}`}
          thread={currentThread}
          message={message}
          messages={messages}
          collapsed={collapsed}
          isMostRecent={isMostRecent}
          isBeforeReplyArea={isBeforeReplyArea}
          scrollTo={this._scrollTo}
          threadPopedOut={this.state.popedOut}
        />,
      );

      if (isBeforeReplyArea) {
        elements.push(this._renderReplyArea());
      }
    });

    return elements;
  }

  _messagesWithMinification(allMessages = []) {
    if (!this.state.minified) {
      return allMessages;
    }

    const messages = [].concat(allMessages);
    const minifyRanges = [];
    let consecutiveCollapsed = 0;

    messages.forEach((message, idx) => {
      // Never minify the 1st message
      if (idx === 0) {
        return;
      }

      const expandState = this.state.messagesExpandedState[message.id];

      if (!expandState) {
        consecutiveCollapsed += 1;
      } else {
        // We add a +1 because we don't minify the last collapsed message,
        // but the MINIFY_THRESHOLD refers to the smallest N that can be in
        // the "N older messages" minified block.
        const minifyOffset = expandState === 'default' ? 1 : 0;

        if (consecutiveCollapsed >= this.MINIFY_THRESHOLD + minifyOffset) {
          minifyRanges.push({
            start: idx - consecutiveCollapsed,
            length: consecutiveCollapsed - minifyOffset,
          });
        }
        consecutiveCollapsed = 0;
      }
    });

    let indexOffset = 0;
    for (const range of minifyRanges) {
      const start = range.start - indexOffset;
      const minified = {
        type: 'minifiedBundle',
        messages: messages.slice(start, start + range.length),
      };
      messages.splice(start, range.length, minified);

      // While we removed `range.length` items, we also added 1 back in.
      indexOffset += range.length - 1;
    }
    return messages;
  }

  // Some child components (like the composer) might request that we scroll
  // to a given location. If `selectionTop` is defined that means we should
  // scroll to that absolute position.
  //
  // If messageId and location are defined, that means we want to scroll
  // smoothly to the top of a particular message.
  _scrollTo = ({ headerMessageId, rect, position } = {}) => {
    if (this._draftScrollInProgress) {
      return;
    }
    if (headerMessageId) {
      const messageElement = this._getMessageContainer(headerMessageId);
      if (!messageElement) {
        return;
      }
      this._messageWrapEl.scrollTo(messageElement, {
        position: position !== undefined ? position : ScrollRegion.ScrollPosition.Visible,
      });
    } else if (rect) {
      this._messageWrapEl.scrollToRect(rect, {
        position: ScrollRegion.ScrollPosition.CenterIfInvisible,
      });
    } else {
      throw new Error('onChildScrollRequest: expected id or rect');
    }
  };

  _onScrollByPage = direction => {
    const height = ReactDOM.findDOMNode(this._messageWrapEl).clientHeight;
    this._messageWrapEl.scrollTop += height * direction;
  };

  _onChange = () => {
    const newState = this._getStateFromStores();
    if ((this.state.currentThread || {}).id !== (newState.currentThread || {}).id) {
      newState.minified = true;
    }
    this.setState(newState);
  };

  _getStateFromStores() {
    return {
      messages: MessageStore.items() || [],
      messagesExpandedState: MessageStore.itemsExpandedState(),
      canCollapse: MessageStore.items().length > 1,
      hasCollapsedItems: MessageStore.hasCollapsedItems(),
      currentThread: MessageStore.thread(),
      loading: MessageStore.itemsLoading(),
      popedOut: MessageStore.isPopedOut(),
    };
  }
  _onSelectText = e => {

    e.preventDefault();
    e.stopPropagation();

    const textNode = e.currentTarget.childNodes[0];
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.length);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  _onContactContextMenu = (subject) => {
    const menu = new Menu();
    menu.append(new MenuItem({ role: 'copy' }));
    menu.append(new MenuItem({
      label: `Search for "${subject}`,
      click: () => Actions.searchQuerySubmitted(`subject:"${subject}"`),
    })
    );
    menu.popup({});
  };

  _renderSubject() {
    let subject = this.state.currentThread.subject;
    if (!subject || subject.length === 0) {
      subject = '(No Subject)';
    }

    return (
      <div className="message-subject-wrap">
        <div style={{ flex: 1, flexWrap: 'wrap' }}>
          <span className="message-subject"
            onClick={this._onSelectText}
            onContextMenu={this._onContactContextMenu.bind(this, subject)}
          >
            {subject}
            <MailImportantIcon thread={this.state.currentThread} />
            <MailLabelSet
              noWrapper
              removable
              includeCurrentCategories
              messages={this.state.messages}
              thread={this.state.currentThread}
            />
          </span>
        </div>
        {/* {this._renderIcons()} */}
      </div>
    );
  }

  _renderIcons() {
    return (
      <div className="message-icons-wrap">
        {this._renderExpandToggle()}
        <div onClick={this._onPrintThread}>
          <RetinaImg name={'print.svg'}
            title="Print Thread"
            style={{ width: 24, height: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask} />
        </div>
        {this._renderPopoutToggle()}
      </div>
    );
  }

  _renderExpandToggle() {
    if (!this.state.canCollapse) {
      return <span />;
    }

    return (
      <div onClick={this._onToggleAllMessagesExpanded}>
        <RetinaImg
          name={this.state.hasCollapsedItems ? 'expand.svg' : 'collapse.svg'}
          title={this.state.hasCollapsedItems ? 'Expand All' : 'Collapse All'}
          style={{ width: 24, height: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  _renderPopoutToggle() {
    if (AppEnv.isThreadWindow()) {
      return (
        <div onClick={this._onPopThreadIn}>
          <RetinaImg name={'pop-in.svg'}
            style={{ width: 24, height: 24 }}
            title="Pop thread in"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask} />
        </div>
      );
    }
    return (
      <div onClick={this._onPopoutThread}>
        <RetinaImg name={'popout.svg'}
          style={{ width: 24, height: 24 }}
          title="Pop thread out"
          isIcon
          mode={RetinaImg.Mode.ContentIsMask} />
      </div>
    );
  }

  _renderReplyArea() {
    return (
      <div className="footer-reply-area-wrap"
        onClick={this.state.popedOut ? this._onPopoutThread : this._onClickReplyArea} key="reply-area">
        <div className="footer-reply-area">
          <RetinaImg
            name={`${this._replyType()}.svg`}
            style={{ width: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask} />
          <span className="reply-text">
            {this._replyType() === 'reply-all' ? 'Reply All' : 'Reply'}
          </span>
        </div>
      </div>
    );
  }

  _renderMinifiedBundle(bundle) {
    const lines = bundle.messages.slice(0, 3);

    return (
      <div
        className="minified-bundle"
        onClick={() => this.setState({ minified: false })}
        key={Utils.generateTempId()}
      >
        <div className="msg-avatars">
          {
            lines.map((message, index) => (
              <EmailAvatar
                key={`thread-avatar-${index}`}
                from={message.from && message.from[0]}
                styles={{ marginLeft: 5 * index, border: '1px solid #fff' }}
              />
            ))
          }
        </div>
        <div className="num-messages">{bundle.messages.length} more emails</div>
      </div>
    );
  }

  _calcScrollPosition = _.throttle((scrollTop) => {
    const toolbar = document.querySelector('#message-list-toolbar');
    if (toolbar) {
      if (scrollTop > 0) {
        if (toolbar.className.indexOf('has-shadow') === -1) {
          toolbar.className += ' has-shadow';
        }
      } else {
        toolbar.className = toolbar.className.replace(' has-shadow', '');
      }
    }
  }, 100)

  _onScroll = e => {
    if (e.target) {
      this._calcScrollPosition(e.target.scrollTop);
    }
  };

  render() {
    if (!this.state.currentThread) {
      return <div className="empty" />;
    }

    const wrapClass = classNames({
      'messages-wrap': true,
      ready: !this.state.loading,
    });

    const messageListClass = classNames({
      'message-list': true,
      'height-fix': SearchableComponentStore.searchTerm !== null,
    });

    return (
      <KeyCommandsRegion globalHandlers={this._globalKeymapHandlers()}>
        <FindInThread />
        <div className="message-list-toolbar" id="message-list-toolbar">
          <InjectedComponentSet
            className="item-container"
            matching={{ role: 'MessageListToolbar' }}
            exposedProps={{ thread: this.state.currentThread, messages: this.state.messages }}
          />
        </div>
        <div className={messageListClass} id="message-list">
          <ScrollRegion
            tabIndex="-1"
            className={wrapClass}
            scrollbarTickProvider={SearchableComponentStore}
            scrollTooltipComponent={MessageListScrollTooltip}
            ref={el => {
              this._messageWrapEl = el;
            }}
            onScroll={this._onScroll}
          >
            {this._renderSubject()}
            <div className="headers" style={{ position: 'relative' }}>
              <InjectedComponentSet
                className="message-list-headers"
                matching={{ role: 'MessageListHeaders' }}
                exposedProps={{ thread: this.state.currentThread, messages: this.state.messages }}
                direction="column"
              />
            </div>
            {this._messageElements()}
          </ScrollRegion>
          <Spinner visible={this.state.loading} />
        </div>
      </KeyCommandsRegion>
    );
  }
}

export default SearchableComponentMaker.extend(MessageList);
