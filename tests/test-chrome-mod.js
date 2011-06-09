"use strict";

var { Ci, Cc } = require("chrome");
var { ChromeMod } = require("chrome-mod");
var { windowIterator } = require("window-utils");

/* Tests for the ChromeMod APIs */

exports.testChromeMod = function(test) {
  test.waitUntilDone();
  
  let chromeMod = new ChromeMod({
      type: "navigator:browser",
      
      contentScript: 'new ' + function WorkerScope() {
        document.documentElement.setAttribute("chrome-mod-ok", "true");
        self.on("message", function (data) {
          if (data=="hi") self.postMessage("bye");
        });
      },
      
      onAttach: function(worker) {
        worker.on("message", function (data) {
          test.assertEqual(data, "bye", "get message from content script");
          // Search for this modified window
          for(let win in windowIterator()) {
            if (win.document.documentElement.getAttribute("chrome-mod-ok") == "true")
              return test.done();
          }
          test.fail("Unable to found the modified window, with 'chrome-mod-ok' attribute");
        });
        worker.postMessage("hi");
      }
    });
  
};
