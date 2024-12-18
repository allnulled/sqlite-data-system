require("@allnulled/simplebundler").bundle({
  dir: __dirname + "/src",
  output: __dirname + "/dist/sqlite-data-system.bundled.js",
  ignore: [],
  module: true,
  id: "SqliteDataSystem"
}).bundle({
  dir: __dirname + "/src",
  output: __dirname + "/dist/sqlite-data-system.unbundled.js",
  ignore: ["01.sqlite-polyfill.js"],
  module: true,
  id: "SqliteDataSystem"
});

require("fs").copyFileSync(__dirname + "/dist/sqlite-data-system.bundled.js", __dirname + "/test/browser/sqlite-data-system.bundled.js")