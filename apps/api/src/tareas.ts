import type { FastifyInstance } from 'fastify';
import { db } from './db/client.ts';
import { darDeBajaPorNoComprar } from './modules/alumnos/baja-automatica.service.ts';
import { generarClases } from './modules/horarios/horarios.service.ts';

const UNA_HORA = 60 * 60 * 1000;

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
  intervalo.unref();
  return () => clearInterval(intervalo);
}
