# sqlite-data-system

Auth and Rest data system with sqlite for node.js and browser through the same API.

## Installation

### In node.js

```sh
npm i -s sqlite-data-system
```

### In browser

```html
    <script src="sql-wasm.js"></script>
    <script src="sqlite-data-system.bundled.js"></script>
```

Also, move files `test/browser/sql-wasm.js` and `test/browser/sql-wasm.wasm` to the same directory of the `*.html` you are using them in.

## Usage

See the [tests](./test) with mocha to get the idea of the API.

## Use cases

- Database-oriented applications
- Targeting browser and node.js
- Based on SQLite
- Requiring a REST system (because the Auth system in the front is like a bit senseless)