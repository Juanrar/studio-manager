import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@studio/shared';
import {
  COOKIE_SESION,
  leerSesionId,
  opcionesCookieSesion,
  requerirRol,
} from '../../plugins/autenticacion.ts';
import { cerrarSesion, iniciarSesion } from './auth.service.ts';

export async function rutasAuth(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const sesion = await iniciarSesion(email, password, app.reloj());
    reply.setCookie(COOKIE_SESION, sesion.sesionId, opcionesCookieSesion(sesion.expiraEn));
    return sesion.usuario;
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const sesionId = leerSesionId(request);
    if (sesionId !== null) await cerrarSesion(sesionId);
    reply.clearCookie(COOKIE_SESION, opcionesCookieSesion());
    return reply.status(204).send();
  });

  app.get('/api/auth/yo', { preHandler: requerirRol('recepcion') }, async (request) => request.usuario);
}
