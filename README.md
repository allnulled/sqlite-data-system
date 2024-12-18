# sqlite-data-system

Auth and Rest data system with sqlite for node.js and browser through the same API.

## Installation

### In node.js

```sh
npm i -s sqlite-data-system
```

Then in javascript:

```js
const SqliteDataSystem = require("@allnulled/sqlite-data-system");
const datasys = SqliteDataSystem.create();
```

### In browser

```html
<script src="sql-wasm.js"></script>
<script src="sqlite-data-system.bundled.js"></script>
```

Then in javascript:

```js
const datasys = window.SqliteDataSystem.create();
```

Also, move **both files** `test/browser/sql-wasm.js` and `test/browser/sql-wasm.wasm`, one beside the other, to the same directory of the `*.html` you are using them in, so you can load the sqlite for the browser library, which works with `*.wasm` file.

## Usage

See the [tests](./test) with mocha to get the idea of the API.

## Use cases

- Database-oriented applications
- Targeting browser and node.js
- Based on SQLite
- Requiring a REST system (because the Auth system in the front is like a bit senseless)