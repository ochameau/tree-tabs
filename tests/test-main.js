const main = require("main");

exports.test_test_run = function(test) {
  test.pass("Unit test running!");
};
/*
exports.test_open_tab = function(test) {
  const tabs = require("tabs");
  tabs.open({
    url: "http://www.mozilla.org/",
    onReady: function(tab) {
      test.assertEqual(tab.url, "http://www.mozilla.org/");
      test.done();
    }
  });
  test.waitUntilDone(20000);
};
*/