import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import type { PersonaResumen, PorcentajeProfesor, Profesor } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { porcentajeProfesor, profesor, type NuevoProfesor } from '../../db/schema.ts';
import type { FechaDia } from '../../lib/fechas.ts';

function columnas(hoy: FechaDia) {
  return {
    id: profesor.id,
    nombre: profesor.nombre,
    apellido: profesor.apellido,
    dni: profesor.dni,
    email: profesor.email,
    telefono: profesor.telefono,
    aliasCbu: profesor.aliasCbu,
    activo: profesor.activo,
    porcentajeVigenteBp: sql<number | null>`(
      select ${porcentajeProfesor.porcentajeBp} from ${porcentajeProfesor}
      where ${porcentajeProfesor.profesorId} = ${profesor.id}
        and ${porcentajeProfesor.vigenteDesde} <= ${hoy}
      order by ${porcentajeProfesor.vigenteDesde} desc
      limit 1
    )`.mapWith(Number),
  };
}

export async function insertar(ej: Ejecutor, datos: NuevoProfesor): Promise<number> {
  const [fila] = await ej.insert(profesor).values(datos).returning({ id: profesor.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number, hoy: FechaDia): Promise<Profesor | null> {
  const [fila] = await ej.select(columnas(hoy)).from(profesor).where(eq(profesor.id, id));
  return fila ?? null;
}

export async function buscarResumen(
  ej: Ejecutor,
  id: number,
): Promise<(PersonaResumen & { activo: boolean }) | null> {
  const [fila] = await ej
    .select({ id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido, activo: profesor.activo })
    .from(profesor)
    .where(eq(profesor.id, id));
  return fila ?? null;
}

export async function existe(ej: Ejecutor, id: number): Promise<boolean> {
  const [fila] = await ej.select({ id: profesor.id }).from(profesor).where(eq(profesor.id, id));
  return fila !== undefined;
}

export async function actualizar(ej: Ejecutor, id: number, cambios: Partial<NuevoProfesor>): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return existe(ej, id);
  const filas = await ej.update(profesor).set(cambios).where(eq(profesor.id, id)).returning({ id: profesor.id });
  return filas.length > 0;
}

export async function listar(ej: Ejecutor, incluirInactivos: boolean, hoy: FechaDia): Promise<Profesor[]> {
  return ej
    .select(columnas(hoy))
    .from(profesor)
    .where(incluirInactivos ? undefined : eq(profesor.activo, true))
    .orderBy(asc(profesor.apellido), asc(profesor.nombre));
}

export async function insertarPorcentaje(
  ej: Ejecutor,
  datos: { profesorId: number; porcentajeBp: number; vigenteDesde: FechaDia },
): Promise<PorcentajeProfesor> {
  const [fila] = await ej.insert(porcentajeProfesor).values(datos).returning({
    id: porcentajeProfesor.id,
    porcentajeBp: porcentajeProfesor.porcentajeBp,
    vigenteDesde: porcentajeProfesor.vigenteDesde,
  });
  return fila!;
}

export async function listarPorcentajes(ej: Ejecutor, profesorId: number): Promise<PorcentajeProfesor[]> {
  return ej
    .select({
      id: porcentajeProfesor.id,
      porcentajeBp: porcentajeProfesor.porcentajeBp,
      vigenteDesde: porcentajeProfesor.vigenteDesde,
    })
    .from(porcentajeProfesor)
    .where(eq(porcentajeProfesor.profesorId, profesorId))
    .orderBy(desc(porcentajeProfesor.vigenteDesde));
}

export async function buscarPorcentajeVigente(
  ej: Ejecutor,
  profesorId: number,
  fecha: FechaDia,
): Promise<number | null> {
  const [fila] = await ej
    .select({ porcentajeBp: porcentajeProfesor.porcentajeBp })
    .from(porcentajeProfesor)
    .where(and(eq(porcentajeProfesor.profesorId, profesorId), lte(porcentajeProfesor.vigenteDesde, fecha)))
    .orderBy(desc(porcentajeProfesor.vigenteDesde))
    .limit(1);
  return fila?.porcentajeBp ?? null;
}
