(function(factory) {
  const mod = factory();
  if(typeof window !== 'undefined') {
    window["SqliteDataSystem"] = mod;
  }
  if(typeof global !== 'undefined') {
    global["SqliteDataSystem"] = mod;
  }
  if(typeof module !== 'undefined') {
    module.exports = mod;
  }
})(function() {
(function (factory) {
  const mod = factory();
  if (typeof window !== 'undefined') {
    window["SQLitePolyfill"] = mod;
  }
  if (typeof global !== 'undefined') {
    global["SQLitePolyfill"] = mod;
  }
  if (typeof module !== 'undefined') {
    // module.exports = mod;
  }
})(function () {

  class SQLitePolyfill {
    constructor() {
      this.db = null;
      this.isBrowser = typeof window !== 'undefined';
    }

    async init(dbName = ':memory:', wasm_path = "$filename") {
      if (this.isBrowser) {
        if (!window.initSqlJs) {
          throw new Error("sql.js is required in the browser. Make sure it's loaded.");
        }
        const SQL = await window.initSqlJs({
          locateFile: function (filename) {
            return wasm_path.replace("$filename", filename);
          }
        });
        this._loadFromLocalStorage(SQL);
      } else {
        const sqlite3 = require("sqlite3");
        this.db = new sqlite3.Database(dbName, (err) => {
          if (err) {
            throw new Error(`Failed to open database: ${err.message}`);
          }
        });
      }
    }

    run(query, params = []) {
      if (this.isBrowser) {
        this._ensureDbInitialized();
        const statement = this.db.prepare(query);
        statement.bind(params);
        while (statement.step()) {
          // No-op for run in browser
        }
        statement.free();
        return Promise.resolve();
      } else {
        return new Promise((resolve, reject) => {
          this.db.run(query, params, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(this);
            }
          });
        });
      }
    }

    all(query, params = []) {
      if (this.isBrowser) {
        this._ensureDbInitialized();
        const results = [];
        const statement = this.db.prepare(query);
        statement.bind(params);
        while (statement.step()) {
          results.push(statement.getAsObject());
        }
        statement.free();
        this._persistToLocalStorage();
        return Promise.resolve(results);
      } else {
        return new Promise((resolve, reject) => {
          this.db.all(query, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          });
        });
      }
    }

    get(query, params = []) {
      if (this.isBrowser) {
        return this.all(query, params).then((results) => results[0] || null);
      } else {
        return new Promise((resolve, reject) => {
          this.db.get(query, params, (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          });
        });
      }
    }

    close() {
      if (this.isBrowser) {
        this._ensureDbInitialized();
        this.db.close();
        this.db = null;
        return Promise.resolve();
      } else {
        return new Promise((resolve, reject) => {
          this.db.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }
    }

    _ensureDbInitialized() {
      if (!this.db) {
        throw new Error("Database is not initialized. Call 'init()' first.");
      }
    }

    // Método para cargar la base de datos desde localStorage
    _loadFromLocalStorage(SQL) {
      const savedDb = localStorage.getItem(this.localStorageKey);
      if (savedDb) {
        const buffer = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
      }
    }

    // Método para persistir la base de datos en localStorage
    _persistToLocalStorage() {
      const dbData = this.db.export();  // Exportar la base de datos
      const dbString = btoa(String.fromCharCode.apply(null, new Uint8Array(dbData)));  // Convertir a base64
      localStorage.setItem(this.localStorageKey, dbString);  // Guardar en localStorage
    }

  }

  return SQLitePolyfill;

});
const Auth = class {

  constructor(dbName = ":memory:", wasmPath = "$filename", sqlitePolyfill = false) {
    this.db = sqlitePolyfill || new SQLitePolyfill();
    this.dbName = dbName;
    this.wasmPath = wasmPath;
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.db.init(this.dbName, this.wasmPath);
      this.initialized = true;
    }
    const wasPreviouslyCreated = !await this._createSchema();
    if(wasPreviouslyCreated) {
      await this._runInitialMigration();
    }
  }

  async _createSchema() {
    
    let wasPreviouslyCreated = false

    try {
      await this.db.run(`SELECT * FROM usuarios LIMIT 1;`);
      wasPreviouslyCreated = true;
    } catch (error) {
      wasPreviouslyCreated = false;
    }

    if(wasPreviouslyCreated) {
      return true;
    }

    await this.db.run(`
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

    await this.db.run(`
      CREATE TABLE grupos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      );
    `);

    await this.db.run(`
      CREATE TABLE permisos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      );
    `);

    await this.db.run(`
      CREATE TABLE grupos_de_usuario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        grupo_id INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (grupo_id) REFERENCES grupos(id),
        UNIQUE (usuario_id, grupo_id)
      );
    `);

    await this.db.run(`
      CREATE TABLE permisos_de_grupo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        permiso_id INTEGER NOT NULL,
        FOREIGN KEY (grupo_id) REFERENCES grupos(id),
        FOREIGN KEY (permiso_id) REFERENCES permisos(id),
        UNIQUE (grupo_id, permiso_id)
      );
    `);

    await this.db.run(`
      CREATE TABLE sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      );
    `);

    return false;
  }

  async _runInitialMigration() {
    await this.db.run(`INSERT INTO usuarios (nombre, password) VALUES (?, ?)`, ['admin', 'admin']);
    await this.db.run(`INSERT INTO grupos (nombre) VALUES (?)`, ['administradores']);
    await this.db.run(`INSERT INTO permisos (nombre) VALUES (?)`, ['administrar']);

    const adminUserId = (await this.db.get(`SELECT id FROM usuarios WHERE nombre = ?`, ['admin'])).id;
    const adminGroupId = (await this.db.get(`SELECT id FROM grupos WHERE nombre = ?`, ['administradores'])).id;
    const adminPermId = (await this.db.get(`SELECT id FROM permisos WHERE nombre = ?`, ['administrar'])).id;

    await this.db.run(`INSERT INTO grupos_de_usuario (usuario_id, grupo_id) VALUES (?, ?)`, [adminUserId, adminGroupId]);
    await this.db.run(`INSERT INTO permisos_de_grupo (grupo_id, permiso_id) VALUES (?, ?)`, [adminGroupId, adminPermId]);
  }

  async abrirSesion(nombre, password) {
    const user = await this.db.get(`SELECT * FROM usuarios WHERE nombre = ? AND password = ?`, [nombre, password]);
    if (!user) throw new Error(`Credenciales inválidas: ${nombre} + ${password}`);

    const token = this._generateToken();
    await this.db.run(`INSERT INTO sesiones (usuario_id, token) VALUES (?, ?)`, [user.id, token]);
    return { usuario: user.nombre, token };
  }

  async cerrarSesion(token) {
    await this.db.run(`DELETE FROM sesiones WHERE token = ?`, [token]);
  }

  async refrescarSesion(token) {
    const session = await this.db.get(`SELECT * FROM sesiones WHERE token = ?`, [token]);
    if (!session) throw new Error('Sesión inválida.');

    const newToken = this._generateToken();
    await this.db.run(`UPDATE sesiones SET token = ? WHERE id = ?`, [newToken, session.id]);
    return { nuevoToken: newToken };
  }

  async registrarUsuario(nombre, password) {
    await this.db.run(`INSERT INTO usuarios (nombre, password) VALUES (?, ?)`, [nombre, password]);
  }

  async desregistrarUsuario(token) {
    const session = await this.db.get(`SELECT * FROM sesiones WHERE token = ?`, [token]);
    if (!session) throw new Error('Sesión inválida.');

    const userId = session.usuario_id;

    await this.db.run(`DELETE FROM sesiones WHERE usuario_id = ?`, [userId]);
    await this.db.run(`DELETE FROM grupos_de_usuario WHERE usuario_id = ?`, [userId]);
    await this.db.run(`DELETE FROM usuarios WHERE id = ?`, [userId]);
  }

  _generateToken() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 100 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }

}

const Rest = class {

  constructor(dbName = ":memory:", wasmPath = "$filename", sqlitePolyfill = false) {
    this.db = sqlitePolyfill || new SQLitePolyfill();
    this.dbName = dbName;
    this.wasmPath = wasmPath;
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.db.init(this.dbName, this.wasmPath);
      this.initialized = true;
    }
  }

  async getSchema(force = false) {
    await this.init();
    const result = { tables: {} };

    try {
      // Obtener la lista de tablas
      const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table';");

      // Procesar cada tabla
      for (const table of tables) {
        const tableName = table.name;
        result.tables[tableName] = { columns: {}, foreignKeys: {} };

        // Obtener columnas de la tabla
        const columns = await this.db.all(`PRAGMA table_info(${tableName});`);
        for (const column of columns) {
          result.tables[tableName].columns[column.name] = {
            type: column.type,
            notNull: column.notnull === 1,
            default: column.dflt_value,
            primaryKey: column.pk === 1,
          };
        }

        // Obtener claves foráneas de la tabla
        const foreignKeys = await this.db.all(`PRAGMA foreign_key_list(${tableName});`);
        for (const foreignKey of foreignKeys) {
          result.tables[tableName].foreignKeys[foreignKey.id] = {
            from: foreignKey.from,
            to: foreignKey.to,
            table: foreignKey.table,
            onDelete: foreignKey.on_delete,
            onUpdate: foreignKey.on_update,
          };
        }
      }

      return result;

    } catch (err) {
      throw err;
    }
  }

  async select({ table, where = [], orderBy = [["id", "ASC"]] }) {
    await this.init();
    const whereClause = where.length
      ? `WHERE ` + where.map(([col, op, val]) => `${col} ${op} ?`).join(" AND ")
      : "";
    const orderClause = orderBy.length
      ? `ORDER BY ` + orderBy.map(([col, dir]) => `${col} ${dir}`).join(", ")
      : "";

    const query = `SELECT * FROM ${table} ${whereClause} ${orderClause}`;
    const params = where.map(([, , val]) => val);

    return this.db.all(query, params);
  }

  async insert({ table, item = {}, items = [] }) {
    await this.init();
    const rows = items.length ? items : [item];

    if (rows.length === 0) {
      throw new Error("No data provided for insertion.");
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const query = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

    for (const row of rows) {
      await this.db.run(query, Object.values(row));
    }

    return { inserted: rows.length };
  }

  async update({ table, values, where = [] }) {
    await this.init();
    const setClause = Object.keys(values)
      .map((col) => `${col} = ?`)
      .join(", ");
    const whereClause = where.length
      ? `WHERE ` + where.map(([col, op, val]) => `${col} ${op} ?`).join(" AND ")
      : "";

    const query = `UPDATE ${table} SET ${setClause} ${whereClause}`;
    const params = [...Object.values(values), ...where.map(([, , val]) => val)];

    const result = await this.db.run(query, params);
    return { changes: result.changes || 0 };
  }

  async delete({ table, where = [] }) {
    await this.init();
    const whereClause = where.length
      ? `WHERE ` + where.map(([col, op, val]) => `${col} ${op} ?`).join(" AND ")
      : "";

    const query = `DELETE FROM ${table} ${whereClause}`;
    const params = where.map(([, , val]) => val);

    const result = await this.db.run(query, params);
    return { deleted: result.changes || 0 };
  }
}
const create = function(dbName, wasmPath) {
  const db = new SQLitePolyfill();
  return {
    db: db,
    auth: new Auth(dbName, wasmPath, db),
    rest: new Rest(dbName, wasmPath, db),
  };
}
return { Auth, Rest, create };
});
