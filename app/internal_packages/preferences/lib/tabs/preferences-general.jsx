/* eslint global-require: 0*/
import React from 'react';
import PropTypes from 'prop-types';
import rimraf from 'rimraf';
import ConfigSchemaItem from './config-schema-item';
import WorkspaceSection from './workspace-section';
import { Actions } from 'mailspring-exports';
import DownloadSelection from './download-selection';

class PreferencesGeneral extends React.Component {
  static displayName = 'PreferencesGeneral';

  static propTypes = {
    config: PropTypes.object,
    configSchema: PropTypes.object,
  };
  constructor(props) {
    super(props);
    this.state = {};
    this.state.displaySupportPopup = false;
    this.timer = null;
    this.mounted = false;
  }
  componentDidMount() {
    this.mounted = true;
  }
  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.timer);
  }

  _onReboot = () => {
    const app = require('electron').remote.app;
    app.relaunch();
    app.quit();
  };

  _onCopySupportId = event => {
    navigator.clipboard.writeText(this.props.config.core.support.id).then(() => {
      this.setState({ displaySupportPopup: true });
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          if (this.mounted) {
            this.setState({ displaySupportPopup: false });
          }
        }, 1600); // Same as popupFrames animation length
      }
    });
  };

  _onResetAccountsAndSettings = () => {
    rimraf(AppEnv.getConfigDirPath(), { disableGlob: true }, err => {
      if (err) {
        return AppEnv.showErrorDialog(
          `Could not reset accounts and settings. Please delete the folder ${AppEnv.getConfigDirPath()} manually.\n\n${err.toString()}`
        );
      }
      this._onReboot();
    });
  };

  _onResetEmailCache = () => {
    Actions.forceKillAllClients();
  };

  render() {
    return (
      <div className="container-general">
        <div className="config-group">
          <h6>EMAIL</h6>
          <WorkspaceSection config={this.props.config} configSchema={this.props.configSchema} />
        </div>

        <div className="platform-note platform-linux-only">
          EdisonMail desktop notifications on Linux require Zenity. You may need to install it with
          your package manager (i.e., <code>sudo apt-get install zenity</code>).
        </div>
        <div className="config-group">
          <ConfigSchemaItem
            configSchema={this.props.configSchema.properties.reading}
            keyName="READING & RESPONDING"
            keyPath="core.reading"
            config={this.props.config}
          />

          <ConfigSchemaItem
            configSchema={this.props.configSchema.properties.composing.properties.spellcheck}
            keyName="Composing"
            keyPath="core.composing.spellcheck"
            config={this.props.config}
          />

          <ConfigSchemaItem
            configSchema={
              this.props.configSchema.properties.composing.properties.spellcheckDefaultLanguage
            }
            keyName="Composing"
            keyPath="core.composing.spellcheckDefaultLanguage"
            config={this.props.config}
          />
        </div>
        <div className="config-group">
          <h6>MESSAGES/CHAT</h6>
          <ConfigSchemaItem
            configSchema={this.props.configSchema.properties.workspace.properties.chatEnable}
            keyName="Attachments"
            keyPath="core.workspace.chatEnable"
            config={this.props.config}
          />
        </div>
        <div className="config-group">
          <ConfigSchemaItem
            configSchema={this.props.configSchema.properties.attachments}
            keyName="DOWNLOADS"
            keyPath="core.attachments"
            config={this.props.config}
            injectedComponent={
              <DownloadSelection
                config={this.props.config}
                keyPath="core.attachments.downloadFolder"
              />
            }
          />
        </div>

        {/* <div className="local-data">
          <h6>Local Data</h6>
          <div className="btn" onClick={this._onResetEmailCache}>
            Reset Email Cache
          </div>
          <div className="btn" onClick={this._onResetAccountsAndSettings}>
            Reset Accounts and Settings
          </div>
        </div>

        <section className="support">
          <h6>Support Id</h6>
          <div
            className="popup"
            style={{ display: `${this.state.displaySupportPopup ? 'inline-block' : 'none'}` }}
          >
            ID Copied
          </div>
          <div className="btn" onClick={this._onCopySupportId}>
            {this.props.config.core.support.id}
          </div>
        </section> */}
      </div>
    );
  }
}

export default PreferencesGeneral;
