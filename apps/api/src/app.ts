import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config.ts';
import { hoyEnEstudio, type FechaDia } from './lib/fechas.ts';
import { rutasAlumnos } from './modules/alumnos/alumnos.routes.ts';
import { rutasAsistencias } from './modules/asistencias/asistencias.routes.ts';
import { rutasAuth } from './modules/auth/auth.routes.ts';
import { rutasClases } from './modules/clases/clases.routes.ts';
import { rutasSesiones } from './modules/clases/sesiones.routes.ts';
import { rutasLiquidaciones } from './modules/liquidaciones/liquidaciones.routes.ts';
import { rutasPacks } from './modules/packs/packs.routes.ts';
import { rutasPagos } from './modules/pagos/pagos.routes.ts';
import { rutasProfesores } from './modules/profesores/profesores.routes.ts';
import { rutasUsuarios } from './modules/usuarios/usuarios.routes.ts';
import { registrarAutenticacion } from './plugins/autenticacion.ts';
import { registrarManejoDeErrores } from './plugins/errores.ts';

export type OpcionesApp = {
  // Los tests pasan un reloj fijo. En producción es la hora real.
  reloj?: () => Date;
  // Carpeta del frontend compilado. Si viene, la API también sirve la app web.
  directorioWeb?: string | undefined;
};

declare module 'fastify' {
  interface FastifyInstance {
    reloj: () => Date;
    // El día actual en la zona del estudio, según el reloj de la app.
    hoy: () => FechaDia;
  }
}

export function buildApp(opciones: OpcionesApp = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  const reloj = opciones.reloj ?? (() => new Date());
  app.decorate('reloj', reloj);
  app.decorate('hoy', () => hoyEnEstudio(reloj(), config.tzEstudio));
  registrarManejoDeErrores(app, { sirveFrontend: opciones.directorioWeb !== undefined });
  if (opciones.directorioWeb !== undefined) {
    app.register(fastifyStatic, { root: resolve(opciones.directorioWeb) });
  }
  registrarAutenticacion(app);

  app.get('/api/health', async () => ({ estado: 'ok' }));
  app.register(rutasAuth);
  app.register(rutasUsuarios);
  app.register(rutasAlumnos);
  app.register(rutasPacks);
  app.register(rutasProfesores);
  app.register(rutasClases);
  app.register(rutasSesiones);
  app.register(rutasPagos);
  app.register(rutasAsistencias);
  app.register(rutasLiquidaciones);

  return app;
}
