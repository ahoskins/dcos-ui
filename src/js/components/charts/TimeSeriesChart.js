var _ = require("underscore");
var d3 = require("d3");
var React = require("react/addons");

var AnimationCircle = require("./AnimationCircle");
var ChartMixin = require("../../mixins/ChartMixin");
var ChartStripes = require("./ChartStripes");
var InternalStorageMixin = require("../../mixins/InternalStorageMixin");
var Maths = require("../../utils/Maths");
var TimeSeriesArea = require("./TimeSeriesArea");
var TimeSeriesMouseOver = require("./TimeSeriesMouseOver");
var ValueTypes = require("../../constants/ValueTypes");

var TimeSeriesChart = React.createClass({

  displayName: "TimeSeriesChart",

  propTypes: {
    axisConfiguration: React.PropTypes.object,
    // [{name: "Area Name", values: [{date: some time, y: 0}]}]
    data: React.PropTypes.array.isRequired,
    // `height` and `width` are required if this
    // module isn't used as a child of the `Chart` component
    // Otherwise Chart will automatically calculate this.
    height: React.PropTypes.number,
    margin: React.PropTypes.object.isRequired,
    maxY: React.PropTypes.number,
    refreshRate: React.PropTypes.number.isRequired,
    ticksY: React.PropTypes.number,
    y: React.PropTypes.string,
    yFormat: React.PropTypes.string,
    width: React.PropTypes.number
  },

  mixins: [ChartMixin, InternalStorageMixin],

  getDefaultProps: function () {
    return {
      axisConfiguration: {
        x: {
          showZeroTick: true
        }
      },
      margin: {
        top: 10,
        left: 45,
        bottom: 25,
        right: 5
      },
      maxY: 10,
      refreshRate: 0,
      ticksY: 3,
      y: "y",
      yFormat: ValueTypes.PERCENTAGE
    };
  },

  componentWillMount: function () {
    this.internalStorage_set({
      clipPathID: _.uniqueId("clip"),
      maskID: _.uniqueId("mask")
    });
  },

  componentDidMount: function () {
    var props = this.props;
    var height = this.getHeight(props);
    var width = this.getWidth(props);
    var maskID = this.internalStorage_get().maskID;

    this.renderAxis(props, width, height);
    this.createClipPath(width, height);

    // React doesn't allow us to set the 'mask' attribute through JSX
    // so we do this.
    this.refs.masking.getDOMNode().setAttribute("mask", "url(#" + maskID + ")");
  },

  shouldComponentUpdate: function (nextProps) {
    var props = this.props;

    // The d3 axis helper requires a <g> element passed into do its work. This
    // happens after mount and ends up keeping the axis code outside of react
    // unfortunately.
    // If non `data` props change then we need to update the whole graph
    if (!_.isEqual(_.omit(props, "data"), _.omit(nextProps, "data"))) {
      var height = this.getHeight(nextProps);
      var width = this.getWidth(nextProps);

      this.renderAxis(nextProps, width, height);
      return true;
    }

    // This won't be scalable if we decide to stack graphs
    var prevVal = _.first(props.data).values;
    var nextVal = _.first(nextProps.data).values;

    var prevY = _.pluck(prevVal, props.y);
    var nextY = _.pluck(nextVal, props.y);

    return !_.isEqual(prevY, nextY) || !_.isEqual(prevVal, nextVal);
  },

  componentDidUpdate: function () {
    var props = this.props;
    var height = this.getHeight(props);
    var width = this.getWidth(props);
    var xTimeScale = this.getXTimeScale(props.data, width);

    this.createUnsuccessfulBlocks(_.first(props.data).values, xTimeScale);
    this.updateClipPath(width, height);
  },

  createClipPath: function (width, height) {
    var data = this.internalStorage_get();
    var el = this.refs.movingEls.getDOMNode();

    // create clip path for areas and x-axis
    d3.select(el)
      .append("defs")
      .append("clipPath")
        .attr("id", data.clipPathID)
        .append("rect");

    this.updateClipPath(width, height);
  },

  createUnsuccessfulBlocks: function (data, xTimeScale) {
    let transitionTime = this.getTransitionTime(data);
    let nextY = this.getNextXPosition(data, xTimeScale, transitionTime);
    let props = this.props;
    let width = props.width / 31;
    let height = props.height;
    let maskDef = this.refs.maskDef.getDOMNode();

    d3.select(maskDef).selectAll(".unsuccessfulBlock").remove();

    data.forEach(function (obj) {
      if (obj[props.y] == null) {
        let x = xTimeScale(obj.date - props.refreshRate);
        d3.select(maskDef)
          .append("rect")
          .attr({
            width,
            height,
            x,
            y: 0,
            fill: "black",
            class: "unsuccessfulBlock"
          })
          .transition()
          .duration(props.refreshRate)
          .ease("linear")
          .attr("transform", "translate(" + -nextY + ", 0)");
      }
    });
  },

  updateClipPath: function (width, height) {
    var data = this.internalStorage_get();

    d3.select("#" + data.clipPathID + " rect")
      .attr({
        width: width,
        height: height
      });
  },

  getArea: function (y, xTimeScale, yScale, firstSuccessful) {
    var value = firstSuccessful[y] || 0;
    var successfulValue = yScale(value);

    return d3.svg.area()
      .x(function (d) { return xTimeScale(d.date); })
      .y0(function () { return yScale(0); })
      .y1(function (d) {
        if (d[y] != null) {
          successfulValue = yScale(d[y]);
        }

        return successfulValue;
      })
      .interpolate("monotone");
  },

  getValueLine: function (xTimeScale, yScale, firstSuccessful) {
    var y = this.props.y;
    var value = firstSuccessful[y] || 0;
    var successfulValue = yScale(value);

    return d3.svg.line()
      .x(function (d) { return xTimeScale(d.date); })
      .y(function (d) {
        if (d[y] != null) {
          successfulValue = yScale(d[y]);
        }

        return successfulValue;
      })
      .interpolate("monotone");
  },

  getXTickValues: function (xScale) {
    var domain = xScale.domain();
    var mean = Maths.mean(domain);

    return [domain[0], mean, domain[domain.length - 1]];
  },

  getXTimeScale: function (data, width) {
    var date = Date.now();
    var dateDelta = Date.now();

    var firstDataSet = _.first(data);
    if (firstDataSet != null) {
      var hiddenValuesCount = 1;
      var values = firstDataSet.values;
      // [first date, last date - 1]
      // Ristrict x domain to have one extra point outside of graph area,
      // since we are animating the graph in from right
      date = _.first(values).date;
      dateDelta = values[values.length - 1 - hiddenValuesCount].date;
    }

    return d3.time.scale()
      .range([0, width])
      .domain([date, dateDelta]);
  },

  getYScale: function (height, maxY) {
    return d3.scale.linear()
      // give a little space in the top for the number
      .range([height, 0])
      .domain([0, maxY]);
  },

  getYCaption: function (yFormat) {
    if (yFormat === ValueTypes.PERCENTAGE) {
      return "%";
    }
    return "";
  },

  formatYAxis: function (props) {
    var maxY = props.maxY;
    var ticksY = props.ticksY;
    var yFormat = props.yFormat;

    if (yFormat === ValueTypes.PERCENTAGE) {
      var formatPercent = d3.scale.linear().tickFormat(
        ticksY,
        ".0" + this.getYCaption(yFormat)
      );

      return function (d) {
        if (d >= maxY) {
          return "100%";
        }

        return formatPercent(d / maxY);
      };
    }

    return function (d) {
      if (d >= maxY) {
        return maxY;
      }

      return d;
    };
  },

  renderAxis: function (props, width, height) {
    var xScale = this.getXScale(props.data, width, props.refreshRate);
    var yScale = this.getYScale(height, props.maxY);

    var xAxis = d3.svg.axis()
      .scale(xScale)
      .tickValues(this.getXTickValues(xScale))
      .tickFormat(this.formatXAxis)
      .orient("bottom");
    d3.select(this.refs.xAxis.getDOMNode()).interrupt()
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

    var yAxis = d3.svg.axis()
      .scale(yScale)
      .ticks(props.ticksY)
      .tickFormat(this.formatYAxis(props))
      .orient("left");
    d3.select(this.refs.yAxis.getDOMNode())
      .call(yAxis);

    d3.select(this.refs.grid.getDOMNode())
      .call(
        d3.svg.axis().scale(yScale)
          .orient("left")
          .ticks(props.ticksY)
          .tickSize(-width, 0, 0)
          .tickFormat("")
      );
  },

  getTransitionTime: function (data) {
    // look at the difference between the last and the third last point
    // to calculate transition time
    var l = data.length - 1;
    return (data[l].date - data[l - 1].date) / 1;
  },

  /*
   * Returns the x position of the data point that we are about to animate in
   */
  getNextXPosition: function (values, xTimeScale, transitionTime) {
    var firstDataSet = _.first(values);
    var date = Date.now();

    if (firstDataSet != null) {
      date = firstDataSet.date;
    }

    // add transition time since we are moving towards new pos
    return xTimeScale(date + transitionTime);
  },

  /*
   * Returns the y position of the data point that we are about to animate in
   */
  getNextYPosition: function (obj, y, yScale, height) {
    var lastestDataPoint = _.last(obj.values);

    // most recent y - height of chart
    return yScale(lastestDataPoint[y]) - height;
  },

  getAreaList: function (props, yScale, xTimeScale) {
    var firstSuccess = _.find(props.data[0].values, function (obj) {
      return obj[props.y] != null;
    }) || {};
    var area = this.getArea(props.y, xTimeScale, yScale, firstSuccess);
    var valueLine = this.getValueLine(xTimeScale, yScale, firstSuccess);

    return _.map(props.data, function (obj, i) {
      var transitionTime = this.getTransitionTime(obj.values);
      var nextY = this.getNextXPosition(obj.values, xTimeScale, transitionTime);

      return (
        <TimeSeriesArea
          className={"path-color-" + obj.colorIndex}
          key={i}
          line={valueLine(obj.values)}
          path={area(obj.values)}
          position={[-nextY, 0]}
          transitionTime={transitionTime} />
      );
    }, this);
  },

  getCircleList: function (props, yScale, width, height) {
    return _.map(props.data, function (obj, i) {
      var transitionTime = this.getTransitionTime(obj.values);
      var lastObj = _.last(obj.values);

      if (lastObj[props.y] == null) {
        return null;
      }

      var nextX = this.getNextYPosition(obj, props.y, yScale, height);

      return (
        <AnimationCircle
          className={"arc path-color-" + obj.colorIndex}
          cx={width}
          cy={height}
          key={i}
          position={[0, nextX]}
          transitionTime={transitionTime} />
      );
    }, this);
  },

  getBoundingBox: function (props) {
    var margin = props.margin;

    return function () {
      var el = this.getDOMNode();
      var elPosition = el.getBoundingClientRect();

      return {
        top: elPosition.top + margin.top,
        right: elPosition.left + props.width - margin.right,
        bottom: elPosition.top + props.height - margin.bottom,
        left: elPosition.left + margin.left
      };
    }.bind(this);
  },

  addMouseHandler: function (handleMouseMove, handleMouseOut) {
    var el = this.getDOMNode();
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseout", handleMouseOut);
  },

  removeMouseHandler: function (handleMouseMove, handleMouseOut) {
    var el = this.getDOMNode();
    el.removeEventListener("mousemove", handleMouseMove);
    el.removeEventListener("mouseout", handleMouseOut);
  },

  render: function () {
    var store = this.internalStorage_get();
    var props = this.props;
    var margin = props.margin;
    var height = this.getHeight(props);
    var width = this.getWidth(props);
    var xScale = this.getXScale(props.data, width, props.refreshRate);
    var xTimeScale = this.getXTimeScale(props.data, width);
    var yScale = this.getYScale(height, props.maxY);
    var clipPath = "url(#" + store.clipPathID + ")";

    return (
      <div className="timeseries-chart">
        <svg height={props.height} width={props.width}>
          <g transform={"translate(" + margin.left + "," + margin.top + ")"}>
            <ChartStripes
              count={4}
              height={height}
              width={width} />
            <g className="bars grid-graph" ref="grid" />
            <g className="y axis" ref="yAxis" />
            <g className="x axis" ref="xAxis" />
            <TimeSeriesMouseOver
              addMouseHandler={this.addMouseHandler}
              data={props.data}
              getBoundingBox={this.getBoundingBox(props)}
              height={height}
              removeMouseHandler={this.removeMouseHandler}
              width={width}
              xScale={xScale}
              y={props.y}
              yCaption={this.getYCaption(props.yFormat)}
              yScale={yScale} />
          </g>
        </svg>

        <svg height={props.height} width={props.width} ref="movingEls" className="moving-elements">
          <g transform={"translate(" + margin.left + "," + margin.top + ")"}>
            <g ref="masking" clipPath={clipPath}>
              {this.getAreaList(props, yScale, xTimeScale)}
            </g>
            {this.getCircleList(props, yScale, width, height)}
          </g>
          <defs>
            <mask ref="maskDef" id={store.maskID}>
              <rect x="0" y="0" width={width} height={height} fill="white" />
            </mask>
          </defs>
        </svg>
      </div>
    );
  }
});

module.exports = TimeSeriesChart;
