import Fastify, { type FastifyInstance } from 'fastify';
import { registrarManejoDeErrores } from './plugins/errores.ts';

export type OpcionesApp = {
  // Los tests pasan un reloj fijo. En producción es la hora real.
  reloj?: () => Date;
};

declare module 'fastify' {
  interface FastifyInstance {
    reloj: () => Date;
  }
}

export function buildApp(opciones: OpcionesApp = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  app.decorate('reloj', opciones.reloj ?? (() => new Date()));
  registrarManejoDeErrores(app);

  app.get('/api/health', async () => ({ estado: 'ok' }));

  return app;
}
