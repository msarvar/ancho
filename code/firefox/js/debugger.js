(function() {

/*
   Client portion of Debugger API that provides access to events and methods.
   The actual implementation runs in the background window of the extension and
   fires the events. For the implementation, please see httpRequestObserver.js.
*/


  var Cc = Components.classes;
  var Ci = Components.interfaces;
  var Cu = Components.utils;

  Cu.import('resource://gre/modules/Services.jsm');

  var Event = require('./event');
  var Utils = require('./utils');
  var DebugData = require('./debuggerData');

  // register debugger protocol handlers (one for each domain):
  require('./debuggerNetwork').register();
  // add more...


  var DebuggerAPI = function(state, window) {
    this._state = state;
    this._tab = Utils.getWindowId(window);

    this.onEvent  = new Event(window, this._tab, this._state, 'debugger.event');
    this.onDetach = new Event(window, this._tab, this._state, 'debugger.detach');
  };

  DebuggerAPI.prototype = {

    attach: function(target, requiredVersion, callback) {
      DebugData.setProperty(target.tabId, 'protocol', requiredVersion);
      if ('function' === typeof(callback)) {
        callback();
      }
    },

    detach: function(target, callback) {
      if (DebugData.reset(target.tabId)) {
        this.onDetach.fire([ { tabId: target.tabId }, 'canceled_by_user' ]);
      }
      if ('function' === typeof(callback)) {
        callback();
      }
    },

    sendCommand: function(target, method, commandParams, callback) {
      // shift args if commandParams skipped
      if (typeof(commandParams) === 'function') {
        callback = commandParams;
        commandParams = null;
      }

      var parsed = method.split('.');
      if (!parsed || parsed.length !== 2) {
        dump('ERROR: unsupported debugger method "' + method + '".\n');
        return;
      }

      var _ref;
      if (_ref = DebugData.getHandler(parsed[0])) {
        _ref(target, parsed[1], commandParams, callback);
      } else {
        dump('ERROR: unsupported debugger domain "' + parsed[0] +'"\n');
      }
    }

  };

  module.exports = DebuggerAPI;

}).call(this);