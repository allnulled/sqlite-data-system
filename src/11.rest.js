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