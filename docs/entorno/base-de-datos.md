# Base de datos y migraciones

## Migraciones

- `pnpm --filter @studio/api db:generate --name <nombre>` genera la migración desde `schema.ts`.
- `pnpm dev` no la aplica: en la base de desarrollo hay que correr `pnpm --filter @studio/api db:migrate`.
- Una tabla nueva también va en `TABLAS` de `apps/api/test/db.ts`.

## Renombrar una tabla o una columna

`db:generate` pregunta en la terminal si es un renombre, y un agente no puede contestar. Entonces:

1. Escribí la migración a mano: `db:generate --custom --name <nombre>`.
2. Regenerá el snapshot desde `schema.ts` en una carpeta temporal: `pnpm exec drizzle-kit generate --dialect postgresql --schema ./src/db/schema.ts --out <carpeta> --casing snake_case`. Copiá el `id` y el `prevId` del snapshot que creó `--custom`.
3. Renombrá también las claves foráneas, las secuencias y las claves primarias.
4. Corré `db:generate`: tiene que decir que no hay cambios.

Ejemplo: la migración `0003_renombrar_horario_y_clase`.

## Consultas con Drizzle

Drizzle escribe las columnas sin la tabla cuando la consulta es de una sola tabla. En una subconsulta con `sql`, `${profesor.id}` sale como `"id"` y puede apuntar a la tabla de adentro. Para ver el SQL sin ejecutarlo: `.toSQL()`.

Le pasa a `clasesUsadasSql` de `pagos.repository.ts`: en un `select` que sale solo de `pago`, su `pago.id` se lee como `asistencia.id` y cuenta mal sin dar error. Funciona en consultas con `join`. En una de una sola tabla, se cuentan las asistencias con `leftJoin(asistencia, ...)`, `count(asistencia.id)` y `groupBy(pago.id)`, como `listarVencidosEnElPeriodo`.
