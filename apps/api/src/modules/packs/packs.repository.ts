import { asc, eq } from 'drizzle-orm';
import type { Pack } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { pack, type NuevoPack } from '../../db/schema.ts';

const columnas = {
  id: pack.id,
  nombre: pack.nombre,
  cantidadClases: pack.cantidadClases,
  precio: pack.precio,
  activo: pack.activo,
};

export async function insertar(ej: Ejecutor, datos: NuevoPack): Promise<Pack> {
  const [fila] = await ej.insert(pack).values(datos).returning(columnas);
  return fila!;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Pack | null> {
  const [fila] = await ej.select(columnas).from(pack).where(eq(pack.id, id));
  return fila ?? null;
}

export async function actualizar(ej: Ejecutor, id: number, cambios: Partial<NuevoPack>): Promise<Pack | null> {
  if (Object.keys(cambios).length === 0) return buscarPorId(ej, id);
  const [fila] = await ej.update(pack).set(cambios).where(eq(pack.id, id)).returning(columnas);
  return fila ?? null;
}

export async function listar(ej: Ejecutor, incluirInactivos: boolean): Promise<Pack[]> {
  return ej
    .select(columnas)
    .from(pack)
    .where(incluirInactivos ? undefined : eq(pack.activo, true))
    .orderBy(asc(pack.cantidadClases), asc(pack.nombre));
}
