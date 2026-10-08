# Renombrar horario y clase

**Estado:** en curso
**Depende de:** ficha-del-profesor (23)
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; la tabla que era `clase` se llama `horario`, la que era `sesion` se llama `clase`, y una búsqueda de `sesion` en el código solo encuentra la sesión de login.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

## Por qué

- "Sesión" nombraba dos cosas: la sesión de login (`sesion_usuario`, `auth/sesiones.repository.ts`) y la clase de una fecha.
- Las features 25 y 26 agregan la clase única, que no sale de ningún horario que se repite. Con los nombres viejos sería "una sesión con `clase_id` nulo"; con los nuevos es "una clase sin horario".
- El código ya le decía "horario" a lo que se repite: `HorarioDelProfesor.tsx`, "el horario de todo el estudio" en `clases/api.ts`.
- Así habla el estudio: "el horario de los jueves" y "la clase del jueves 15".

Es la primera de tres features. Después vienen [clases por adelantado](clases-por-adelantado.md) (25) y [grilla semanal](grilla-semanal.md) (26). Esta solo cambia nombres: las reglas y las respuestas de la API son las mismas, con los campos y las rutas renombrados.

## Los nombres nuevos

### Base de datos

| Antes | Después |
|---|---|
| tabla `clase` | `horario` |
| `clase.activa` | `horario.activo` (como `pack.activo` y `profesor.activo`) |
| check `clase_dia_valido` | `horario_dia_valido` |
| check `clase_horario_valido` | `horario_horas_validas` |
| tabla `sesion` | `clase` |
| `sesion.clase_id` | `clase.horario_id` |
| unique `sesion_clase_fecha_uq` | `clase_horario_fecha_uq` |
| índice `sesion_profesor_fecha_idx` | `clase_profesor_fecha_idx` |
| enum `estado_sesion` | `estado_clase` |
| `asistencia.sesion_id` | `asistencia.clase_id` |
| unique `asistencia_sesion_alumno_uq` | `asistencia_clase_alumno_uq` |
| claves foráneas, secuencias de identidad y claves primarias (`sesion_clase_id_clase_id_fk`, `clase_id_seq`, `clase_pkey`...) | los nombres que Drizzle arma con la tabla y la columna nuevas (`clase_horario_id_horario_id_fk`, `horario_id_seq`, `horario_pkey`...) |

La tabla `sesion_usuario` no cambia: es la del login.

### API

| Antes | Después |
|---|---|
| `modules/clases/clases.*` (lo que se repite) | `modules/horarios/horarios.*` |
| `modules/clases/sesiones.*` | `modules/clases/clases.*` |
| `/api/clases` | `/api/horarios` |
| `/api/sesiones`, `/api/sesiones/dia`, `/api/sesiones/:id` | `/api/clases`, `/api/clases/dia`, `/api/clases/:id` |
| `/api/sesiones/:id/asistencias` | `/api/clases/:id/asistencias` |
| `listarClases`, `crearClase`, `actualizarClase` del horario | `listarHorarios`, `crearHorario`, `actualizarHorario` |
| `abrirSesion`, `bloquearSesion`, `agendaDelDia` | `abrirClase`, `bloquearClase`, `agendaDelDia` |

Los mensajes de error siguen la palabra: "El horario de Salsa está dado de baja" en lugar de "La clase Salsa está dada de baja".

### Tipos compartidos (`packages/shared`)

| Antes | Después |
|---|---|
| `Clase`, `CrearClaseInput`, `ActualizarClaseInput`, `crearClaseSchema`, `actualizarClaseSchema`, `clasesQuerySchema` | `Horario`, `CrearHorarioInput`, `ActualizarHorarioInput`, `crearHorarioSchema`, `actualizarHorarioSchema`, `horariosQuerySchema` |
| `Sesion`, `SesionDetalle`, `EstadoSesion` | `Clase`, `ClaseDetalle`, `EstadoClase` |
| `abrirSesionSchema`, `AbrirSesionInput`, `actualizarSesionSchema`, `ActualizarSesionInput` | `abrirClaseSchema`, `AbrirClaseInput`, `actualizarClaseSchema`, `ActualizarClaseInput` |
| `ClaseDelDia` con `claseId` y `sesion` | `HorarioDelDia` con `horarioId` y `clase` |
| `sesionId` en asistencias | `claseId` |
| `clases.ts` | `horarios.ts` (lo que se repite) y `clases.ts` (la de una fecha) |

### Web

| Antes | Después |
|---|---|
| `features/clases` (pantalla del horario completo) | `features/horarios` |
| ruta `/clases`, menú "Clases" | `/horarios`, menú "Horarios" |
| `SesionPage`, ruta `/sesiones/:id` | `ClasePage`, `/clases/:id` |
| pestaña "Clases" de la ficha del profesor | "Horario" |

### Lo que no cambia

- `pack.cantidad_clases` y `pago.cantidad_clases`: cuentan clases a las que se asiste, que es justo lo que ahora se llama `clase`.
- `clasesPorSemana` y `diasConClase` del listado de profesores: un profesor con cinco horarios da cinco clases por semana.
- Los textos que ya dicen "clase" en el sentido de la de una fecha: "No hay clases este día", "Tomar asistencia".

