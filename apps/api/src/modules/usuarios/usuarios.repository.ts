import { asc, eq } from 'drizzle-orm';
import type { UsuarioPublico } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { usuario, type NuevoUsuario } from '../../db/schema.ts';

const columnasPublicas = {
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  activo: usuario.activo,
};

export async function insertar(ej: Ejecutor, datos: NuevoUsuario): Promise<UsuarioPublico> {
  const [fila] = await ej.insert(usuario).values(datos).returning(columnasPublicas);
  return fila!;
}

export async function listar(ej: Ejecutor): Promise<UsuarioPublico[]> {
  return ej.select(columnasPublicas).from(usuario).orderBy(asc(usuario.nombre));
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<UsuarioPublico | null> {
  const [fila] = await ej.select(columnasPublicas).from(usuario).where(eq(usuario.id, id));
  return fila ?? null;
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: Partial<Pick<NuevoUsuario, 'nombre' | 'rol' | 'activo' | 'passwordHash'>>,
): Promise<UsuarioPublico | null> {
  if (Object.keys(cambios).length === 0) return buscarPorId(ej, id);
  const [fila] = await ej
    .update(usuario)
    .set(cambios)
    .where(eq(usuario.id, id))
    .returning(columnasPublicas);
  return fila ?? null;
}
