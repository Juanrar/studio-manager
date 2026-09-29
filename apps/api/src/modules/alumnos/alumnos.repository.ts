import { and, asc, count, desc, eq, inArray, max, or, sql, type SQL } from 'drizzle-orm';
import type { Alumno, ListadoQuery } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { alumno, cambioEstadoAlumno, type NuevoAlumno, type NuevoCambioEstadoAlumno } from '../../db/schema.ts';
import { patronContiene } from '../../lib/postgres.ts';

const columnas = {
  id: alumno.id,
  nombre: alumno.nombre,
  apellido: alumno.apellido,
  dni: alumno.dni,
  email: alumno.email,
  telefono: alumno.telefono,
  fechaNacimiento: alumno.fechaNacimiento,
  contactoEmergencia: alumno.contactoEmergencia,
  notas: alumno.notas,
  activo: alumno.activo,
};

export async function insertar(ej: Ejecutor, datos: NuevoAlumno): Promise<Alumno> {
  const [fila] = await ej.insert(alumno).values(datos).returning(columnas);
  return fila!;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Alumno | null> {
  const [fila] = await ej.select(columnas).from(alumno).where(eq(alumno.id, id));
  return fila ?? null;
}

export async function buscarConAlta(ej: Ejecutor, id: number): Promise<(Alumno & { creadoEn: Date }) | null> {
  const [fila] = await ej
    .select({ ...columnas, creadoEn: alumno.creadoEn })
    .from(alumno)
    .where(eq(alumno.id, id));
  return fila ?? null;
}

// Para cambiar `activo` sin que otro pedido lo cambie en el medio.
export async function bloquear(ej: Ejecutor, id: number): Promise<{ activo: boolean } | null> {
  const [fila] = await ej.select({ activo: alumno.activo }).from(alumno).where(eq(alumno.id, id)).for('update');
  return fila ?? null;
}

export async function registrarCambiosDeEstado(ej: Ejecutor, cambios: NuevoCambioEstadoAlumno[]): Promise<void> {
  if (cambios.length === 0) return;
  await ej.insert(cambioEstadoAlumno).values(cambios);
}

// Para la actividad de la ficha, del más nuevo al más viejo.
export async function listarCambiosDeEstado(
  ej: Ejecutor,
  alumnoId: number,
): Promise<{ activo: boolean; registradoPor: number | null; registradoEn: Date }[]> {
  return ej
    .select({
      activo: cambioEstadoAlumno.activo,
      registradoPor: cambioEstadoAlumno.registradoPor,
      registradoEn: cambioEstadoAlumno.registradoEn,
    })
    .from(cambioEstadoAlumno)
    .where(eq(cambioEstadoAlumno.alumnoId, alumnoId))
    .orderBy(desc(cambioEstadoAlumno.registradoEn), desc(cambioEstadoAlumno.id));
}

// Los alumnos activos con su alta y su última reactivación: si no compró después, se cuenta desde ahí.
export async function listarActivosParaBaja(
  ej: Ejecutor,
): Promise<{ id: number; creadoEn: Date; reactivadoEn: Date | null }[]> {
  return ej
    .select({ id: alumno.id, creadoEn: alumno.creadoEn, reactivadoEn: max(cambioEstadoAlumno.registradoEn) })
    .from(alumno)
    .leftJoin(cambioEstadoAlumno, and(eq(cambioEstadoAlumno.alumnoId, alumno.id), eq(cambioEstadoAlumno.activo, true)))
    .where(eq(alumno.activo, true))
    .groupBy(alumno.id)
    .orderBy(alumno.id);
}

// Solo los que siguen activos: si otro pedido ya dio de baja a alguno, no se registra dos veces.
export async function darDeBaja(ej: Ejecutor, ids: number[]): Promise<number[]> {
  const filas = await ej
    .update(alumno)
    .set({ activo: false })
    .where(and(inArray(alumno.id, ids), eq(alumno.activo, true)))
    .returning({ id: alumno.id });
  return filas.map((fila) => fila.id).sort((a, b) => a - b);
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: Partial<NuevoAlumno>,
): Promise<Alumno | null> {
  if (Object.keys(cambios).length === 0) return buscarPorId(ej, id);
  const [fila] = await ej.update(alumno).set(cambios).where(eq(alumno.id, id)).returning(columnas);
  return fila ?? null;
}

function filtroDe(filtros: ListadoQuery): SQL | undefined {
  const condiciones: SQL[] = [];
  if (!filtros.incluirInactivos) condiciones.push(eq(alumno.activo, true));
  if (filtros.q) {
    const patron = patronContiene(filtros.q);
    // Nombre completo en los dos órdenes, así "martina garcia" y "garcia martina" encuentran lo mismo.
    condiciones.push(
      or(
        sql`unaccent(lower(${alumno.nombre} || ' ' || ${alumno.apellido})) like unaccent(lower(${patron}))`,
        sql`unaccent(lower(${alumno.apellido} || ' ' || ${alumno.nombre})) like unaccent(lower(${patron}))`,
        sql`${alumno.dni} like ${patron}`,
      )!,
    );
  }
  return condiciones.length > 0 ? and(...condiciones) : undefined;
}

export async function listar(
  ej: Ejecutor,
  filtros: ListadoQuery,
): Promise<{ items: Alumno[]; total: number }> {
  const filtro = filtroDe(filtros);
  const items = await ej
    .select(columnas)
    .from(alumno)
    .where(filtro)
    .orderBy(asc(alumno.apellido), asc(alumno.nombre), asc(alumno.id))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);
  const [conteo] = await ej.select({ total: count() }).from(alumno).where(filtro);

  return { items, total: conteo?.total ?? 0 };
}

// Todos los alumnos del filtro, sin paginar: para contar cuántos tienen el pack vigente.
export async function listarTodos(ej: Ejecutor, filtros: ListadoQuery): Promise<{ id: number; activo: boolean }[]> {
  return ej.select({ id: alumno.id, activo: alumno.activo }).from(alumno).where(filtroDe(filtros));
}
