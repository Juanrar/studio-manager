import type { FastifyInstance } from 'fastify';
import type { CrearUsuarioInput, UsuarioPublico } from '@studio/shared';
import { buildApp, type OpcionesApp } from '../src/app.ts';
import { crearUsuario } from '../src/modules/usuarios/usuarios.service.ts';

// Martes 10 de marzo de 2026, 12:00 en Buenos Aires.
export const AHORA = new Date('2026-03-10T15:00:00Z');

export function relojFijo(fecha: Date = AHORA): () => Date {
  return () => new Date(fecha);
}

export async function crearAppDeTest(opciones: OpcionesApp = {}): Promise<FastifyInstance> {
  const app = buildApp({ reloj: relojFijo(), ...opciones });
  await app.ready();
  return app;
}

export const ADMIN: CrearUsuarioInput = {
  nombre: 'Ana Admin',
  email: 'ana@estudio.test',
  password: 'clave-de-ana-1',
  rol: 'admin',
};

export const RECEPCION: CrearUsuarioInput = {
  nombre: 'Rita Recepción',
  email: 'rita@estudio.test',
  password: 'clave-de-rita-1',
  rol: 'recepcion',
};

export async function crearUsuarioDeTest(datos: CrearUsuarioInput): Promise<UsuarioPublico> {
  return crearUsuario(datos);
}

// Devuelve el valor del header `cookie` para usar en los requests siguientes.
export async function loguear(app: FastifyInstance, email: string, password: string): Promise<string> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  const cookie = respuesta.cookies.find((c) => c.name === 'sid');
  if (respuesta.statusCode !== 200 || cookie === undefined) {
    throw new Error(`El login falló: ${respuesta.statusCode} ${respuesta.body}`);
  }
  return `sid=${cookie.value}`;
}
