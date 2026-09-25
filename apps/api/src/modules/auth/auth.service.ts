import { randomBytes } from 'node:crypto';
import type { UsuarioPublico } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { hashearContrasena, verificarContrasena } from '../../lib/contrasenas.ts';
import { NoAutenticadoError } from '../../lib/errores.ts';
import * as repo from './sesiones.repository.ts';

const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;
const MENSAJE_CREDENCIALES = 'Email o contraseña incorrectos';

// Si el email no existe se verifica igual contra este hash de relleno,
// para que la respuesta tarde lo mismo y no revele qué emails existen.
let hashDeRelleno: Promise<string> | undefined;

export type SesionIniciada = { sesionId: string; usuario: UsuarioPublico; expiraEn: Date };

export async function iniciarSesion(
  email: string,
  password: string,
  ahora: Date,
): Promise<SesionIniciada> {
  const encontrado = await repo.buscarUsuarioParaLogin(db, email);

  hashDeRelleno ??= hashearContrasena('relleno-para-igualar-tiempos');
  const hash = encontrado?.passwordHash ?? (await hashDeRelleno);
  const contrasenaValida = await verificarContrasena(password, hash);

  if (encontrado === null || !contrasenaValida || !encontrado.usuario.activo) {
    throw new NoAutenticadoError(MENSAJE_CREDENCIALES);
  }

  const sesionId = randomBytes(32).toString('base64url');
  const expiraEn = new Date(ahora.getTime() + DURACION_SESION_MS);
  await repo.crear(db, { id: sesionId, usuarioId: encontrado.usuario.id, expiraEn });

  return { sesionId, usuario: encontrado.usuario, expiraEn };
}

export async function cerrarSesion(sesionId: string): Promise<void> {
  await repo.borrar(db, sesionId);
}

export async function usuarioDeSesion(sesionId: string, ahora: Date): Promise<UsuarioPublico | null> {
  return repo.buscarUsuarioDeSesion(db, sesionId, ahora);
}

export async function cerrarSesionesDeUsuario(ej: Ejecutor, usuarioId: number): Promise<void> {
  await repo.borrarDeUsuario(ej, usuarioId);
}
