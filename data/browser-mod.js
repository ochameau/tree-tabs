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
newContainer.insertBefore(newToolbox, nextChild);

// Add a splitter
let newSplitter = document.createElement('splitter');
newContainer.insertBefore(newSplitter, nextChild);

// Change tabs orientation
tabsToolbar.setAttribute("orient", "vertical");
let orientBox = document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
if (orientBox)
  orientBox.setAttribute("orient","vertical");
else
  console.error("unable to found orientbox");

// Disable tabs width animation because its weird and buggy in vertical
window.Services.prefs.setBoolPref("browser.tabs.animate", false);

// Overload XBL methods in order to make Drag'n Drop work:
tabs._getDragTargetTab = function _getDragTargetTabTTOverload (event) {
  let tab = event.target.localName == "tab" ? event.target : null;
  if (tab &&
     (event.type == "drop" || event.type == "dragover") &&
      event.dataTransfer.dropEffect == "link") {
   let boxObject = tab.boxObject;
   if (event.screenY < boxObject.screenY + boxObject.height * .25 ||
       event.screenY > boxObject.screenY + boxObject.height * .75)
     return null;
  }
  return tab;
};

tabs._getDropIndex = function _getDropIndexTTOverload (event) {
  var tabs = this.childNodes;
  var tab = this._getDragTargetTab(event);
  if (window.getComputedStyle(this, null).direction == "ltr") {
   for (let i = tab ? tab._tPos : 0; i < tabs.length; i++)
     if (event.screenY < tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2)
       return i;
  } else {
   for (let i = tab ? tab._tPos : 0; i < tabs.length; i++)
     if (event.screenY > tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2)
       return i;
  }
  return tabs.length;
};

