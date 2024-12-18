const SqliteDataSystem = require(__dirname + "/../dist/sqlite-data-system.bundled.js");

describe("sqlite-data-system rest api test", function () {

  it("can use rest api", async function () {

    try {

      const rest = new SqliteDataSystem.Rest("mydb.sqlite");

      // Inicialización y esquema
      await rest.init();
      const schema = await rest.getSchema();

      console.log(schema);

      // Crear una tabla de prueba
      await rest.db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`);

      // Insertar datos
      await rest.insert({
        table: "users",
        items: [
          { name: "Alice", age: 25 },
          { name: "Bob", age: 30 },
        ]
      });

      // Consultar datos
      console.log(await rest.select({
        table: "users"
      }));

      // Actualizar datos
      await rest.update({
        table: "users",
        values: {
          age: 26
        },
        where: [["name", "=", "Alice"]]
      });

      // Eliminar datos
      await rest.delete({
        table: "users",
        where: [["age", "=", 30]]
      });

      console.log(await rest.select({
        table: "users"
      }));

    } catch (error) {
      console.log(error);
      throw error;
    }

  });

});