## El orden

Los dos cambios se cruzan: el nombre `Clase` hoy es lo que se repite y después es la de una fecha. Para que cada tarea compile y pase sus tests:

1. **La base primero.** Se renombran tablas y columnas en la migración y en los nombres de `pgTable`, pero los identificadores de TypeScript (`clase`, `sesion`) quedan igual. El código sigue compilando.
2. **Después el horario**, en todas las capas: base, API, tipos, web y e2e. Al terminar, no queda ningún `Clase` que signifique "lo que se repite".
3. **Después la clase**, en todas las capas. Recién ahí `Sesion` pasa a `Clase`, que ya está libre.
4. **La documentación** al final.

## La migración con Drizzle

`drizzle-kit generate` pregunta en la terminal si un cambio es un renombre o una tabla nueva, y un agente no puede responder esa pregunta. La migración se escribe a mano:

1. `pnpm --filter @studio/api db:generate --custom --name renombrar_horario_y_clase` crea el archivo vacío y la entrada del journal.
2. El SQL va escrito a mano: `alter table ... rename to`, `rename column`, `rename constraint`, `alter index ... rename to`, `alter sequence ... rename to`, `alter type ... rename to`. El orden importa: primero `clase` pasa a `horario` con su secuencia y su clave primaria, y recién después `sesion` pasa a `clase`. Las claves foráneas se renombran a los nombres que Drizzle arma (`tabla_columna_tablareferida_columnareferida_fk`); si no, el próximo `db:generate` querría borrarlas y crearlas.
3. El snapshot que crea `--custom` es una copia del anterior. Se reemplaza por uno generado desde el `schema.ts` nuevo en una carpeta temporal: sin snapshots previos, `drizzle-kit` no pregunta nada. Se copia ese JSON y se le ponen el `id` nuevo y el `prevId` del `0002`.
4. Verificación: `db:generate` corrido después tiene que responder que no hay cambios. Si genera algo, el snapshot no coincide con `schema.ts`.

Un renombre en Postgres solo cambia metadatos: las filas, los ids y las claves foráneas quedan iguales.

## Qué no se implementa

- **Alias de las rutas viejas.** La web y la API se compilan y se sirven juntas: no hay un cliente viejo que siga pidiendo `/api/sesiones`.
- **Reescribir los archivos de features anteriores.** Son el historial de cómo se hizo cada cosa. El índice anota el cambio de nombres en la bitácora.
- **Cambiar el comportamiento.** Cualquier regla nueva va en las features 25 y 26.

## Tests

No hay tests nuevos: esta feature no cambia lo que hace el sistema. Los que existen se adaptan a los nombres nuevos.

| Verificación | Tipo | Qué la rompe |
|---|---|---|
| Los tests de la API, de la web y el e2e pasan con los nombres nuevos | Todos | Un nombre a medio cambiar: una ruta que la web pide con el nombre viejo, un campo que la API devuelve con otro nombre |
| `TABLAS` de `apps/api/test/db.ts` lista `horario` y `clase` | Integración | Si queda `sesion`, el `truncate` de cada test falla porque la tabla no existe |
| `db:generate` no genera nada después de la migración | Manual | Si el snapshot no coincide con `schema.ts`, la próxima migración intenta renombrar otra vez |
| La migración sobre la base de desarrollo conserva sus 3 horarios | Manual | Un `drop` y `create` en lugar de un `rename` borra los datos |
| `grep -ri sesion apps packages e2e` solo encuentra el login | Manual | Un identificador que quedó con el nombre viejo |

## Tareas

### Tarea 1: Renombrar en la base

**Archivos:**
- Crear: `apps/api/src/db/migrations/0003_renombrar_horario_y_clase.sql` y su snapshot
- Modificar: `apps/api/src/db/schema.ts` (solo los nombres dentro de `pgTable`, columnas, checks, índices y el enum), `apps/api/test/db.ts` (`TABLAS`), `apps/api/src/modules/clases/clases.service.ts` (el nombre del check en `esViolacionCheck`), `apps/api/src/modules/asistencias/asistencias.service.ts` (el nombre del `unique` en `esViolacionUnica`)
- Test: los tests de la API que existen

