import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { Horario } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { horaHHMM } from '../../lib/postgres.ts';
import { horario, profesor, type NuevoHorario } from '../../db/schema.ts';

const columnas = {
  id: horario.id,
  estilo: horario.estilo,
  nivel: horario.nivel,
  diaSemana: horario.diaSemana,
  horaInicio: horaHHMM(horario.horaInicio),
  horaFin: horaHHMM(horario.horaFin),
  profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
  activo: horario.activo,
};

function seleccionar(ej: Ejecutor, filtro: SQL | undefined) {
  return ej
    .select(columnas)
    .from(horario)
    .innerJoin(profesor, eq(profesor.id, horario.profesorId))
    .where(filtro)
    .orderBy(asc(horario.diaSemana), asc(horario.horaInicio), asc(horario.id));
}

export async function insertar(ej: Ejecutor, datos: NuevoHorario): Promise<number> {
  const [fila] = await ej.insert(horario).values(datos).returning({ id: horario.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Horario | null> {
  const [fila] = await seleccionar(ej, eq(horario.id, id));
  return fila ?? null;
}

export async function actualizar(ej: Ejecutor, id: number, cambios: Partial<NuevoHorario>): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return (await buscarPorId(ej, id)) !== null;
  const filas = await ej.update(horario).set(cambios).where(eq(horario.id, id)).returning({ id: horario.id });
  return filas.length > 0;
}

export type FiltrosDeHorarios = { incluirInactivos: boolean; profesorId?: number | undefined };

export async function listar(ej: Ejecutor, filtros: FiltrosDeHorarios): Promise<Horario[]> {
  const condiciones: SQL[] = [];
  if (!filtros.incluirInactivos) condiciones.push(eq(horario.activo, true));
  if (filtros.profesorId !== undefined) condiciones.push(eq(horario.profesorId, filtros.profesorId));
  // Sin condiciones, and() devuelve undefined y la consulta no lleva where.
  return seleccionar(ej, and(...condiciones));
}

export async function listarDelDia(ej: Ejecutor, diaSemana: number): Promise<Horario[]> {
  return seleccionar(ej, and(eq(horario.activo, true), eq(horario.diaSemana, diaSemana)));
}

// Lo que el generador copia en cada clase, de los horarios activos.
export type HorarioParaGenerar = {
  id: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  estilo: string;
  nivel: string | null;
  profesorId: number;
  vigenteDesde: string;
};

export async function listarParaGenerar(ej: Ejecutor, horarioId?: number): Promise<HorarioParaGenerar[]> {
  return ej
    .select({
      id: horario.id,
      diaSemana: horario.diaSemana,
      horaInicio: horaHHMM(horario.horaInicio),
      horaFin: horaHHMM(horario.horaFin),
      estilo: horario.estilo,
      nivel: horario.nivel,
      profesorId: horario.profesorId,
      vigenteDesde: horario.vigenteDesde,
    })
    .from(horario)
    .where(and(eq(horario.activo, true), horarioId === undefined ? undefined : eq(horario.id, horarioId)));
}
