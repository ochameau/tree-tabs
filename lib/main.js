const { ChromeMod } = require("chrome-mod");

ChromeMod({
  type: "navigator:browser",

  contentScriptFile: require("sdk/self").data.url("browser-mod.js"),
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
    worker.postMessage({
      msg: "css",
      url: require("sdk/self").data.url('browser.css')
    });
  }
});
