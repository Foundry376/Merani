import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { Actions } from 'mailspring-exports';
import {Flexbox, ScrollRegion } from 'mailspring-component-kit';
import PropTypes from 'prop-types';
import path from "path";
import DoneIcon from './icons/DoneIcon';
import Button from './Button';
import { theme } from '../../utils/colors';

const { primaryColor } = theme;


const emojiData = require('node-emoji/lib/emoji.json');
const sqlite = require('better-sqlite3');

let key = 0;

export default class EmailAttachmentPopup extends Component {
  static propTypes = {
    sendEmailAttachment: PropTypes.func,
  };
  static defaultProps = {
    sendEmailAttachment: null,
  };
  currentRef = null;
  constructor() {
    super();
    this.state = {};
  }
  componentWillMount() {
    console.log('cxm*** EmailAttachmentPopup.componentDidMount:');
    let configDirPath = AppEnv.getConfigDirPath();
    let dbpath = path.join(configDirPath, 'edisonmail.db');
    const db = sqlite(dbpath);
    const stmt = db.prepare('SELECT file.*, Message.subject FROM File inner join Message on File.messageId=Message.id');
    const files = stmt.all();
    this.setState({files});
  }
  renderAttachments = () => {
    let {files} = this.state;
    return files.map((file, index) => {
      const onClick = (event) => {
        file.checked = !file.checked;
        this.setState({ files:this.state.files.slice()});
      }
      return (<div className={`attachment-row ${file.checked ?  'checked' : ``}`} onClick={onClick} key={index}>
        <input type="checkbox"  className="email-check" checked={!!file.checked}/>
        <div className="email-subject">{file.subject}</div>
        <div className="email-attachment">{file.filename}</div>
      </div>)
    });
  };

  onConfirmSend = (event) => {
    if (this.props.sendEmailAttachment) {
      this.props.sendEmailAttachment(this.state.files.filter(file => file.checked));
    }
  };

  render() {
    return <ScrollRegion className='email-attachment-popup-container' ref={(_ref)=>{this.currentRef= _ref}}>

      <h2 className="email-title"> email attachments list</h2>
      <Button
        className="confirm-button"
        onClick={this.onConfirmSend}
      >
        <DoneIcon color={primaryColor} />
      </Button>
      <div className="email-label-row">
        <div className="email-subject"> Subject </div>
        <div className="email-attachment"> Attachment </div>
      </div>
      {this.renderAttachments()}
    </ScrollRegion>;
  }
}
