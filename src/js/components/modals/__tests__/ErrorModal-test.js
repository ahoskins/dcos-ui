jest.dontMock('../ErrorModal');
jest.dontMock('../../../utils/DOMUtils');

var React = require('react');
var ReactDOM = require('react-dom');

var ErrorModal = require('../ErrorModal');

describe('ErrorModal', function () {

  describe('#onClose', function () {
    beforeEach(function () {
      this.callback = jasmine.createSpy();
      this.container = document.createElement('div');
      this.instance = ReactDOM.render(
        <ErrorModal
          onClose={this.callback} />,
        this.container
      );
    });

    afterEach(function () {
      ReactDOM.unmountComponentAtNode(this.container);
    });

    it('shouldn\'t call the callback after initialization', function () {
      expect(this.callback).not.toHaveBeenCalled();
    });

    it('should call the callback when #onClose is called', function () {
      this.instance.onClose();
      expect(this.callback).toHaveBeenCalled();
    });

  });

});