- [x] **Paso 1:** cambiar `TABLAS` a `horario` y `clase` y el nombre del check que espera `clases.service.ts`.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test` y verificar que falla porque la tabla `horario` no existe.
- [x] **Paso 3:** escribir la migración a mano y cambiar los nombres en `schema.ts`. Los identificadores de TypeScript (`export const clase`, `export const sesion`, `claseId`, `sesionId`, `activa`) quedan igual en esta tarea: solo cambia lo que va a la base. Con `casing: 'snake_case'` el nombre de la columna sale de la clave de TypeScript, así que las tres columnas renombradas llevan el nombre explícito (`referencia('horario_id')`, `referencia('clase_id')`, `boolean('activo')`). Las tareas 2 y 3 renombran las claves y sacan esos nombres explícitos.
- [x] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan. Correr `pnpm --filter @studio/api db:generate` y verificar que no genera cambios. El plan no nombraba `asistencia_sesion_alumno_uq`, que `asistencias.service` usa para avisar de una asistencia repetida: lo encontró el test de esa regla.
- [x] **Paso 5:** commit `refactor(db): renombrar clase a horario y sesion a clase`.

### Tarea 2: El horario en todas las capas

**Archivos:**
- Mover: `apps/api/src/modules/clases/clases.{repository,service,routes,test}.ts` a `apps/api/src/modules/horarios/horarios.*`, `packages/shared/src/clases.ts` (la parte del horario) a `horarios.ts`, `apps/web/src/features/clases` a `features/horarios`
- Modificar: `apps/api/src/app.ts`, `schema.ts` (`export const horario`), los services que usan el horario (sesiones, profesores, listado de profesores), `apps/web/src/rutas.tsx`, `components/Layout.tsx`, la ficha del profesor, `apps/web/test/datos.ts`, el recorrido de `e2e`

- [x] **Paso 1:** cambiar los tests a los nombres nuevos: las rutas `/api/horarios`, los tipos `Horario`, la pantalla `/horarios` con el menú "Horarios" y la pestaña "Horario" de la ficha.
- [x] **Paso 2:** correr `pnpm test` y verificar que falla por las rutas y los tipos que no existen.
- [x] **Paso 3:** renombrar en la API, en shared y en la web. Además de los nombres:
  - `sesiones.service` usaba el repository de horarios, que con el módulo aparte rompía la regla "un módulo usa el service de otro". Ahora llama a `obtenerHorario` y a `listarHorariosDelDia` de `horarios.service`.
  - `horaHHMM` pasó de `clases.repository` a `lib/postgres.ts`, porque la usan los dos módulos.
  - `PersonaResumen` pasó a `comun.ts`: la usan horarios, clases, alumnos y liquidaciones.
  - Los textos de la pantalla de horarios no cambian ("Horario de clases", "Nueva clase", "Mostrar clases dadas de baja"): así habla el estudio. Cambian la ruta, el menú ("Horarios"), la pestaña de la ficha ("Horario") y el nombre del ícono.
  - Se sumaron dos aserciones: el menú "Horarios" marcado en `/horarios` y la pestaña "Horario" elegida al abrir la ficha.
- [x] **Paso 4:** correr `pnpm test`, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 5:** commit `refactor(horarios): lo que se repite cada semana pasa a llamarse horario`.

### Tarea 3: La clase en todas las capas

**Archivos:**
- Mover: `apps/api/src/modules/clases/sesiones.*` a `clases.*`, `apps/web/src/features/agenda/SesionPage.tsx` a `ClasePage.tsx` y `sesion.test.tsx` a `clase.test.tsx`
- Modificar: `schema.ts` (`export const clase`, `asistencia.claseId`), asistencias, liquidaciones, `packages/shared` (`clases.ts`, `asistencias.ts`, `liquidaciones.ts`), la agenda y la liquidación en la web, `apps/web/test/datos.ts`, el recorrido de `e2e`

- [x] **Paso 1:** cambiar los tests a los nombres nuevos: `/api/clases/:id`, `/api/clases/:id/asistencias`, `claseId` en las asistencias, la ruta `/clases/:id` de la web.
- [x] **Paso 2:** correr `pnpm test` y verificar que falla por las rutas y los campos que no existen.
- [x] **Paso 3:** renombrar en la API, en shared y en la web. También los nombres compuestos que el plan no listaba: `DetalleSesion` pasa a `DetalleDeClase`, `listarAsistenciasDeSesion` a `listarAsistenciasDeClase`, y en `AgendaPage` cada fila recibe `horario` (un `HorarioDelDia`) con su `clase` adentro. Las claves de consulta de la web pasan de `['sesiones', id]` a `['clases', id]`; las del horario ya eran `['horarios']`.
- [x] **Paso 4:** correr `pnpm test`, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan. Correr `grep -ri sesion apps packages e2e --include=*.ts --include=*.tsx` y verificar que solo aparece el login.
- [x] **Paso 5:** commit `refactor(clases): la clase de una fecha deja de llamarse sesión`.

### Tarea 4: La documentación

**Archivos:**
- Modificar: `docs/estructura de base de datos.md`, `docs/arquitectura general.md`, `docs/arquitectura backend.md`, `docs/arquitectura frontend.md`, `CLAUDE.md` (reglas del dominio y notas del entorno que nombran sesiones o `/agenda`)

- [ ] **Paso 1:** reemplazar los nombres en los documentos de diseño y en las reglas del dominio de CLAUDE.md. La regla queda: "`horario` es lo que se repite cada semana; `clase` es la de una fecha. La asistencia apunta a la clase, nunca al horario".
- [ ] **Paso 2:** correr `grep -ri sesion docs/*.md CLAUDE.md` y verificar que solo aparece el login.
- [ ] **Paso 3:** commit `docs: horario y clase en los documentos de diseño`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [ ] `pnpm e2e` pasa.
- [ ] Contra la base de desarrollo: `pnpm --filter @studio/api db:migrate` conserva los 3 horarios, y la agenda y la ficha del profesor los muestran.
