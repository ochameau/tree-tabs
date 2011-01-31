const { Cc, Ci, Cr } = require('chrome');
const { Trait } = require('traits');
const { WindowTracker, windowIterator } = require('window-utils');
const { EventEmitter } = require('events');

const { ChromeMod } = require("chrome-mod");
console.log(require("self").data.url("browser-mod.js"));

let cm = new ChromeMod({
  type: "navigator:browser",
  
  contentScriptFile: require("self").data.url("browser-mod.js"),
  contentScript: 'new ' + function WorkerScope() {
    self.on('message', function (data) {
      // Register custom css file
      // Alternative: https://developer.mozilla.org/en/Using_the_Stylesheet_Service
      if (data.msg=="css") {
        var stylepi = document.createProcessingInstruction(
          'xml-stylesheet', 
          'href="'+data.url+'" type="text/css"');
        document.insertBefore(stylepi, document.documentElement)
      }
    });
  },
  onAttach: function(worker) {
    /*worker.on("message", function (data) {
      
    });*/
    worker.postMessage({ msg: "css", url: require("self").data.url('browser.css') });
  }
});
