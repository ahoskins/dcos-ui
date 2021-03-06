var React = require('react');
var Units = require('../../utils/Units');

var Chart = require('./Chart');
var TimeSeriesChart = require('./TimeSeriesChart');
var TimeSeriesLabel = require('./TimeSeriesLabel');

var ResourceTimeSeriesChart = React.createClass({

  displayName: 'ResourceTimeSeriesChart',

  propTypes: {
    colorIndex: React.PropTypes.number.isRequired,
    usedResources: React.PropTypes.object.isRequired,
    totalResources: React.PropTypes.object.isRequired,
    usedResourcesStates: React.PropTypes.object.isRequired,
    mode: React.PropTypes.string,
    refreshRate: React.PropTypes.number.isRequired
  },

  getDefaultProps: function () {
    return {
      colorIndex: 0
    };
  },

  getData: function () {
    var props = this.props;
    return [{
      name: 'Alloc',
      colorIndex: this.props.colorIndex,
      values: props.usedResourcesStates[props.mode]
    }];
  },

  getHeadline: function (usedValue, totalValue) {
    if (this.props.mode === 'cpus') {
      return usedValue + ' of ' + totalValue + ' Shares';
    } else {
      return Units.filesize(usedValue * 1024 * 1024, 0) + ' of ' +
        Units.filesize(totalValue * 1024 * 1024, 0);
    }
  },

  getChart: function () {
    var props = this.props;

    return (
      <Chart>
        <TimeSeriesChart
          data={this.getData()}
          maxY={100}
          y="percentage"
          refreshRate={props.refreshRate} />
      </Chart>
    );
  },

  render: function () {
    var props = this.props;
    var usedValue = Math.round(props.usedResources[props.mode]);
    var totalValue = Math.round(props.totalResources[props.mode]);
    let percentage = Math.round(100 * usedValue / totalValue) || 0;

    return (
      <div className="chart">
        <TimeSeriesLabel colorIndex={this.props.colorIndex}
          currentValue={percentage}
          subHeading={this.getHeadline(usedValue, totalValue)} />
        {this.getChart()}
      </div>
    );
  }
});

module.exports = ResourceTimeSeriesChart;
