# Esquema de base de datos y migraciones

**Estado:** lista  
**Depende de:** monorepo-y-api  
**Listo cuando:** `pnpm --filter @studio/api test` pasa con Docker corriendo y `\dt` lista las 11 tablas.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez, de arriba hacia abajo, y marcá cada checkbox recién cuando su comando de verificación pasa.

**Objetivo:** definir todas las tablas con Drizzle, generar la migración inicial y dejar armada la infraestructura de tests de integración contra un Postgres real.

**Arquitectura:** el esquema vive en `src/db/schema.ts` como única fuente de verdad. `drizzle-kit` genera desde ahí las migraciones SQL versionadas. Los tests levantan un Postgres con Testcontainers, aplican las migraciones y corren contra esa base.

**Stack:** Drizzle ORM, drizzle-kit, driver `postgres` (postgres.js), Vitest, Testcontainers.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md)

## Restricciones globales

- Node >= 22, pnpm >= 9, TypeScript `strict`, ESM.
- Todo el dinero es pesos enteros, en columnas `bigint` leídas como `number` (`mode: 'number'`). No hay centavos en ninguna parte del sistema.
- Los porcentajes son enteros en puntos básicos (`porcentaje_bp`), de 1 a 10000.
- Nombres de tablas y columnas en snake_case y en singular (`alumno`, `pago`, `sesion_usuario`).
- Las claves foráneas son `not null`, salvo que el documento del modelo diga lo contrario.
- El esquema se cambia solo editando `schema.ts` y generando una migración. Nunca se edita a mano una migración ya aplicada.
- Zona horaria del estudio: `America/Argentina/Buenos_Aires`.

---

### Tarea 1: Dependencias de base de datos y cliente

**Archivos:**
- Modificar: `apps/api/package.json`
- Crear: `apps/api/src/db/client.ts`
- Crear: `apps/api/drizzle.config.ts`

**Interfaces:**
- Consume: `config.databaseUrl` de `src/config.ts` (feature monorepo-y-api, tarea 4).
- Produce:
  - `crearCliente(url: string): { sql: Sql; db: DrizzleDb }` exportado desde `src/db/client.ts`. `DrizzleDb` es el tipo de la instancia de Drizzle con el esquema completo.
  - `db` y `sql`: instancias por defecto creadas con `config.databaseUrl`, usadas por la app.

- [x] **Paso 1: Instalar dependencias**

Correr:

```bash
pnpm --filter @studio/api add drizzle-orm postgres
pnpm --filter @studio/api add -D drizzle-kit @testcontainers/postgresql
```

- [x] **Paso 2: Crear el cliente**

`apps/api/src/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export function crearCliente(url: string) {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

const cliente = crearCliente(config.databaseUrl);

export const sql = cliente.sql;
export const db = cliente.db;
export type DrizzleDb = typeof db;
```

- [x] **Paso 3: Crear la configuración de drizzle-kit**

`apps/api/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://studio:studio@localhost:5433/studio_manager',
  },
  casing: 'snake_case',
});
```

- [x] **Paso 4: Agregar scripts de base a apps/api/package.json**

Agregar dentro de `"scripts"`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio"
```

- [x] **Paso 5: Verificar que compila**

Correr: `pnpm --filter @studio/api typecheck`
Esperado: FALLA con "Cannot find module './schema.ts'". Es lo esperado: el esquema se crea en la tarea 2.

- [x] **Paso 6: Commit**

```bash
git add apps/api/package.json apps/api/drizzle.config.ts apps/api/src/db/client.ts pnpm-lock.yaml
git commit -m "chore(api): agregar Drizzle, driver de Postgres y configuración de drizzle-kit"
```

---

### Tarea 2: Esquema completo

**Archivos:**
- Crear: `apps/api/src/db/schema.ts`

**Interfaces:**
- Consume: nada.
- Produce: las tablas `usuario`, `sesionUsuario`, `alumno`, `profesor`, `porcentajeProfesor`, `pack`, `pago`, `clase`, `sesion`, `asistencia`, `liquidacion`, y los enums `rolEnum`, `medioPagoEnum`, `estadoSesionEnum`. Cada tabla exporta además sus tipos `select` e `insert`, por ejemplo `type Alumno` y `type NuevoAlumno`.

- [x] **Paso 1: Escribir el esquema**

`apps/api/src/db/schema.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
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

