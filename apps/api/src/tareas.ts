import type { FastifyInstance } from 'fastify';
import { darDeBajaPorNoComprar } from './modules/alumnos/baja-automatica.service.ts';

const UNA_HORA = 60 * 60 * 1000;

// Lo que la API hace sola mientras está levantada: por ahora, la baja automática de quien no compra.
// Corre al arrancar y cada hora; la regla depende solo del día, así que repetirla no cambia nada.
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

  void darDeBaja();
  const intervalo = setInterval(() => void darDeBaja(), UNA_HORA);
  // No mantiene vivo el proceso por su cuenta: de eso se encarga el servidor HTTP.
  intervalo.unref();
  return () => clearInterval(intervalo);
}
