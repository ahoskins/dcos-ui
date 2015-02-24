var ActionTypes = require("../constants/ActionTypes");
var AppDispatcher = require("../dispatcher/AppDispatcher");
var API_ROOT = "http://localhost:5050/master/state.json";
var $ = require("jquery");

var MesosStateActions = {
  fetch: function () {
    var url = API_ROOT + "?jsonp=?";

    $.getJSON(url, function (response) {
      AppDispatcher.handleServerAction({
        type: ActionTypes.REQUEST_MESOS_STATE,
        data: response
      });
    });
  },

  setFilterString: function (filterString) {
    AppDispatcher.dispatch({
      action: {
        type: ActionTypes.FILTER_SERVICES_BY_STRING,
        data: filterString
      }
    });
  },

  updateTransposed: function () {
    AppDispatcher.dispatch({
      action: {
        type: ActionTypes.REQUEST_MESOS_TRANSPOSED_STATE
      }
    });
  }
};

module.exports = MesosStateActions;
