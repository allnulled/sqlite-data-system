const create = function(dbName, wasmPath) {
  const db = new SQLitePolyfill();
  return {
    db: db,
    auth: new Auth(dbName, wasmPath, db),
    rest: new Rest(dbName, wasmPath, db),
  };
}