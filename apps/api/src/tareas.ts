import type { FastifyInstance } from 'fastify';
import { db } from './db/client.ts';
import { darDeBajaPorNoComprar } from './modules/alumnos/baja-automatica.service.ts';
import { generarClases } from './modules/clases/programacion.service.ts';

const UNA_HORA = 60 * 60 * 1000;

// Lo que la API hace sola mientras está levantada: la baja automática de quien no compra y las clases
// del horizonte, que avanza una semana cuando empieza otra. Corren al arrancar y cada hora; las dos
// dependen solo del día, así que repetirlas no cambia nada.
// La llama server.ts, no buildApp: los tests no quedan con tareas corriendo. Devuelve cómo detenerlas.
export function programarTareas(app: FastifyInstance): () => void {
  const darDeBaja = async () => {
    try {
      const alumnos = await darDeBajaPorNoComprar(app.reloj(), app.hoy());
      if (alumnos.length > 0) app.log.info({ alumnos }, 'Baja automática por no comprar');
    } catch (error) {
      app.log.error(error, 'Falló la baja automática');
    }
  };

  const crearClases = async () => {
    try {
      const creadas = await generarClases(db, app.hoy());
      if (creadas > 0) app.log.info({ creadas }, 'Clases creadas por adelantado');
    } catch (error) {
      app.log.error(error, 'Falló la creación de clases por adelantado');
    }
  };

  const correr = () => {
    void darDeBaja();
    void crearClases();
  };

  correr();
  const intervalo = setInterval(correr, UNA_HORA);
  // No mantiene vivo el proceso por su cuenta: de eso se encarga el servidor HTTP.
  intervalo.unref();
  return () => clearInterval(intervalo);
}
