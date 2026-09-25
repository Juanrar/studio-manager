import { sql as sqlTag } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';

const TABLAS = [
  'asistencia',
  'liquidacion',
  'sesion',
  'clase',
  'pago',
  'pack',
  'porcentaje_profesor',
  'profesor',
  'alumno',
  'sesion_usuario',
  'usuario',
];

export async function levantarBaseDeTest() {
  return {
    db,
    async limpiar() {
      await db.execute(sqlTag.raw(`truncate ${TABLAS.join(', ')} restart identity cascade`));
    },
    async cerrar() {
      await sql.end();
    },
  };
}

export type BaseDeTest = Awaited<ReturnType<typeof levantarBaseDeTest>>;
