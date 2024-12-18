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
