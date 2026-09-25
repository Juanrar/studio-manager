import { and, asc, count, eq, or, sql, type SQL } from 'drizzle-orm';
import type { Alumno, ListadoQuery } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { alumno, type NuevoAlumno } from '../../db/schema.ts';
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

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: Partial<NuevoAlumno>,
): Promise<Alumno | null> {
  if (Object.keys(cambios).length === 0) return buscarPorId(ej, id);
  const [fila] = await ej.update(alumno).set(cambios).where(eq(alumno.id, id)).returning(columnas);
  return fila ?? null;
}

export async function listar(
  ej: Ejecutor,
  filtros: ListadoQuery,
): Promise<{ items: Alumno[]; total: number }> {
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
  const filtro = condiciones.length > 0 ? and(...condiciones) : undefined;

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
