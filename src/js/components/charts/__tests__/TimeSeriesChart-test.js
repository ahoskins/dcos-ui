jest.dontMock('../TimeSeriesChart');
jest.dontMock('../../../mixins/ChartMixin');
jest.dontMock('../../../mixins/InternalStorageMixin');

var _ = require('underscore');
var React = require('react');
var ReactDOM = require('react-dom');

var TimeSeriesChart = require('../TimeSeriesChart');

describe('TimeSeriesChart', function () {

  describe('#shouldComponentUpdate', function () {

    beforeEach(function () {
      var data = [{values: [{date: 0, y: 0}, {date: 1, y: 0}]}];

      this.container = document.createElement('div');
      this.instance = ReactDOM.render(
        <TimeSeriesChart data={data} width={0} height={0} />,
        this.container
      );
      this.instance.renderAxis = jasmine.createSpy();
    });

    afterEach(function () {
      ReactDOM.unmountComponentAtNode(this.container);
    });

    it('should call #renderAxis', function () {
      var props = _.extend({foo: 'bar'}, this.instance.props);
      this.instance.shouldComponentUpdate(props);

      expect(this.instance.renderAxis).toHaveBeenCalled();
    });

    it('should not call #renderAxis', function () {
      this.instance.shouldComponentUpdate(
        this.instance.props
      );

      expect(this.instance.renderAxis).not.toHaveBeenCalled();
    });

    it('should return truthy', function () {
      var props = _.extend({foo: 'bar'}, this.instance.props);
      var _return = this.instance.shouldComponentUpdate(props);

      expect(_return).toEqual(true);
    });

    it('should return truthy', function () {
      var data = [{values:
        [{date: 0, y: 0}, {date: 1, y: 0}, {date: 2, y: 0}]
      }];
      var props = _.defaults({data: data}, this.instance.props);
      var _return = this.instance.shouldComponentUpdate(props);

      expect(_return).toEqual(true);
    });

    it('should return falsy', function () {
      var _return = this.instance.shouldComponentUpdate(this.instance.props);

      expect(_return).toEqual(false);
    });

  });

});
