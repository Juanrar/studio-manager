import { and, eq, gt } from 'drizzle-orm';
import type { UsuarioPublico } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { sesionUsuario, usuario } from '../../db/schema.ts';

const columnasUsuario = {
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  activo: usuario.activo,
};

export async function buscarUsuarioParaLogin(
  ej: Ejecutor,
  email: string,
): Promise<{ usuario: UsuarioPublico; passwordHash: string } | null> {
  const [fila] = await ej
    .select({ ...columnasUsuario, passwordHash: usuario.passwordHash })
    .from(usuario)
    .where(eq(usuario.email, email));
  if (fila === undefined) return null;
  const { passwordHash, ...publico } = fila;
  return { usuario: publico, passwordHash };
}

export async function crear(
  ej: Ejecutor,
  datos: { id: string; usuarioId: number; expiraEn: Date },
): Promise<void> {
  await ej.insert(sesionUsuario).values(datos);
}

export async function borrar(ej: Ejecutor, id: string): Promise<void> {
  await ej.delete(sesionUsuario).where(eq(sesionUsuario.id, id));
}

export async function borrarDeUsuario(ej: Ejecutor, usuarioId: number): Promise<void> {
  await ej.delete(sesionUsuario).where(eq(sesionUsuario.usuarioId, usuarioId));
}

export async function buscarUsuarioDeSesion(
  ej: Ejecutor,
  id: string,
  ahora: Date,
): Promise<UsuarioPublico | null> {
  const [fila] = await ej
    .select(columnasUsuario)
    .from(sesionUsuario)
    .innerJoin(usuario, eq(usuario.id, sesionUsuario.usuarioId))
    .where(and(eq(sesionUsuario.id, id), gt(sesionUsuario.expiraEn, ahora), eq(usuario.activo, true)));
  return fila ?? null;
}
