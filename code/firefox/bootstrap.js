const { classes: Cc, interfaces: Ci, utils: Cu, manager: Cm } = Components;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/AddonManager.jsm');

const EXTENSION_ID = 'ancho@salsitasoft.com';

// Create background part of the extension (window object). The
// background script is loaded separately using the window for its context
// so that it will have access to our CommonJS functionality and
// extension API.
var backgroundWindow = null;
var xulWindow = null;

// require function created at startup()
var require = null;

function createBackground() {

  backgroundWindow = Services.ww.openWindow(
    null, // parent
    'chrome://ancho/content/xul/background.xul',
    null, // window name
    null, // features
    null  // extra arguments
  );

  xulWindow = backgroundWindow.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation)
    .QueryInterface(Ci.nsIDocShellTreeItem)
    .treeOwner
    .QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIXULWindow);

  xulWindow.QueryInterface(Ci.nsIBaseWindow).visibility = false;

  // Unregister our hidden window so it doesn't appear in the Window menu.
  backgroundWindow.addEventListener('load', function(event) {
    backgroundWindow.removeEventListener('load', arguments.callee, false);
    Services.appShell.unregisterTopLevelWindow(xulWindow);
  }, false);

  // Tell Gecko that we closed the window already so it doesn't hold Firefox open
  // if all other windows are closed.
  Services.startup.QueryInterface(Ci.nsIObserver).observe(null, 'xul-window-destroyed', null);
}

// Revert all visual additions, unregister all observers and handlers. All this
// is done in the background window handler, so we simply close the window...
//
function releaseBackground() {
  if (xulWindow) {
    // Register the window again so that the window count remains accurate.
    // Otherwise the window mediator will think we have one less window than we really do.
    Services.startup.QueryInterface(Ci.nsIObserver).observe(xulWindow, 'xul-window-registered', null);
  }

  if (backgroundWindow) {
    backgroundWindow.close();
    backgroundWindow = null;
  }
}

function setResourceSubstitution(addon) {
  // Create a resource:// URL substitution so that we can access files
  // in the extension directly.
  var resourceProtocol = Services.io.getProtocolHandler('resource').
    QueryInterface(Ci.nsIResProtocolHandler);
  resourceProtocol.setSubstitution('ancho', addon.getResourceURI('/'));
}

function resetResourceSubstitution() {
  var resourceProtocol = Services.io.getProtocolHandler('resource').
    QueryInterface(Ci.nsIResProtocolHandler);
  resourceProtocol.setSubstitution('ancho', null);
}

function loadConfig(addon, firstRun) {
  // Load the manifest
  Cu.import('resource://ancho/modules/Require.jsm');

  var baseURI = Services.io.newURI('resource://ancho/', '', null);
  require = Require.createRequireForWindow(this, baseURI);

  var extensionState = require('./js/state');
  extensionState.id = EXTENSION_ID;

  var Config = require('./js/config');
  Config.firstRun = firstRun;

  var readStringFromUrl = require('./js/utils').readStringFromUrl;
  var matchPatternToRegexp = require('./js/utils').matchPatternToRegexp;

  if (addon.hasResource('chrome-ext/manifest.json')) {
    var manifestUrl = addon.getResourceURI('chrome-ext/manifest.json');
    var manifestString = readStringFromUrl(manifestUrl);
    Config.manifest = JSON.parse(manifestString);
    var i, j;
    if ('content_scripts' in Config.manifest) {
      for (i=0; i<Config.manifest.content_scripts.length; i++) {
        var scriptInfo = Config.manifest.content_scripts[i];
        for (j=0; j<scriptInfo.matches.length; j++) {
          // Convert from Google's simple wildcard syntax to a regular expression
          // TODO: Implement proper match pattern matcher.
          scriptInfo.matches[j] = matchPatternToRegexp(scriptInfo.matches[j]);
        }
      }
    }
    if ('web_accessible_resources' in Config.manifest) {
      for (i=0; i<Config.manifest.web_accessible_resources.length; i++) {
        Config.manifest.web_accessible_resources[i] =
          matchPatternToRegexp(Config.manifest.web_accessible_resources[i]);
      }
    }
  }
}

function registerComponents(addon) {
  var protocolHandler = require('./js/protocolHandler');
  protocolHandler.register();

  // TODO: Make this generic so we can handle multiple Ancho addons.
  protocolHandler.registerExtensionURI('ancho', addon.getResourceURI('chrome-ext'));

  require('./js/contentPolicy').register();
  var extensionState = require('./js/state');
  require('./js/httpRequestObserver').register(extensionState, backgroundWindow);
}

function unregisterComponents(callback) {
  require('./js/protocolHandler').unregister();
  require('./js/contentPolicy').unregister(callback);
  require('./js/httpRequestObserver').unregister();
}

function unloadBackgroundScripts() {
  require('./js/config').contentScripts = [];
}

function closeStorageConnection() {
  var extensionState = require('./js/state');
  if (extensionState.storageConnection) {
    extensionState.storageConnection.asyncClose();
    extensionState.storageConnection = null;
  }
}

// Required functions for bootstrapped extensions.
function install(data, reason) {
}

function uninstall(data, reason) {
}

// When the extension is activated:
//
function startup(data, reason) {
  AddonManager.getAddonByID(EXTENSION_ID, function(addon) {
    setResourceSubstitution(addon);
    loadConfig(addon, (reason === ADDON_INSTALL || reason === ADDON_ENABLE));
    createBackground();
    registerComponents(addon);
  });
}

// When the extension is deactivated:
//
function shutdown(data, reason) {
  closeStorageConnection();
  unregisterComponents(function() {
    releaseBackground();
    unloadBackgroundScripts();
    // Unload the modules so that we will load new versions if the add-on is installed again.
    Cu.unload('resource://ancho/modules/Require.jsm');
    Cu.unload('resource://ancho/modules/External.jsm');
    // Get rid of the resource package substitution.
    resetResourceSubstitution();
  });
}
