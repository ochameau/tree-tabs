/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack Packages.
 *
 * The Initial Developer of the Original Code is Nickolay Ponomarev.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alexandre Poirot <poirot.alex@gmail.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

const { Worker, Loader } = require('content');
const { EventEmitter } = require('events');
const { WindowTrackerTrait, windowIterator } = require('window-utils');


/**
 * ChromeMod constructor
 * @constructor
 */
exports.ChromeMod = Loader.compose(EventEmitter, {
  on: EventEmitter.required,
  _listeners: EventEmitter.required,
  contentScript: Loader.required,
  contentScriptFile: Loader.required,
  contentScriptWhen: Loader.required,
  include: null,
  type: null,
  id: null,
  constructor: function ChromeMod(options) {
    this._onNewWindow = this._onNewWindow.bind(this);
    this._onUncaughtError = this._onUncaughtError.bind(this);
    options = options || {};

    if ('contentScript' in options)
      this.contentScript = options.contentScript;
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScriptWhen' in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ('onAttach' in options)
      this.on('attach', options.onAttach);
    if ('onError' in options)
      this.on('error', options.onError);
    
    function normalize(strOrArray) {
      if (Array.isArray(strOrArray))
        return strOrArray;
      else if (strOrArray)
        return [strOrArray];
      else
        return [];
    }
    this.include = normalize(options.include);
    this.type = normalize(options.type);
    this.id = normalize(options.id);
    
    chromeModManager.on("new-window", this._onNewWindow);
  },
  
  destroy: function destroy() {
    chromeModManager.removeListener("new-window", this._onNewWindow);
  },
  
  _compareStringWithArrayOfStringRegexp : function(array, str) {
    // Accept any on wild card
    if (array.length==1 && array[0]=="*") return true;
    // Attribute may be null, we should not accept them.
    if (!str) return false;
    for(let i=0, l=array.length; i<l; i++) {
      let rule = array[i];
      if (typeof rule=="RegExp" && rule.test(str))
        return true;
      else if (typeof rule=="string" && rule==str)
        return true;
    }
    return false;
  },
  
  _onNewWindow: function _onNewWindow(window) {
    // Match windows either on document location, window type or window id
    if (!this._compareStringWithArrayOfStringRegexp(this.include, 
          window.document.location.href) &&
        !this._compareStringWithArrayOfStringRegexp(this.type,
          window.document.documentElement.getAttribute("windowtype")) &&
        !this._compareStringWithArrayOfStringRegexp(this.id,
          window.document.documentElement.getAttribute("id")) ) 
      return;
    
    this._emit('attach', Worker({
      window: window.wrappedJSObject,
      contentScript: this.contentScript,
      contentScriptFile: this.contentScriptFile,
      onError: this._onUncaughtError
    }));
  },
  
  _onUncaughtError: function _onUncaughtError(e) {
    if (this._listeners('error').length == 0)
      console.exception(e);
    //else
    //  this._emit("error", e);
  }
});

const ChromeModManager = 
  WindowTrackerTrait.resolve({ 
    constructor: '_initTracker' 
  }).compose(
  EventEmitter.resolve({
    on: '_on'
  }), {
  constructor: function PageModRegistry() {
    this._initTracker();
  },
  
  _destructor: function _destructor() {
    // Empty EventEmitter
    this._removeAllListeners();
  },
  
  _onTrack: function _onTrack(chromeWindow) {
    this._emit("new-window",chromeWindow);
  },
  
  _onUntrack: function _onUntrack(chromeWindow) {
    
  },
  
  on: function (name, callback) {
    this._on(name, callback);
    if (name!="new-window") return;
    
    // Emit all existing windows on listener registration
    for (window in windowIterator()) {
      callback(window);
    }
  }
});

const chromeModManager = ChromeModManager();
