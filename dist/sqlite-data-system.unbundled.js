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
      await this.db.run(`SELECT * FROM users LIMIT 1;`);
      wasPreviouslyCreated = true;
    } catch (error) {
      wasPreviouslyCreated = false;
    }

    if(wasPreviouslyCreated) {
      return true;
    }

    await this.db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

    await this.db.run(`
      CREATE TABLE groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await this.db.run(`
      CREATE TABLE permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await this.db.run(`
      CREATE TABLE groups_de_user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (group_id) REFERENCES groups(id),
        UNIQUE (user_id, group_id)
      );
    `);

    await this.db.run(`
      CREATE TABLE permissions_de_group (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id),
        UNIQUE (group_id, permission_id)
      );
    `);

    await this.db.run(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    return false;
  }

  async _runInitialMigration() {
    await this.db.run(`INSERT INTO users (name, password) VALUES (?, ?)`, ['admin', 'admin']);
    await this.db.run(`INSERT INTO groups (name) VALUES (?)`, ['administradores']);
    await this.db.run(`INSERT INTO permissions (name) VALUES (?)`, ['administrar']);

    const adminUserId = (await this.db.get(`SELECT id FROM users WHERE name = ?`, ['admin'])).id;
    const adminGroupId = (await this.db.get(`SELECT id FROM groups WHERE name = ?`, ['administradores'])).id;
    const adminPermId = (await this.db.get(`SELECT id FROM permissions WHERE name = ?`, ['administrar'])).id;

    await this.db.run(`INSERT INTO groups_de_user (user_id, group_id) VALUES (?, ?)`, [adminUserId, adminGroupId]);
    await this.db.run(`INSERT INTO permissions_de_group (group_id, permission_id) VALUES (?, ?)`, [adminGroupId, adminPermId]);
  }

  async openSession(name, password) {
    const user = await this.db.get(`SELECT * FROM users WHERE name = ? AND password = ?`, [name, password]);
    if (!user) throw new Error(`Credenciales inválidas: ${name} + ${password}`);

    const token = this._generateToken();
    await this.db.run(`INSERT INTO sessions (user_id, token) VALUES (?, ?)`, [user.id, token]);
    return { user: user.name, token };
  }

  async closeSession(token) {
    await this.db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
  }

  async refreshSession(token) {
    const session = await this.db.get(`SELECT * FROM sessions WHERE token = ?`, [token]);
    if (!session) throw new Error('Sesión inválida.');

    const newToken = this._generateToken();
    await this.db.run(`UPDATE sessions SET token = ? WHERE id = ?`, [newToken, session.id]);
    return { nuevoToken: newToken };
  }

  async registerUser(name, password) {
    await this.db.run(`INSERT INTO users (name, password) VALUES (?, ?)`, [name, password]);
  }

  async deregisterUser(token) {
    const session = await this.db.get(`SELECT * FROM sessions WHERE token = ?`, [token]);
    if (!session) throw new Error('Sesión inválida.');

    const userId = session.user_id;

    await this.db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
    await this.db.run(`DELETE FROM groups_de_user WHERE user_id = ?`, [userId]);
    await this.db.run(`DELETE FROM users WHERE id = ?`, [userId]);
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
