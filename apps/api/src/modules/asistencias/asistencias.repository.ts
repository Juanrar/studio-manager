import { asc, eq, type SQL } from 'drizzle-orm';
import type { Asistencia } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { alumno, asistencia, pack, pago, type NuevaAsistencia } from '../../db/schema.ts';

const columnas = {
  id: asistencia.id,
  sesionId: asistencia.sesionId,
  alumno: { id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido },
  pagoId: asistencia.pagoId,
  pack: pack.nombre,
  valorClase: asistencia.valorClase,
  porcentajeBp: asistencia.porcentajeBp,
};

function seleccionar(ej: Ejecutor, filtro: SQL) {
  return ej
    .select(columnas)
    .from(asistencia)
    .innerJoin(alumno, eq(alumno.id, asistencia.alumnoId))
    .innerJoin(pago, eq(pago.id, asistencia.pagoId))
    .innerJoin(pack, eq(pack.id, pago.packId))
    .where(filtro);
}

export async function insertar(ej: Ejecutor, datos: NuevaAsistencia): Promise<number> {
  const [fila] = await ej.insert(asistencia).values(datos).returning({ id: asistencia.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Asistencia | null> {
  const [fila] = await seleccionar(ej, eq(asistencia.id, id));
  return fila ?? null;
}

export async function listarDeSesion(ej: Ejecutor, sesionId: number): Promise<Asistencia[]> {
  return seleccionar(ej, eq(asistencia.sesionId, sesionId)).orderBy(asc(alumno.apellido), asc(alumno.nombre));
}

export async function borrar(ej: Ejecutor, id: number): Promise<boolean> {
  const filas = await ej.delete(asistencia).where(eq(asistencia.id, id)).returning({ id: asistencia.id });
  return filas.length > 0;
}
