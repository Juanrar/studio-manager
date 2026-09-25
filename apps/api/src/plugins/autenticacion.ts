import cookie, { type CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Rol, UsuarioPublico } from '@studio/shared';
import { config } from '../config.ts';
import { NoAutenticadoError, SinPermisoError } from '../lib/errores.ts';
import { usuarioDeSesion } from '../modules/auth/auth.service.ts';

export const COOKIE_SESION = 'sid';

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioPublico | null;
  }
}

export function registrarAutenticacion(app: FastifyInstance): void {
  app.register(cookie, { secret: config.sessionSecret });
  app.decorateRequest('usuario', null);

  app.addHook('onRequest', async (request) => {
    const sesionId = leerSesionId(request);
    if (sesionId !== null) {
      request.usuario = await usuarioDeSesion(sesionId, request.server.reloj());
    }
  });
}

export function leerSesionId(request: FastifyRequest): string | null {
  const firmada = request.cookies[COOKIE_SESION];
  if (firmada === undefined) return null;
  const resultado = request.unsignCookie(firmada);
  return resultado.valid ? resultado.value : null;
}

export function opcionesCookieSesion(expiraEn?: Date): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    signed: true,
    ...(expiraEn === undefined ? {} : { expires: expiraEn }),
  };
}

// `admin` incluye a `recepcion`: una ruta que pide recepción también la puede usar un admin.
export function requerirRol(rol: Rol) {
  return async (request: FastifyRequest): Promise<void> => {
    if (request.usuario === null) {
      throw new NoAutenticadoError('Tenés que iniciar sesión');
    }
    if (rol === 'admin' && request.usuario.rol !== 'admin') {
      throw new SinPermisoError('No tenés permiso para esta acción');
    }
  };
}
