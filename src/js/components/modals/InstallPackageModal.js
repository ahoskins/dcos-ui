import classNames from 'classnames';
import {Form, Modal} from 'reactjs-components';
import mixin from 'reactjs-mixin';
import React from 'react';
import {StoreMixin} from 'mesosphere-shared-reactjs';

import AdvancedConfig from '../AdvancedConfig';
import CosmosMessages from '../../constants/CosmosMessages';
import CosmosPackagesStore from '../../stores/CosmosPackagesStore';
import InternalStorageMixin from '../../mixins/InternalStorageMixin';
import ReviewConfig from '../ReviewConfig';
import SchemaUtil from '../../utils/SchemaUtil';
import StringUtil from '../../utils/StringUtil';
import TabsMixin from '../../mixins/TabsMixin';
import Util from '../../utils/Util';

const METHODS_TO_BIND = [
  'getAdvancedSubmit',
  'handleChangeAppId',
  'handleChangeTab',
  'handleInstallPackage',
  'handleAdvancedFormChange',
  'handleModalClose'
];

class InstallPackageModal extends
  mixin(InternalStorageMixin, TabsMixin, StoreMixin) {
  constructor() {
    super(...arguments);

    this.tabs_tabs = {
      defaultInstall: 'DefaultInstall',
      advancedInstall: 'AdvancedInstall',
      reviewAdvancedConfig: 'ReviewAdvancedConfig',
      packageInstalled: 'PackageInstalled'
    };

    this.internalStorage_set({
      appId: null,
      descriptionError: null,
      hasFormErrors: false,
      installError: null,
      isLoading: true,
      pendingRequest: false
    });
    this.state = {
      currentTab: 'defaultInstall',
      schemaIncorrect: false
    };

    this.store_listeners = [{
      name: 'cosmosPackages',
      events: [
        'descriptionError',
        'descriptionSuccess',
        'installError',
        'installSuccess'
      ]
    }];

    METHODS_TO_BIND.forEach((method) => {
      this[method] = this[method].bind(this);
    });
  }

  componentDidMount() {
    super.componentDidMount(...arguments);
    let {props} = this;
    if (props.open) {
      CosmosPackagesStore.fetchPackageDescription(
        props.packageName,
        props.packageVersion
      );
    }
  }

  componentWillReceiveProps(nextProps) {
    super.componentWillReceiveProps(...arguments);
    let {props} = this;
    if (props.open && !nextProps.open) {
      this.internalStorage_set({
        appId: null,
        descriptionError: null,
        installError: null,
        isLoading: true,
        pendingRequest: false
      });
      // Reset our trigger submit for advanced install
      this.triggerAdvancedSubmit = undefined;
      this.setState({currentTab: 'defaultInstall'});
    }

    if (!props.open && nextProps.open) {
      CosmosPackagesStore.fetchPackageDescription(
        nextProps.packageName,
        nextProps.packageVersion
      );
    }
  }

  componentDidUpdate() {
    if (this.triggerAdvancedSubmit) {
      // Trigger submit upfront to validate fields and potentially disable buttons
      let {isValidated} = this.triggerAdvancedSubmit();
      this.internalStorage_update({hasFormErrors: !isValidated});
    }
  }

  onCosmosPackagesStoreDescriptionError(descriptionError) {
    this.internalStorage_update({appId: null, descriptionError});
    this.forceUpdate();
  }

  onCosmosPackagesStoreDescriptionSuccess() {
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();
    if (!SchemaUtil.validateSchema(cosmosPackage.get('config'))) {
      this.setState({schemaIncorrect: true});
      return;
    }

    let {name} = cosmosPackage.get('package');
    let config = cosmosPackage.get('config');
    let appId = Util.findNestedPropertyInObject(
      config, `properties.service.properties.name.default`
    ) || `${name}`;

    // Store appId from package
    this.internalStorage_update({
      appId: appId,
      hasError: false,
      isLoading: false
    });
    this.setState({schemaIncorrect: false});
  }

  onCosmosPackagesStoreInstallError(installError) {
    this.internalStorage_update({
      installError,
      pendingRequest: false
    });
    this.setState({currentTab: 'defaultInstall'});
  }

  onCosmosPackagesStoreInstallSuccess() {
    this.internalStorage_update({
      installError: null,
      pendingRequest: false
    });
    this.setState({currentTab: 'packageInstalled'});
  }

  handleAdvancedFormChange(formObject) {
    this.internalStorage_update({hasFormErrors: !formObject.isValidated});
    this.forceUpdate();
  }

  handleChangeAppId(definition) {
    this.internalStorage_update({installError: null, appId: definition.appId});
    this.forceUpdate();
  }

  handleChangeTab(currentTab) {
    let newState = {installError: null};
    if (currentTab === 'advancedInstall') {
      // Change back to previous state and clean up stored config
      newState.advancedConfiguration = null;
    }

    if (currentTab === 'reviewAdvancedConfig') {
      let {isValidated, model} = this.triggerAdvancedSubmit();

      // Change state if form fields are validated and store configuration
      // for submission
      if (isValidated) {
        newState.advancedConfiguration = model;
      }
    }

    this.internalStorage_update(newState);
    this.tabs_handleTabClick(currentTab);
  }

  handleInstallPackage() {
    let {name, version} = CosmosPackagesStore
      .getPackageDetails().get('package');
    let {appId, configuration} = this.getAppIdAndConfiguration();

    CosmosPackagesStore.installPackage(name, version, appId, configuration);
    this.internalStorage_update({pendingRequest: true});
    this.forceUpdate();
  }

  handleModalClose() {
    this.setState({schemaIncorrect: false});
    this.props.onClose();
  }

  getAdvancedSubmit(triggerSubmit) {
    this.triggerAdvancedSubmit = triggerSubmit;
  }

  getAppIdFormDefinition() {
    return [{
      fieldType: 'text',
      name: 'appId',
      value: this.internalStorage_get().appId,
      required: true,
      sharedClass: 'form-element-inline h2 short flush-bottom',
      inputClass: 'form-control text-align-center',
      helpBlockClass: 'form-help-block text-align-center',
      showLabel: false,
      validation: /^\/?(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/g,
      validationErrorText: (
        'Names can include lowercase letters, digits, hyphens, "." and ","'
      ),
      writeType: 'edit'
    }];
  }

  getAppIdAndConfiguration() {
    let {advancedConfiguration, appId} = this.internalStorage_get();
    let {currentTab} = this.state;
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();
    let {name} = cosmosPackage.get('package');

    let isAdvancedInstall = currentTab === 'advancedInstall' ||
      currentTab === 'reviewAdvancedConfig';

    let configuration = SchemaUtil.definitionToJSONDocument(
      SchemaUtil.schemaToMultipleDefinition(cosmosPackage.get('config'))
    );

    if (isAdvancedInstall && advancedConfiguration) {
      configuration = advancedConfiguration;
    }

    // Copy appId to service name when using default install
    if (!isAdvancedInstall) {
      configuration = {[name]: {}, service: {name: appId}};
    }

    let advancedName =
      Util.findNestedPropertyInObject(configuration, 'service.name');

    // Copy service name to appId when using advanced install and
    // name is set
    if (isAdvancedInstall && advancedName) {
      appId = advancedName;
    }

    return {appId, configuration};
  }

  getLoadingScreen() {
    return (
      <div className="container-pod text-align-center vertical-center inverse">
        <div className="row">
          <div className="ball-scale">
            <div />
          </div>
        </div>
      </div>
    );
  }

  getInstallErrorScreen() {
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();
    let {pendingRequest, installError} = this.internalStorage_get();
    let installErrorMessage = CosmosMessages[installError.type] ||
        CosmosMessages.default;

    return (
      <div className="modal-content">
        <div className="modal-content-inner container container-pod container-pod-short horizontal-center">
          <h4 className="text-danger">{installErrorMessage.header}</h4>
          <p className="text-align-center">
            {installErrorMessage.getMessage(name || 'this package')}
          </p>
        </div>
        <div className="modal-footer">
          <div className="container">
            <div className="button-collection horizontal-center flush-bottom">
              <button
                disabled={!cosmosPackage || pendingRequest}
                className="button flush-bottom button-wide"
                onClick={this.handleChangeTab.bind(this, 'advancedInstall')}>
                Edit Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderDefaultInstallTabView() {
    let {
      descriptionError,
      pendingRequest,
      installError
    } = this.internalStorage_get();
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();
    let {name, version} = cosmosPackage.get('package');

    let error;
    if (descriptionError) {
      error = (
        <p className="text-danger text-small text-align-center">
          {descriptionError}
        </p>
      );
    }

    if (installError) {
      return this.getInstallErrorScreen();
    }

    let buttonText = 'Install Package';

    if (pendingRequest) {
      buttonText = 'Installing...';
    }

    return (
      <div>
        <div className="modal-content">
          <div className="modal-content-inner modal-content-inner-tall horizontal-center">
            <div className="icon icon-jumbo icon-image-container icon-app-container">
              <img src={cosmosPackage.getIcons()['icon-large']} />
            </div>
            <Form definition={this.getAppIdFormDefinition()}
              onSubmit={this.handleChangeAppId} />
            <p className="flush-bottom">{`${name} ${version}`}</p>
            {error}
          </div>
        </div>
        <div className="modal-footer">
          <div className="container">
            <div className="button-collection horizontal-center flush-bottom">
              <button
                disabled={!cosmosPackage || pendingRequest || descriptionError}
                className="button button-success flush-bottom button-wide flush"
                onClick={this.handleInstallPackage}>
                {buttonText}
              </button>
              <button
                disabled={!cosmosPackage || pendingRequest}
                className="button flush-bottom button-link button-primary clickable"
                onClick={this.handleChangeTab.bind(this, 'advancedInstall')}>
                Advanced Installation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderAdvancedInstallTabView() {
    let {pendingRequest, hasFormErrors} = this.internalStorage_get();
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();

    // Only return footer, we always render AdvancedConfig, but just change
    // the hidden class in render
    return (
      <div className="modal-footer">
        <div className="container">
          <div className="button-collection flush-bottom">
            <button
              className="button button-large flush"
              onClick={this.handleChangeTab.bind(this, 'defaultInstall')}>
              Back
            </button>
            <button
              disabled={!cosmosPackage || pendingRequest || hasFormErrors}
              className="button button-large button-success flush-bottom"
              onClick={this.handleChangeTab.bind(this, 'reviewAdvancedConfig')}>
              Review and Install
            </button>
          </div>
        </div>
      </div>
    );

  }

  renderReviewAdvancedConfigTabView() {
    let {pendingRequest} = this.internalStorage_get();
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();
    let {name, version} = cosmosPackage.get('package');
    let {appId, configuration} = this.getAppIdAndConfiguration();
    let buttonText = 'Install';

    if (pendingRequest) {
      buttonText = 'Installing...';
    }

    return (
      <div>
        <ReviewConfig
          packageIcon={cosmosPackage.getIcons()['icon-small']}
          packageType={name}
          packageName={appId}
          packageVersion={version}
          configuration={configuration} />
        <div className="modal-footer">
          <div className="container">
            <div className="button-collection flush-bottom">
              <button
                className="button button-large flush"
                onClick={this.handleChangeTab.bind(this, 'advancedInstall')}>
                Back
              </button>
              <button
                disabled={!cosmosPackage || pendingRequest}
                className="button button-success flush-bottom button-large"
                onClick={this.handleInstallPackage}>
                {buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderPackageInstalledTabView() {
    let {pendingRequest} = this.internalStorage_get();
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();

    let notes = Util.findNestedPropertyInObject(
      cosmosPackage.get('package'),
      'postInstallNotes'
    );

    let parsedNotes = StringUtil.parseMarkdown(notes);

    return (
      <div>
        <div className="modal-content">
          <div className="horizontal-center modal-content-inner container container-pod container-pod-short text-align-center">
            <h2 className="flush-top short-bottom">Success!</h2>
            <div
              style={{width: '100%', overflow: 'auto', wordWrap: 'break-word'}}
              dangerouslySetInnerHTML={parsedNotes} />
          </div>
        </div>
        <div className="modal-footer">
          <div className="container">
            <div className="button-collection horizontal-center flush-bottom">
              <button
                disabled={!cosmosPackage || pendingRequest}
                className="button button-success flush-bottom button-wide"
                onClick={this.props.onClose}>
                <i className="icon icon-sprite icon-sprite-mini icon-sprite-mini-white icon-check-mark" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  getIncorrectSchemaWarning(cosmosPackage) {
    let errorText = 'The schema for this package is not properly configured. ' +
      'If you are the package owner, please check your configuration.';

    let maintainer = cosmosPackage.getMaintainer();
    if (maintainer) {
      errorText = (
        <span>
          {`${errorText} Or you may contact the maintainer: `}
          <a href={`mailto:${maintainer}`}>{maintainer}</a>
        </span>
      );
    }

    return (
      <div className="modal-content">
        <div className="modal-content-inner container container-pod container-pod-short horizontal-center">
          <h4 className="text-danger">Invalid Configuration</h4>
          <p className="text-align-center">
            {errorText}
          </p>
        </div>
        <div className="modal-footer">
          <div className="container">
            <div className="button-collection horizontal-center flush-bottom">
              <button
                className="button flush-bottom button-wide"
                onClick={this.handleModalClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  getModalContents() {
    let {currentTab, schemaIncorrect} = this.state;
    let {isLoading} = this.internalStorage_get();
    let cosmosPackage = CosmosPackagesStore.getPackageDetails();

    if (schemaIncorrect) {
      return this.getIncorrectSchemaWarning(cosmosPackage);
    }

    if (isLoading || !cosmosPackage) {
      return this.getLoadingScreen();
    }

    let {name, version} = cosmosPackage.get('package');
    let advancedConfigClasses = classNames({
      hidden: currentTab !== 'advancedInstall'
    });

    return (
      <div>
        <AdvancedConfig
          className={advancedConfigClasses}
          packageIcon={cosmosPackage.getIcons()['icon-small']}
          packageName={name}
          packageVersion={version}
          schema={cosmosPackage.get('config')}
          onChange={this.handleAdvancedFormChange}
          getTriggerSubmit={this.getAdvancedSubmit} />
        {this.tabs_getTabView()}
      </div>
    );
  }

  render() {
    let {props, state} = this;
    let {currentTab} = state;

    let isAdvanced = currentTab === 'advancedInstall' ||
      currentTab === 'reviewAdvancedConfig';
    let isReviewing = isAdvanced;

    let backdropClasses = classNames({
      'modal-backdrop': true,
      'default-cursor': isAdvanced
    });

    let modalClasses = classNames('modal', {
      'modal-large': isReviewing,
      'modal-narrow': !isReviewing
    });

    let modalWrapperClasses = classNames({
      'multiple-form-modal': isAdvanced
    });

    return (
      <Modal
        backdropClass={backdropClasses}
        bodyClass=""
        closeByBackdropClick={!isAdvanced}
        innerBodyClass="flush-top flush-bottom"
        maxHeightPercentage={1}
        modalClass={modalClasses}
        modalWrapperClass={modalWrapperClasses}
        onClose={this.handleModalClose}
        open={props.open}
        showCloseButton={false}
        showFooter={false}>
        {this.getModalContents()}
      </Modal>
    );
  }
}

InstallPackageModal.defaultProps = {
  onClose: function () {},
  open: false
};

InstallPackageModal.propTypes = {
  packageName: React.PropTypes.string,
  packageVersion: React.PropTypes.string,
  open: React.PropTypes.bool,
  onClose: React.PropTypes.func
};

module.exports = InstallPackageModal;
