let Cc = Components.classes, Ci = Components.interfaces;

// Move tabs from toolbar to side of content browser element
let tabs = document.getElementById('tabbrowser-tabs');
let tabsToolbar = document.getElementById('TabsToolbar');

// Create a new vertical toolbox on left of web content
// and add tabs toolbar into it
let newToolbox = document.createElement('toolbox');
newToolbox.id = 'vertical-tabs-toolbox';
newToolbox.appendChild(tabsToolbar);
let newContainer = document.getElementById('browser');
let nextChild = document.getElementById('appcontent'); // Big browser for content
newContainer.insertBefore(newToolbox,nextChild);

// Add a splitter
let newSplitter = document.createElement('splitter');
newContainer.insertBefore(newSplitter,nextChild);

// Change tabs orientation
tabsToolbar.setAttribute("orient","vertical");
let orientBox = document.getAnonymousElementByAttribute(tabs,'anonid','arrowscrollbox');
if (orientBox)
  orientBox.setAttribute("orient","vertical");
else
  console.error("unable to found orientbox");

// Disable tabs width animation because its weird and buggy in vertical
window.Services.prefs.setBoolPref("browser.tabs.animate",false);



// nsIWebProgressListener
function onTabLocationChange(tab, callback) {
  tab.linkedBrowser.webProgress.addProgressListener({
    QueryInterface: function(aIID) {
     if (aIID.equals(Ci.nsIWebProgressListener) ||
         aIID.equals(Ci.nsISupportsWeakReference) ||
         aIID.equals(Ci.nsISupports))
       return this;
     throw Cr.NS_NOINTERFACE;
    },
    onLocationChange: function(aProgress, aRequest, aURI) {
      console.log("onLocationChange");
      // Match only top level location change
      if (aProgress.DOMWindow != tab.linkedBrowser.contentWindow) return;
      callback(aURI);
      aProgress.removeProgressListener(this);
    },
    onStateChange: function(aProgress, aRequest, aFlag, aStatus){},
    onProgressChange: function() {return 0;},
    onStatusChange: function() {return 0;},
    onSecurityChange: function() {return 0;},
    onLinkIconAvailable: function() {return 0;}
  },
  Ci.nsIWebProgress.NOTIFY_ALL);
}

let SessionStore = Cc["@mozilla.org/browser/sessionstore;1"]
                      .getService(Ci.nsISessionStore);

let ChromeTabsWithOpener = {
  
  init : function init() {
    let gBrowser = window.gBrowser;
    if (!gBrowser) return;
    this._onTabOpen = this._onTabOpen.bind(this);
    
    // Listen to tab opening events
    let container = gBrowser.tabContainer;  
    container.addEventListener("TabOpen", this._onTabOpen, false);
    
    // Force processing of all already opened tabs
    for(let i=0; i<gBrowser.tabs.length; i++) {
      this._onTabOpen({target:gBrowser.tabs[i]});
    }
    
    window.addEventListener("unload", function () {
      ChromeTabsWithOpener.onWindowClose();
    }, false);
  },
  onWindowClose : function onWindowClose() {
    let container = window.gBrowser.tabContainer;
    container.removeEventListener("TabOpen", this._onTabOpen, false);
  },
  
  _onTabOpen : function onTabOpen(event) {
    let tab = event.target;
    console.log("tab open");
    
    // 1/ Session store restore
    let parentTabId = SessionStore.getTabValue(tab,"parent-tab-id");
    if (parentTabId) {
      console.log("session");
      this._tabOpenedFrom(this.getTabWithId(parentTabId), tab);
      return;
    }
  
    // 2/ Brand new tab
    let gBrowser = tab.ownerDocument.defaultView.gBrowser;
    let currentTab = gBrowser.selectedTab;
    if (currentTab && currentTab!=tab) {
      // 2.1/ The tab may just being opened, so it's still blank page
      // So wait for the first location change for this tab
      let self = this;
      onTabLocationChange(tab, function (aURI) {
        console.log("got late sub tab");
        self._tabOpenedFrom(currentTab, tab);
      });
      console.log("location change...");
      
    } else {
      // 3/ Usually the first opened tab, at browser launch
      // either no selected tab or new tab is already selected
      console.log("No selected tab or already selected");
      
      this._tabOpenedFrom(null, tab);
    }
  },
  
  _tabOpenedFrom : function (opener, tab) {
    // Store parent relation in session store service
    SessionStore.setTabValue(tab, "parent-tab-id", this.getTabId(opener));
    if (typeof this.onTabOpen=="function")
      this.onTabOpen(opener, tab);
    console.log("send tab-open");
  },
  
  _tabs : {},
  
  getTabId : function (tab) {
    if (!tab) return "";
    let id = SessionStore.getTabValue(tab, "TT_id");
    this._tabs[id] = tab;
    if (id) return id;
    id = new Date().getTime() + "_" + (this._tabs.length);
    SessionStore.setTabValue(tab, "TT_id", id);
    return id;
  },
  
  getTabWithId : function (id) {
    return this._tabs[id];
  }
  
};

ChromeTabsWithOpener.init();


ChromeTabsWithOpener.onTabOpen = function onTabOpen(parentTab, tab) {
  console.log("final tab open");
  if (tab.linkedBrowser.currentURI.spec=="about:blank") return;
  tab.__TT_margin = (parentTab.__TT_margin||0)+5;
  tab.style.marginLeft = tab.__TT_margin+"px";
  tab.ownerDocument.defaultView.gBrowser.moveTabTo(tab,parentTab._tPos+1);
};

ChromeTabsWithOpener.onTabClose = function onTabClose(openerTab, tab) {
  tab.style.marginLeft = "";
};
