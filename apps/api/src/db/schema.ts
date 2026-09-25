import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

const id = () => bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const referencia = () => bigint({ mode: 'number' });
const instante = () => timestamp({ withTimezone: true });

export const rolEnum = pgEnum('rol', ['admin', 'recepcion']);
export const medioPagoEnum = pgEnum('medio_pago', [
  'efectivo',
  'transferencia',
  'mercado_pago',
  'otro',
]);
export const estadoSesionEnum = pgEnum('estado_sesion', ['programada', 'dictada', 'cancelada']);

export const usuario = pgTable('usuario', {
  id: id(),
  nombre: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  rol: rolEnum().notNull(),
  activo: boolean().notNull().default(true),
  creadoEn: instante().notNull().defaultNow(),
});

export const sesionUsuario = pgTable(
  'sesion_usuario',
  {
    id: text().primaryKey(),
    usuarioId: referencia()
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    expiraEn: instante().notNull(),
    creadoEn: instante().notNull().defaultNow(),
  },
  (t) => [index('sesion_usuario_usuario_idx').on(t.usuarioId)],
);

export const alumno = pgTable(
  'alumno',
  {
    id: id(),
    nombre: text().notNull(),
    apellido: text().notNull(),
    dni: text().unique(),
    email: text(),
    telefono: text(),
    fechaNacimiento: date(),
    contactoEmergencia: text(),
    notas: text(),
    activo: boolean().notNull().default(true),
    creadoEn: instante().notNull().defaultNow(),
  },
  (t) => [index('alumno_busqueda_idx').on(sql`lower(${t.apellido})`, sql`lower(${t.nombre})`)],
);

export const profesor = pgTable('profesor', {
  id: id(),
  nombre: text().notNull(),
  apellido: text().notNull(),
  dni: text().unique(),
  email: text(),
  telefono: text(),
  aliasCbu: text(),
  activo: boolean().notNull().default(true),
  creadoEn: instante().notNull().defaultNow(),
});

export const porcentajeProfesor = pgTable(
  'porcentaje_profesor',
  {
    id: id(),
    profesorId: referencia()
      .notNull()
      .references(() => profesor.id),
    porcentajeBp: smallint().notNull(),
    vigenteDesde: date().notNull(),
  },
  (t) => [
    unique('porcentaje_profesor_vigencia_uq').on(t.profesorId, t.vigenteDesde),
    check('porcentaje_bp_rango', sql`${t.porcentajeBp} > 0 and ${t.porcentajeBp} <= 10000`),
  ],
);

export const pack = pgTable(
  'pack',
  {
    id: id(),
    nombre: text().notNull(),
    cantidadClases: integer().notNull(),
    precio: bigint({ mode: 'number' }).notNull(),
    activo: boolean().notNull().default(true),
  },
  (t) => [
    check('pack_cantidad_positiva', sql`${t.cantidadClases} > 0`),
    check('pack_precio_no_negativo', sql`${t.precio} >= 0`),
  ],
);

export const pago = pgTable(
  'pago',
  {
    id: id(),
    alumnoId: referencia()
      .notNull()
      .references(() => alumno.id),
    packId: referencia()
      .notNull()
      .references(() => pack.id),
    cantidadClases: integer().notNull(),
    monto: bigint({ mode: 'number' }).notNull(),
    medio: medioPagoEnum().notNull(),
    fecha: instante().notNull().defaultNow(),
    venceEl: date().notNull(),
    registradoPor: referencia()
      .notNull()
      .references(() => usuario.id),
    anuladoEn: instante(),
    motivoAnulacion: text(),
  },
  (t) => [
    index('pago_alumno_idx').on(t.alumnoId, t.venceEl),
    check('pago_cantidad_positiva', sql`${t.cantidadClases} > 0`),
    check('pago_monto_no_negativo', sql`${t.monto} >= 0`),
  ],
);

export const clase = pgTable(
  'clase',
  {
    id: id(),
    estilo: text().notNull(),
    nivel: text(),
    diaSemana: smallint().notNull(),
    horaInicio: time().notNull(),
    horaFin: time().notNull(),
    profesorId: referencia()
      .notNull()
      .references(() => profesor.id),
    activa: boolean().notNull().default(true),
  },
  (t) => [
    check('clase_dia_valido', sql`${t.diaSemana} between 1 and 7`),
    check('clase_horario_valido', sql`${t.horaFin} > ${t.horaInicio}`),
  ],
);

export const sesion = pgTable(
  'sesion',
  {
    id: id(),
    claseId: referencia()
      .notNull()
      .references(() => clase.id),
    fecha: date().notNull(),
    profesorId: referencia()
      .notNull()
      .references(() => profesor.id),
    estado: estadoSesionEnum().notNull().default('programada'),
  },
  (t) => [
    unique('sesion_clase_fecha_uq').on(t.claseId, t.fecha),
    index('sesion_profesor_fecha_idx').on(t.profesorId, t.fecha),
  ],
);

export const asistencia = pgTable(
  'asistencia',
  {
    id: id(),
    sesionId: referencia()
      .notNull()
      .references(() => sesion.id),
    alumnoId: referencia()
      .notNull()
      .references(() => alumno.id),
    pagoId: referencia()
      .notNull()
      .references(() => pago.id),
    valorClase: bigint({ mode: 'number' }).notNull(),
    porcentajeBp: smallint().notNull(),
    registradoPor: referencia()
      .notNull()
      .references(() => usuario.id),
    registradoEn: instante().notNull().defaultNow(),
  },
  (t) => [
    unique('asistencia_sesion_alumno_uq').on(t.sesionId, t.alumnoId),
    index('asistencia_pago_idx').on(t.pagoId),
    check('asistencia_valor_no_negativo', sql`${t.valorClase} >= 0`),
    check('asistencia_porcentaje_rango', sql`${t.porcentajeBp} > 0 and ${t.porcentajeBp} <= 10000`),
  ],
);

export const liquidacion = pgTable(
  'liquidacion',
  {
    id: id(),
    profesorId: referencia()
      .notNull()
      .references(() => profesor.id),
    periodo: date().notNull(),
    monto: bigint({ mode: 'number' }).notNull(),
    pagadoEn: instante(),
    registradoPor: referencia()
      .notNull()
      .references(() => usuario.id),
  },
  (t) => [
    unique('liquidacion_profesor_periodo_uq').on(t.profesorId, t.periodo),
    check('liquidacion_periodo_dia_uno', sql`extract(day from ${t.periodo}) = 1`),
    check('liquidacion_monto_no_negativo', sql`${t.monto} >= 0`),
  ],
);

export type Usuario = typeof usuario.$inferSelect;
export type NuevoUsuario = typeof usuario.$inferInsert;
export type Alumno = typeof alumno.$inferSelect;
export type NuevoAlumno = typeof alumno.$inferInsert;
export type Profesor = typeof profesor.$inferSelect;
export type NuevoProfesor = typeof profesor.$inferInsert;
export type Pack = typeof pack.$inferSelect;
export type NuevoPack = typeof pack.$inferInsert;
export type Pago = typeof pago.$inferSelect;
export type NuevoPago = typeof pago.$inferInsert;
export type Clase = typeof clase.$inferSelect;
export type NuevaClase = typeof clase.$inferInsert;
export type Sesion = typeof sesion.$inferSelect;
export type NuevaSesion = typeof sesion.$inferInsert;
export type Asistencia = typeof asistencia.$inferSelect;
export type NuevaAsistencia = typeof asistencia.$inferInsert;
export type Liquidacion = typeof liquidacion.$inferSelect;
export type NuevaLiquidacion = typeof liquidacion.$inferInsert;
