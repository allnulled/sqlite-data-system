const SqliteDataSystem = require(__dirname + "/../dist/sqlite-data-system.bundled.js");

describe("sqlite-data-system auth api test", function () {

  it("can use auth api", async function () {

    try {

      const auth = new SqliteDataSystem.Auth("mydb.sqlite");

      await auth.init();

      console.log('==== Inicio de pruebas ====');

      // Abrir sesión con admin
      const adminSession = await auth.openSession('admin', 'admin');
      console.log('Sesión admin:', adminSession);

      // Registrar un nuevo usuario
      try {
        await auth.registerUser('usuario1', 'password1');
        console.log('Usuario "usuario1" registrado.');
      } catch (error) {
        console.log(error);
        console.log('Usuario "usuario1" ya estaba registrado.');
      }

      // Abrir sesión con el nuevo usuario
      const userSession = await auth.openSession('usuario1', 'password1');
      console.log('Sesión usuario1:', userSession);

      // Refrescar sesión
      const refreshedSession = await auth.refreshSession(userSession.token);
      console.log('Sesión refrescada:', refreshedSession);

      try {
        // Desregistrar usuario
        await auth.deregisterUser(refreshedSession.nuevoToken);
        console.log('Usuario "usuario1" desregistrado.');
      } catch (error) {
        console.log('Usuario "usuario1" ya estaba desregistrado.');
      }
      
      // Cerrar sesión
      await auth.closeSession(adminSession.token);
      console.log('Sesión cerrada.');

      console.log('==== Fin de pruebas ====');


    } catch (error) {
      console.log(error);
      throw error;
    }

  });

});
