var _ = require('underscore');
var classNames = require('classnames');
var React = require('react');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var RouterLocation = Router.HashLocation;
var Link = Router.Link;
import {StoreMixin} from 'mesosphere-shared-reactjs';

var AlertPanel = require('../components/AlertPanel');
import CompositeState from '../structs/CompositeState';
import Config from '../config/Config';
import EventTypes from '../constants/EventTypes';
import FilterButtons from '../components/FilterButtons';
var FilterByService = require('../components/FilterByService');
var FilterInputText = require('../components/FilterInputText');
var FilterHeadline = require('../components/FilterHeadline');
var InternalStorageMixin = require('../mixins/InternalStorageMixin');
var MesosSummaryStore = require('../stores/MesosSummaryStore');
var Page = require('../components/Page');
var ResourceBarChart = require('../components/charts/ResourceBarChart');
var SidebarActions = require('../events/SidebarActions');
import SidePanels from '../components/SidePanels';
import StringUtil from '../utils/StringUtil';

const NODES_DISPLAY_LIMIT = 300;
const HEALTH_FILTER_BUTTONS = ['all', 'healthy', 'unhealthy'];

function getMesosHosts(state) {
  let states = MesosSummaryStore.get('states');
  let lastState = states.lastSuccessful();
  let nodes = CompositeState.getNodesList();

  let {byServiceFilter, healthFilter, searchString} = state;
  let filteredNodes = nodes.filter({
    service: byServiceFilter,
    name: searchString,
    health: healthFilter
  }).getItems();
  let nodeIDs = _.pluck(filteredNodes, 'id');

  return {
    nodes: filteredNodes,
    totalNodes: nodes.getItems().length,
    refreshRate: Config.getRefreshRate(),
    services: lastState.getServiceList().getItems(),
    statesProcessed: MesosSummaryStore.get('statesProcessed'),
    totalHostsResources: states.getResourceStatesForNodeIDs(nodeIDs),
    totalResources: lastState.getSlaveTotalResources()
  };
}

var DEFAULT_FILTER_OPTIONS = {
  byServiceFilter: null,
  healthFilter: 'all',
  searchString: ''
};