tabs._setEffectAllowedForDataTransfer = function _setEffectAllowedForDataTransferTTOverload (event) {
  var dt = event.dataTransfer;
  // Disallow dropping multiple items
  if (dt.mozItemCount > 1)
    return dt.effectAllowed = "none";

  var types = dt.mozTypesAt(0);
  var sourceNode = null;
  // tabs are always added as the first type
  if (types[0] == TAB_DROP_TYPE) {
    var sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (sourceNode instanceof XULElement &&
        sourceNode.localName == "tab" &&
        (sourceNode.parentNode == this ||
         (sourceNode.ownerDocument.defaultView instanceof ChromeWindow &&
          sourceNode.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser"))) {
      if (sourceNode.parentNode == this &&
          (event.screenY >= sourceNode.boxObject.screenY &&
            event.screenY <= (sourceNode.boxObject.screenY +
                               sourceNode.boxObject.height))) {
        return dt.effectAllowed = "none";
      }

      return dt.effectAllowed = "copyMove";
    }
  }

  if (browserDragAndDrop.canDropLink(event)) {
    // Here we need to do this manually
    return dt.effectAllowed = dt.dropEffect = "link";
  }
  return dt.effectAllowed = "none";
};

function dragOverEvent(event) {
  var effects = this._setEffectAllowedForDataTransfer(event);

  var ind = this._tabDropIndicator;
  if (effects == "" || effects == "none") {
    ind.collapsed = true;
    this._continueScroll(event);
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  var tabStrip = this.mTabstrip;
  var ltr = true;

  // autoscroll the tab strip if we drag over the scroll
  // buttons, even if we aren't dragging a tab, but then
  // return to avoid drawing the drop indicator
  var pixelsToScroll = 0;
  if (this.getAttribute("overflow") == "true") {
    var targetAnonid = event.originalTarget.getAttribute("anonid");
    switch (targetAnonid) {
      case "scrollbutton-up":
        pixelsToScroll = tabStrip.scrollIncrement * -1;
        break;
      case "scrollbutton-down":
        pixelsToScroll = tabStrip.scrollIncrement;
        break;
    }
    if (pixelsToScroll)
      tabStrip.scrollByPixels((ltr ? 1 : -1) * pixelsToScroll);
  }

  if (effects == "link") {
    let tab = this._getDragTargetTab(event);
    if (tab) {
      if (!this._dragTime)
        this._dragTime = Date.now();
      if (Date.now() >= this._dragTime + this._dragOverDelay)
        this.selectedItem = tab;
      ind.collapsed = true;
      return;
    }
  }

  var newIndex = this._getDropIndex(event);
  var scrollRect = tabStrip.scrollClientRect;
  var rect = this.getBoundingClientRect();
  var minMargin = scrollRect.top - rect.top;
  var maxMargin = Math.min(minMargin + scrollRect.height,
                           scrollRect.bottom);
  if (!ltr)
    [minMargin, maxMargin] = [this.clientHeight - maxMargin,
                              this.clientHeight - minMargin];
  var newMargin;
  if (pixelsToScroll) {
    // if we are scrolling, put the drop indicator at the edge
    // so that it doesn't jump while scrolling
    newMargin = (pixelsToScroll > 0) ? maxMargin : minMargin;
  }
  else {
    if (newIndex == this.childNodes.length) {
      let tabRect = this.childNodes[newIndex-1].getBoundingClientRect();
      if (ltr)
        newMargin = tabRect.bottom - rect.top;
      else
        newMargin = rect.bottom - tabRect.top;
    }
    else {
      let tabRect = this.childNodes[newIndex].getBoundingClientRect();
      if (ltr)
        newMargin = tabRect.top - rect.top;
      else
        newMargin = rect.bottom - tabRect.bottom;
    }
  }

  ind.collapsed = false;

  newMargin -= ind.clientHeight / 2;
  if (!ltr)
    newMargin *= -1;
  newMargin -= this.clientHeight;
  
  ind.style.MozTransform = "translate(" + this.clientWidth + "px, " + Math.round(newMargin) + "px) rotate(-90deg)";
  ind.style.marginLeft = (-ind.clientWidth) + "px";
}

tabs.addEventListener("dragover", function (event) {
  try {
    dragOverEvent.call(tabs, event);
    // Avoid XBL dragover handler call
    event.stopPropagation();
  } catch(e) {
    console.exception(e);
  }
}, true);


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
  _tabs : {}, // List of all tabs keyed by tab-id
  _children : {}, // List of all children tabs keyed by tab-id
  
  init : function init() {
    let gBrowser = window.gBrowser;
    if (!gBrowser) return;
    this._onTabOpen = this._onTabOpen.bind(this);
    this._onTabMove = this._onTabMove.bind(this);
    this._onTabClose = this._onTabClose.bind(this);
    
    // Listen to tab events
    let container = gBrowser.tabContainer;  
    container.addEventListener("TabOpen", this._onTabOpen, false);
    container.addEventListener("TabMove", this._onTabMove, false);
    container.addEventListener("TabClose", this._onTabClose, false);
    
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
    container.removeEventListener("TabMove", this._onTabMove, false);
    container.removeEventListener("TabClose", this._onTabClose, false);
  },
  
  _onTabOpen : function onTabOpen(event) {
    let tab = event.target;
    console.log("tab open");
    
    // 1/ Session store restore
    let parentTab = this.getParentTab(tab);
    if (parentTab) {
      console.log("session");
      this._tabOpenedFrom(parentTab, tab);
      return;
    }
  
    // 2/ Brand new tab
    let gBrowser = tab.ownerDocument.defaultView.gBrowser;
    let currentTab = gBrowser.selectedTab;
    if (currentTab && currentTab != tab) {
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
    let parentId = this.getTabId(opener);
    SessionStore.setTabValue(tab, "parent-tab-id", parentId);
    console.log("set parent for "+tab.linkedPanel+" to "+(opener?opener.linkedPanel:null));
    
    if (!this._children[parentId])
      this._children[parentId] = [];
    this._children[parentId].push(tab);
    
    if (typeof this.onTabOpen == "function")
      this.onTabOpen(opener, tab);
    console.log("send tab-open");
  },
  
  _onTabMove : function onTabMove(event) {
    let tab = event.target;
    if (this.ignoreTabMove) return;
    console.log("tab move : "+tab.linkedPanel+" -- "+tab.previousSibling);
    try {
    // Search for previous parent tab
    let previousParentTab = this.getParentTab(tab);
    
    // Search for the new parent tab
    let newParentTab = tab.previousSibling ? tab.previousSibling : null;
    
    if (typeof this.onTabMove == "function")
      this.onTabMove(previousParentTab, newParentTab, tab);
    
    // Remove previous children entry and create a new one
    let children = this._children[this.getTabId(previousParentTab)];
    if (children)
      children.splice(children.indexOf(tab), 1);
    if (newParentTab)
      this._children[this.getTabId(newParentTab)].push(tab);
    
    } catch(e) {
    console.log(e);
    }
  },
  
  moveTab: function moveTab(tab, pos) {
    let gBrowser = tab.ownerDocument.defaultView.gBrowser;
    this.ignoreTabMove = true;
    gBrowser.moveTabTo(tab, pos);
    this.ignoreTabMove = false;
  },
  
  _onTabClose : function onTabClose(event) {
    let tab = event.target;
    console.log("tab close");
    
    if (typeof this.onTabClose == "function")
      this.onTabClose(this.getParentTab(tab), tab);
    
    let id = this.getTabId(tab);
    delete this._tabs[id];
    let parent = this.getParentTab(tab);
    if (parent) {
      let children = this._children[this.getTabId(parent)];
      if (children)
        children.splice(children.indexOf(tab), 1);
    }
  },
  
  _count: 1,
  
  getTabId : function (tab) {
    if (!tab) return "";
    let id = SessionStore.getTabValue(tab, "TT_id");
    this._tabs[id] = tab;
    if (id) return id;
    id = new Date().getTime() + "_" + (this._count++);
    SessionStore.setTabValue(tab, "TT_id", id);
    console.log("set tab "+tab.linkedPanel+" to "+id);
    this._tabs[id] = tab;
    return id;
  },
  
  getTabWithId : function (id) {
    return this._tabs[id];
  },
  
  getParentTab : function (tab) {
    let parentTabId = SessionStore.getTabValue(tab, "parent-tab-id");
    if (parentTabId)
      return this.getTabWithId(parentTabId);
    return null;
  },
  
  getChildrenFor : function (tab) {
    return this._children[this.getTabId(tab)];
  }
  
};


function getMarginForLevel(level) {
  return level * 5;
}
function updateTabStyle(tab) {
  tab.style.marginLeft = getMarginForLevel(tab.__TT_level) + "px";
  console.log("margin : "+tab.style.marginLeft);
}

ChromeTabsWithOpener.onTabOpen = function onTabOpen(parentTab, tab) {
  console.log("final tab open");
  //if (tab.linkedBrowser.currentURI.spec == "about:blank") return;
  tab.__TT_level = parentTab ? parentTab.__TT_level + 1 : 0;
  updateTabStyle(tab);
  if (parentTab)
    tab.ownerDocument.defaultView.gBrowser.moveTabTo(tab, parentTab._tPos + 1);
  
};

ChromeTabsWithOpener.onTabMove = function onTabMove(oldParentTab, newParentTab, tab) {
  console.log("move..."+oldParentTab+" -> "+newParentTab);
  // Update the tab that has been moved
  let oldLevel = tab.__TT_level;
  tab.__TT_level = newParentTab ? newParentTab.__TT_level + 1 : 0;
  updateTabStyle(tab);
  
  let diffLevel = tab.__TT_level - oldLevel;
  let inside = false;
  
  // Check if we move a tab into one of its childs!
  let parent = newParentTab;
  while(parent) {
    console.log("parent > "+parent.linkedPanel);
    if (parent == tab) {
      console.log("Move parent into one of its childs!");
      tab.__TT_level = newParentTab.__TT_level;
      updateTabStyle(tab);
      diffLevel = -1;
      inside = true;
      break;
    }
    parent = this.getParentTab(parent);
  }
  
  console.log("diff : "+diffLevel);
  
  // Update its previous children
  let self = this;
  function updateChildren(tab) {
    let children = self.getChildrenFor(tab);
    if (children) {
      let firstPos = tab._tPos;
      
      for (let i = 0, l = children.length; i < l; i++) {
        let child = children[i];
        child.__TT_level += diffLevel;
        updateTabStyle(child);
        if (!inside)
          self.moveTab(child, firstPos + 1 + i);
        //updateChildren(child);
      }
    }
  }
  
  updateChildren(tab);

}

ChromeTabsWithOpener.onTabClose = function onTabClose(parentTab, tab) {
  console.log("close...");
  // Update children level and position
  let level = tab.__TT_level;
  let next = tab.nextSibling;
  while(next && next.__TT_level > level) {
    next.__TT_level = Math.max(0, next.__TT_level - 1);
    updateTabStyle(next);
    next = next.nextSibling;
  }
};

ChromeTabsWithOpener.init();