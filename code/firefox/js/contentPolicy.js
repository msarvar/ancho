(function() {
  const { classes: Cc, interfaces: Ci, utils: Cu, manager: Cm } = Components;

  Cu.import('resource://gre/modules/NetUtil.jsm');
  Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  Cu.import('resource://gre/modules/Services.jsm');

  var config = require('./config');

  var classID = Components.ID('{d60ca65e-2ab6-4909-9d61-d7ac337a7056}');
  var contractID = '@salsitasoft.com/ancho/content-policy;1';
  var className = 'com.salsitasoft.ancho.contentPolicy';

  function isWebAccessible(path) {
    for (let i=0; i<config.webAccessibleResources.length; i++) {
      if (path.match(config.webAccessibleResources[i])) {
        return true;
      }
    }
    return false;
  }

  function AnchoContentPolicy() {
    this.systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
  }

  AnchoContentPolicy.prototype = {
    shouldLoad: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
      if (aRequestPrincipal && aRequestPrincipal !== this.systemPrincipal && aContentLocation.schemeIs('chrome-extension')) {
        if (!isWebAccessible(aContentLocation.path)) {
          return Ci.nsIContentPolicy.REJECT_REQUEST;
        }
      }
      return Ci.nsIContentPolicy.ACCEPT;
    },
    shouldProcess: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, aExtra, aRequestPrincipal) {
      return Ci.nsIContentPolicy.ACCEPT;
    },

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy]),

    classID: classID,
    contractID: contractID
  };

  var NSGetFactory = XPCOMUtils.generateNSGetFactory([AnchoContentPolicy]);
  var factory = NSGetFactory(classID);

  exports.register = function() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
      classID,
      className,
      contractID,
      factory
    );
    XPCOMUtils.categoryManager.addCategoryEntry('content-policy', className, contractID, false, true);
  };

  exports.unregister = function(callback) {
    XPCOMUtils.categoryManager.deleteCategoryEntry('content-policy', className, false);
    // We can't just unregister the component since deleteCategoryEntry occurs asynchronously.
    // If the component is unregistered by the time it runs, it leaves a dangling reference to it.
    // So we have to wait until the category is really removed.
    Services.tm.mainThread.dispatch(function() {
      Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(classID, factory);
      callback();
    }, Ci.nsIThread.DISPATCH_NORMAL);
  };
}).call(this);