var NodesPage = React.createClass({

  displayName: 'NodesPage',

  mixins: [InternalStorageMixin, StoreMixin],

  statics: {
    // Static life cycle method from react router, that will be called
    // 'when a handler is about to render', i.e. on route change:
    // https://github.com/rackt/react-router/
    // blob/master/docs/api/components/RouteHandler.md
    willTransitionTo: function () {

      SidebarActions.close();
    }
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState: function () {
    return _.extend({selectedResource: 'cpus'}, DEFAULT_FILTER_OPTIONS);
  },

  componentWillMount: function () {
    this.internalStorage_set(getMesosHosts(this.state));
    this.internalStorage_update({
      openNodePanel: false,
      openTaskPanel: false
    });

    this.store_listeners = [
      {
        name: 'nodeHealth',
        events: ['success', 'error']
      }
    ];
  },

  componentDidMount: function () {
    MesosSummaryStore.addChangeListener(
      EventTypes.MESOS_SUMMARY_CHANGE,
      this.onMesosStateChange
    );

    MesosSummaryStore.addChangeListener(
      EventTypes.MESOS_SUMMARY_REQUEST_ERROR,
      this.onMesosStateChange
    );

    this.internalStorage_update({
      openNodePanel: this.props.params.nodeID != null,
      openTaskPanel: this.props.params.taskID != null
    });
  },

  componentWillReceiveProps: function (nextProps) {
    this.internalStorage_update({
      openNodePanel: nextProps.params.nodeID != null,
      openTaskPanel: nextProps.params.taskID != null
    });
  },

  componentWillUnmount: function () {
    MesosSummaryStore.removeChangeListener(
      EventTypes.MESOS_SUMMARY_CHANGE,
      this.onMesosStateChange
    );

    MesosSummaryStore.removeChangeListener(
      EventTypes.MESOS_SUMMARY_REQUEST_ERROR,
      this.onMesosStateChange
    );
  },

  onMesosStateChange: function () {
    this.internalStorage_update(getMesosHosts(this.state));
    this.forceUpdate();
  },

  resetFilter: function () {
    var state = _.clone(DEFAULT_FILTER_OPTIONS);
    this.internalStorage_update(getMesosHosts(state));
    this.setState(state);
  },

  handleSearchStringChange: function (searchString) {
    var stateChanges = _.extend({}, this.state, {
      searchString: searchString
    });

    this.internalStorage_update(getMesosHosts(stateChanges));
    this.setState({searchString: searchString});
  },

  handleByServiceFilterChange: function (byServiceFilter) {
    if (byServiceFilter === '') {
      byServiceFilter = null;
    }

    var stateChanges = _.extend({}, this.state, {
      byServiceFilter: byServiceFilter
    });

    this.internalStorage_update(getMesosHosts(stateChanges));
    this.setState({byServiceFilter: byServiceFilter});
  },

  handleHealthFilterChange: function (healthFilter) {
    this.internalStorage_update(getMesosHosts({healthFilter}));
    this.setState({healthFilter});
  },

  onResourceSelectionChange: function (selectedResource) {
    if (this.state.selectedResource !== selectedResource) {
      this.setState({selectedResource: selectedResource});
    }
  },

  getButtonContent: function (filterName, count) {
    let dotClassSet = classNames({
      'dot': filterName !== 'all',
      'danger': filterName === 'unhealthy',
      'success': filterName === 'healthy'
    });

    return (
      <span className="button-align-content">
        <span className={dotClassSet}></span>
        <span className="label">{StringUtil.capitalize(filterName)}</span>
        <span className="badge">{count || 0}</span>
      </span>
    );
  },

  getFilterInputText: function () {
    var isVisible = /\/nodes\/list\/?/i.test(RouterLocation.getCurrentPath());

    if (!isVisible) {
      return null;
    }

    return (
      <FilterInputText
        className="flush-bottom"
        searchString={this.state.searchString}
        handleFilterChange={this.handleSearchStringChange}
        inverseStyle={true} />
    );
  },

  getViewTypeRadioButtons: function (resetFilter) {
    var buttonClasses = {
      'button button-stroke button-inverse': true
    };

    var listClassSet = classNames(_.extend({
      'active': /\/nodes\/list\/?/i.test(RouterLocation.getCurrentPath())
    }, buttonClasses));

    var gridClassSet = classNames(_.extend({
      'active': /\/nodes\/grid\/?/i.test(RouterLocation.getCurrentPath())
    }, buttonClasses));

    return (
      <div className="button-group flush-bottom">
        <Link className={listClassSet} onClick={resetFilter} to="nodes-list">List</Link>
        <Link className={gridClassSet} onClick={resetFilter} to="nodes-grid">Grid</Link>
      </div>
    );
  },

  getHostsPageContent: function () {
    var data = this.internalStorage_get();
    var state = this.state;
    var nodesList = _.first(data.nodes, NODES_DISPLAY_LIMIT);
    var currentPage = 'nodes-grid';
    var onNodesList = /\/nodes\/list\/?/i.test(RouterLocation.getCurrentPath());
    let nodesHealth = CompositeState.getNodesList().getItems().map(
      function (node) {
        return node.getHealth();
      }
    );

    if (onNodesList) {
      currentPage = 'nodes-list';
    }

    return (
      <div>
        <ResourceBarChart
          itemCount={data.nodes.length}
          resources={data.totalHostsResources}
          totalResources={data.totalResources}
          refreshRate={data.refreshRate}
          resourceType="Nodes"
          selectedResource={this.state.selectedResource}
          onResourceSelectionChange={this.onResourceSelectionChange} />
        <FilterHeadline
          inverseStyle={true}
          onReset={this.resetFilter}
          name="Nodes"
          currentLength={nodesList.length}
          totalLength={data.totalNodes} />

        <div className="media-object-spacing-wrapper media-object-spacing-narrow media-object-offset">
          <div className="media-object media-object-wrap-reverse">
            <div className="media-object media-object-item media-object-inline media-object-wrap">
              <div className="media-object-item media-object-align-top">
                <FilterButtons
                  renderButtonContent={this.getButtonContent}
                  filters={HEALTH_FILTER_BUTTONS}
                  filterByKey="title"
                  onFilterChange={this.handleHealthFilterChange}
                  itemList={nodesHealth}
                  selectedFilter={state.healthFilter} />
              </div>
              <div className="media-object-item media-object-align-top">
                <div className="form-group flush-bottom">
                  <FilterByService
                    byServiceFilter={state.byServiceFilter}
                    services={data.services}
                    totalHostsCount={data.totalNodes}
                    handleFilterChange={this.handleByServiceFilterChange} />
                </div>
              </div>
              <div className="media-object-item media-object-align-top">
                {this.getFilterInputText()}
              </div>
            </div>
            <div className="media-object media-object-item media-object-inline media-object-item-align-right media-object-offset">
              <div className="media-object-item">
                {this.getViewTypeRadioButtons(this.resetFilter)}
              </div>
            </div>
          </div>
        </div>

        <RouteHandler
          selectedResource={state.selectedResource}
          hosts={nodesList}
          services={data.services} />
        <SidePanels
          params={this.props.params}
          openedPage={currentPage} />
      </div>
    );
  },

  getEmptyHostsPageContent: function () {
    return (
      <AlertPanel
        title="Empty Datacenter"
        iconClassName="icon icon-sprite icon-sprite-jumbo
          icon-sprite-jumbo-white icon-datacenter flush-top">
        <p className="flush">
          Your datacenter is looking pretty empty. We don't see any nodes other than your master.
        </p>
      </AlertPanel>
    );
  },

  getContents: function (isEmpty) {
    if (isEmpty) {
      return this.getEmptyHostsPageContent();
    } else {
      return this.getHostsPageContent();
    }
  },

  render: function () {
    var data = this.internalStorage_get();
    var isEmpty = data.statesProcessed && data.totalNodes === 0;

    return (
      <Page title="Nodes">
       {this.getContents(isEmpty)}
      </Page>
    );
  }

});

module.exports = NodesPage;
