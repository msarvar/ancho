/******************************************************************************
 * extension.js
 * Part of Ancho browser extension framework
 * Implements chrome.extension
 * Copyright 2012 Salsita software (http://www.salsitasoft.com).
 ******************************************************************************/

//******************************************************************************
//* requires
var Event = require("Event.js").Event;

var EventFactory = require("utils.js").EventFactory;

var EVENT_LIST = ['onConnect',
                  'onConnectExternal',
                  'onMessage',
                  'onMessageExternal'];
var API_NAME = 'extension';

var portPairs = {}
function addPortPair(pair, instanceID) {
  if (!portPairs[instanceID]) {
    portPairs[instanceID] = [];
  }
  portPairs[instanceID].push(pair);
}

function releasePorts(instanceID) {
  if (portPairs[instanceID]) {
    for (var i = 0; i < portPairs[instanceID].length; ++i) {
      portPairs[instanceID][i].release();
    }
    delete portPairs[instanceID];
  }
}

CallbackWrapper = function(responseCallback) {
  var self = this;
  this.called = false;

  this.responseCallback = responseCallback;

  this.callback = function() {
    return function() {
      if (self.called) {
        return;
      }
      self.called = true;
      try {
        addonAPI.callFunction(self.responseCallback, arguments); //Solve incompatible array constructors
      } catch (e) {
        console.error('responseCallback call failed - ' + self.responseCallback);
      }
    }
  } ();
}

//******************************************************************************
//* main closure
var Extension = function(instanceID) {
  //============================================================================
  // private variables
  _instanceID = instanceID;
  self = this;
  //============================================================================
  // public properties

  this.lastError = null;
  this.inIncognitoContext = null;

  this.MessageSender = function(aTab) {
    this.id = addonAPI.id;
    if (aTab) {
      this.tab = aTab; //optional
    }
  };

  this.Port = function(aName, aSender) {
    this.postMessage = function(msg) {
      if (otherPort) {
        otherPort.onMessage.fire(msg);
      }
    };
    this.otherPort = null;
    this.sender = aSender;
    this.onDisconnect = new Event('port.onDisconnect');
    this.onMessage = new Event('port.onMessage');
    this.name = aName;

    this.disconnect = function() {
      otherPort.onDisconnect.fire();
      otherPort = null;
    }
    this.release = function() {
      delete onDisconnect;
      delete onMessage;
    }
  };

  PortPair = function(aName, aMessageSender) {
    this.near = new self.Port(aName, aMessageSender);
    this.far = new self.Port(aName, aMessageSender);

    this.near.otherPort = this.far;
    this.far.otherPort = this.near;

    this.release = function() {
      this.near.disconnect();
      this.far.disconnect();
      this.near.release();
      this.far.release();
    }
  }



  //============================================================================
  // public methods

  //----------------------------------------------------------------------------
  // chrome.extension.connect
  //   returns   Port
  this.connect = function(extensionId, connectInfo) {
    var pair = new PortPair(connectInfo.name, new self.MessageSender());
    addPortPair(pair, _instanceID);
    if (extensionId && extensionId != addonAPI.id) {
      addonAPI.invokeExternalEventObject(
              extensionId,
              'extension.onConnectExternal',
              [pair.far]
              );
    } else {
      addonAPI.invokeEventObject(
              'extension.onConnect',
              [pair.far]
              );
    }
    console.debug("extension.connect(..) called");
    return pair.near;
  };

  //----------------------------------------------------------------------------
  // chrome.extension.getBackgroundPage
  //   returns   global
  this.getBackgroundPage = function() {
    console.debug("extension.getBackgroundPage(..) called");
  };

  //----------------------------------------------------------------------------
  // chrome.extension.getURL
  //   returns   string
  this.getURL = function(path) {
    //console.debug("extension.getURL(..) called");
    return 'chrome-extension://' + addonAPI.id + '/' + path;
  };

  //----------------------------------------------------------------------------
  // chrome.extension.getViews
  //   returns   array of global
  this.getViews = function(fetchProperties) {
    console.debug("extension.getViews(..) called");
  };

  //----------------------------------------------------------------------------
  // chrome.extension.isAllowedFileSchemeAccess
  this.isAllowedFileSchemeAccess = function(callback) {
    console.debug("extension.isAllowedFileSchemeAccess(..) called");
  };

  //----------------------------------------------------------------------------
  // chrome.extension.isAllowedIncognitoAccess
  this.isAllowedIncognitoAccess = function(callback) {
    console.debug("extension.isAllowedIncognitoAccess(..) called");
  };

  //----------------------------------------------------------------------------
  // chrome.extension.sendMessage
  this.sendMessage = function(extensionId, message, responseCallback) {
    console.debug("extension.sendMessage(..) called: " + message);
    sender = new self.MessageSender();
    callback = undefined;
    if (responseCallback) {
      callbackWrapper = new CallbackWrapper(responseCallback);
      callback = callbackWrapper.callback;
    }
    if (extensionId && extensionId != addonAPI.id) {
      addonAPI.invokeExternalEventObject(
            extensionId,
            'extension.onMessageExternal',
            [message, sender, callback]
            ); //TODO: fill tab to MessageSender
    } else {
      addonAPI.invokeEventObject(
            'extension.onMessage',
            _instanceID,
            [message, sender, callback]
            ); //TODO: fill tab to MessageSender
    }
  };

  //----------------------------------------------------------------------------
  // chrome.extension.setUpdateUrlData
  this.setUpdateUrlData = function(data) {
    console.debug("extension.setUpdateUrlData(..) called");
  };

  //============================================================================
  // events

  EventFactory.createEvents(this, instanceID, API_NAME, EVENT_LIST);
  //============================================================================
  //============================================================================
  // main initialization

}

exports.createAPI = function(instanceID) {
  return new Extension(instanceID);
}

exports.releaseAPI = function(instanceID) {
  EventFactory.releaseEvents(instanceID, API_NAME, EVENT_LIST);
  
  releasePorts(instanceID);
}