export const rolEnum = pgEnum('rol', ['admin', 'recepcion']);
export const medioPagoEnum = pgEnum('medio_pago', [
  'efectivo',
  'transferencia',
  'mercado_pago',
  'otro',
]);
export const estadoSesionEnum = pgEnum('estado_sesion', ['programada', 'dictada', 'cancelada']);

export const usuario = pgTable('usuario', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  nombre: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  rol: rolEnum().notNull(),
  activo: boolean().notNull().default(true),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const sesionUsuario = pgTable(
  'sesion_usuario',
  {
    id: text().primaryKey(),
    usuarioId: bigint({ mode: 'number' })
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sesion_usuario_usuario_idx').on(t.usuarioId)],
);

export const alumno = pgTable(
  'alumno',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    nombre: text().notNull(),
    apellido: text().notNull(),
    dni: text().unique(),
    email: text(),
    telefono: text(),
    fechaNacimiento: date(),
    contactoEmergencia: text(),
    notas: text(),
    activo: boolean().notNull().default(true),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('alumno_busqueda_idx').on(sql`lower(${t.apellido})`, sql`lower(${t.nombre})`)],
);

export const profesor = pgTable('profesor', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  nombre: text().notNull(),
  apellido: text().notNull(),
  dni: text().unique(),
  email: text(),
  telefono: text(),
  aliasCbu: text(),
  activo: boolean().notNull().default(true),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const porcentajeProfesor = pgTable(
  'porcentaje_profesor',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    profesorId: bigint({ mode: 'number' })
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
    id: bigserial({ mode: 'number' }).primaryKey(),
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
    id: bigserial({ mode: 'number' }).primaryKey(),
    alumnoId: bigint({ mode: 'number' })
      .notNull()
      .references(() => alumno.id),
    packId: bigint({ mode: 'number' })
      .notNull()
      .references(() => pack.id),
    cantidadClases: integer().notNull(),
    monto: bigint({ mode: 'number' }).notNull(),
    medio: medioPagoEnum().notNull(),
    fecha: timestamp({ withTimezone: true }).notNull().defaultNow(),
    venceEl: date().notNull(),
    registradoPor: bigint({ mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    anuladoEn: timestamp({ withTimezone: true }),
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
    id: bigserial({ mode: 'number' }).primaryKey(),
    estilo: text().notNull(),
    nivel: text(),
    diaSemana: smallint().notNull(),
    horaInicio: time().notNull(),
    horaFin: time().notNull(),
    profesorId: bigint({ mode: 'number' })
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
    id: bigserial({ mode: 'number' }).primaryKey(),
    claseId: bigint({ mode: 'number' })
      .notNull()
      .references(() => clase.id),
    fecha: date().notNull(),
    profesorId: bigint({ mode: 'number' })
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
    id: bigserial({ mode: 'number' }).primaryKey(),
    sesionId: bigint({ mode: 'number' })
      .notNull()
      .references(() => sesion.id),
    alumnoId: bigint({ mode: 'number' })
      .notNull()
      .references(() => alumno.id),
    pagoId: bigint({ mode: 'number' })
      .notNull()
      .references(() => pago.id),
    valorClase: bigint({ mode: 'number' }).notNull(),
    porcentajeBp: smallint().notNull(),
    registradoPor: bigint({ mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    registradoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
    id: bigserial({ mode: 'number' }).primaryKey(),
    profesorId: bigint({ mode: 'number' })
      .notNull()
      .references(() => profesor.id),
    periodo: date().notNull(),
    monto: bigint({ mode: 'number' }).notNull(),
    pagadoEn: timestamp({ withTimezone: true }),
    registradoPor: bigint({ mode: 'number' })
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
```

- [x] **Paso 2: Verificar tipos**

Correr: `pnpm --filter @studio/api typecheck`
Esperado: sin errores.

- [x] **Paso 3: Commit**

```bash
git add apps/api/src/db/schema.ts
git commit -m "feat(db): definir el esquema completo con Drizzle"
```

---

### Tarea 3: Migración inicial

**Archivos:**
- Crear: `apps/api/src/db/migrations/0000_*.sql` (lo genera drizzle-kit)

**Interfaces:**
- Consume: `schema.ts` de la tarea 2.
- Produce: la carpeta `src/db/migrations` con el SQL inicial y su metadata, que consume el runner de migraciones de la tarea 4.

- [x] **Paso 1: Generar la migración**

Correr: `pnpm --filter @studio/api db:generate`
Esperado: crea `src/db/migrations/0000_<nombre>.sql` y la carpeta `meta/`.

- [x] **Paso 2: Revisar el SQL generado**

Abrir el archivo `.sql` y verificar que estén:
- los 3 tipos enum;
- las 11 tablas;
- los `check` de `porcentaje_bp`, montos, `dia_semana`, horarios y periodo;
- los `unique` de `sesion (clase_id, fecha)` y `asistencia (sesion_id, alumno_id)`.

Si falta alguno, corregir `schema.ts`, borrar la carpeta `migrations` y volver a generar.

- [x] **Paso 3: Aplicar la migración a la base local**

Correr: `pnpm db:up` y después `pnpm --filter @studio/api db:migrate`. `drizzle.config.ts` usa la base local por defecto si no hay `DATABASE_URL`.
Esperado: `migrations applied successfully`.

- [x] **Paso 4: Verificar las tablas en la base**

Correr:

```bash
docker exec studio-manager-db psql -U studio -d studio_manager -c "\dt"
```

Esperado: se listan las 11 tablas en el esquema `public`. Drizzle guarda el registro de migraciones en `drizzle.__drizzle_migrations`, en otro esquema, así que no aparece en esta lista.

- [x] **Paso 5: Commit**

```bash
git add apps/api/src/db/migrations
git commit -m "feat(db): generar la migración inicial"
```

---

### Tarea 4: Infraestructura de tests contra Postgres real

> Cambio respecto del plan original: en lugar de un contenedor por archivo de test, hay un solo Postgres por corrida. Con más de diez archivos de test, un contenedor por archivo suma minutos. Los archivos corren en serie y cada test limpia las tablas.

**Archivos:**
- Crear: `apps/api/test/global-setup.ts` — levanta el contenedor, aplica las migraciones y publica la URL con `provide('databaseUrl')`.
- Crear: `apps/api/test/setup-env.ts` — antes de cada archivo, pone `DATABASE_URL` del contenedor, un `SESSION_SECRET` de test y `NODE_ENV=test`. Así `src/db/client.ts` y `src/config.ts` funcionan igual que en producción.
- Crear: `apps/api/test/db.ts`
- Modificar: `apps/api/vitest.config.ts` — `globalSetup`, `setupFiles`, `fileParallelism: false`, `hookTimeout: 120_000`.
- Modificar: `apps/api/tsconfig.json` — incluir `test`, `vitest.config.ts` y `drizzle.config.ts`; quitar `rootDir`.
- Test: `apps/api/src/db/schema.test.ts`

**Interfaces:**
- Consume: `db` y `sql` de `src/db/client.ts`, y las migraciones de la tarea 3.
- Produce:
  - `levantarBaseDeTest(): Promise<{ db: DrizzleDb; limpiar: () => Promise<void>; cerrar: () => Promise<void> }>` exportado desde `test/db.ts`.
  - `limpiar()` hace `truncate ... restart identity cascade` de todas las tablas. Se llama en `beforeEach`.
  - `cerrar()` cierra el pool del archivo. Se llama en `afterAll`.
  - Todos los tests de integración de las features siguientes usan esta función.

**Nota para Windows:** testcontainers resuelve `localhost` a `::1` y Docker Desktop publica los puertos solo en IPv4. `global-setup.ts` define `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1` si no viene definido.

- [x] **Paso 1: Escribir el helper de base de test**

El código final está en `apps/api/test/`. `test/db.ts`:

```ts
import { sql as sqlTag } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';

const TABLAS = [
  'asistencia', 'liquidacion', 'sesion', 'clase', 'pago', 'pack',
  'porcentaje_profesor', 'profesor', 'alumno', 'sesion_usuario', 'usuario',
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
```

- [x] **Paso 2: Escribir el test que falla**

`apps/api/src/db/schema.test.ts`:

```ts
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { levantarBaseDeTest, type BaseDeTest } from '../../test/db.ts';
import { alumno, pack, profesor } from './schema.ts';

let base: BaseDeTest;

beforeAll(async () => {
  base = await levantarBaseDeTest();
}, 120_000);

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
});

describe('esquema', () => {
  it('inserta un alumno sin email ni dni', async () => {
    const [creado] = await base.db
      .insert(alumno)
      .values({ nombre: 'Ana', apellido: 'García' })
      .returning();

    expect(creado?.id).toBeGreaterThan(0);
    expect(creado?.activo).toBe(true);
    expect(creado?.email).toBeNull();
  });

  it('rechaza dos alumnos con el mismo dni', async () => {
    await base.db.insert(alumno).values({ nombre: 'Ana', apellido: 'García', dni: '30111222' });

    await expect(
      base.db.insert(alumno).values({ nombre: 'Otro', apellido: 'Alumno', dni: '30111222' }),
    ).rejects.toThrow();
  });

  it('guarda el precio del pack como entero en pesos', async () => {
    const [creado] = await base.db
      .insert(pack)
      .values({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600 })
      .returning();

    expect(creado?.precio).toBe(9600);
    expect(Number.isInteger(creado?.precio)).toBe(true);
  });

  it('rechaza un pack con precio negativo', async () => {
    await expect(
      base.db
        .insert(pack)
        .values({ nombre: 'Inválido', cantidadClases: 4, precio: -1 }),
    ).rejects.toThrow();
  });

  it('rechaza un porcentaje mayor a 10000 puntos básicos', async () => {
    const [profe] = await base.db
      .insert(profesor)
      .values({ nombre: 'Erik', apellido: 'Zapata' })
      .returning();

    await expect(
      base.db.execute(sql`
        insert into porcentaje_profesor (profesor_id, porcentaje_bp, vigente_desde)
        values (${profe!.id}, 10001, current_date)
      `),
    ).rejects.toThrow();
  });
});
```

- [x] **Paso 3: Correr el test y verificar que falla**

Correr: `pnpm --filter @studio/api test`
Esperado: FALLA, porque `test/db.ts` todavía no está incluido en el `tsconfig` ni el test puede resolver las migraciones. Si ya pasa en este punto, revisar que Docker esté corriendo.

- [x] **Paso 4: Incluir la carpeta test en el tsconfig**

En `apps/api/tsconfig.json`, cambiar `"include": ["src"]` por:

```json
"include": ["src", "test", "vitest.config.ts", "drizzle.config.ts"]
```

y quitar `"rootDir": "src"`.

- [x] **Paso 5: Correr los tests y verificar que pasan**

Correr: `pnpm --filter @studio/api test`
Esperado: los 5 tests de esquema PASAN. La primera corrida tarda más porque descarga la imagen de Postgres.

- [x] **Paso 6: Commit**

```bash
git add apps/api/test apps/api/src/db/schema.test.ts apps/api/tsconfig.json apps/api/vitest.config.ts
git commit -m "test(db): levantar Postgres con Testcontainers y verificar el esquema"
```

---

### Tarea 5: Datos de arranque

**Archivos:**
- Crear: `apps/api/src/db/seed.ts`
- Modificar: `apps/api/package.json`

**Interfaces:**
- Consume: `db` de `src/db/client.ts` y las tablas de `schema.ts`.
- Produce: el script `pnpm --filter @studio/api db:seed`, que inserta los packs iniciales. No inserta usuarios: eso lo hace la feature `autenticacion`, que ya tiene el hasheo de contraseñas.

- [x] **Paso 1: Escribir el seed**

> Cambio respecto del plan original: el seed inserta los packs solo si la tabla está vacía. `pack.nombre` no tiene `unique`, así que `onConflictDoNothing()` no evitaba duplicados al correrlo dos veces.

El código está en `apps/api/src/db/seed.ts`. Cuenta los packs; si hay alguno, no inserta nada.

- [x] **Paso 2: Agregar el script**

En `apps/api/package.json`, dentro de `"scripts"`:

```json
"db:seed": "tsx --env-file=.env src/db/seed.ts"
```

- [x] **Paso 3: Correr el seed y verificar**

Correr: `pnpm --filter @studio/api db:seed`
Esperado: imprime `Packs insertados: 4`. Una segunda corrida imprime `Ya hay 4 packs cargados. No se insertó nada.`

Verificar: `docker exec studio-manager-db psql -U studio -d studio_manager -c "select nombre, cantidad_clases, precio from pack order by id"`
Esperado: las 4 filas, con `precio` en pesos enteros (1500, 5200, 9600, 17600).

- [x] **Paso 4: Commit**

```bash
git add apps/api/src/db/seed.ts apps/api/package.json
git commit -m "feat(db): agregar seed con los packs iniciales"
```

---

## Verificación final del plan

- [x] `pnpm --filter @studio/api typecheck` pasa.
- [x] `pnpm --filter @studio/api test` pasa, con Docker corriendo.
- [x] `docker exec studio-manager-db psql -U studio -d studio_manager -c "\dt"` lista las 11 tablas.
- [x] Todas las columnas de dinero son `bigint` y guardan pesos enteros.
- [x] `git status` está limpio.
