# Clases generadas por adelantado

**Estado:** en curso
**Depende de:** renombrar-horario-y-clase (24)
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; cada horario activo tiene sus clases creadas desde la semana actual hasta el fin del mes siguiente, la agenda del día lista esas clases sin el paso de "abrir", y cambiar un horario cambia sus clases de esta semana en adelante sin tocar las que ya pasaron.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

## Por qué

La [grilla semanal](grilla-semanal.md) (26) deja cambiar una semana sola: mover una clase, cancelarla, ponerle un suplente o agregar una clase única. Hoy la clase de una fecha recién existe cuando recepción la abre para tomar asistencia, y su horario sale de la tabla `horario`. Con eso no se puede guardar "esta semana la salsa va el viernes" ni mostrar una semana futura.

Se eligió con el estudio crear las clases por adelantado. Arman la grilla, como mucho, hasta el mes siguiente, así que la cantidad de clases creadas tiene un tope chico: unos 30 horarios por 9 semanas son menos de 300 filas. Es la pregunta abierta 3 de [la estructura de la base](../estructura%20de%20base%20de%20datos.md).

Las otras opciones que se descartaron:

- **Crear la clase solo cuando hace falta**, como hoy, y combinar horarios con clases al leer. La combinación se repetía en la agenda, la grilla y la ficha del profesor. Además, una semana pasada sin clase se mostraba con el horario actual: para que no cambiara habría que guardar versiones del horario.
- **Una tabla de excepciones aparte.** El suplente y la cancelación quedaban en dos lugares: la clase y la excepción.

## Esquema

### `clase`: describe sola la clase de esa fecha

```sql
alter table clase
  alter column horario_id drop not null,       -- null: clase única (feature 26)
  add column semana      date not null,         -- lunes de la semana de la clase
  add column hora_inicio time not null,
  add column hora_fin    time not null,
  add column estilo      text not null,
  add column nivel       text,
  add constraint clase_horas_validas check (hora_fin > hora_inicio),
  add constraint clase_semana_lunes  check (extract(isodow from semana) = 1),
  add constraint clase_fecha_en_semana check (fecha between semana and semana + 6);

alter table clase drop constraint clase_horario_fecha_uq;
alter table clase add constraint clase_horario_semana_uq unique (horario_id, semana);
```

- **`semana` y `unique (horario_id, semana)`:** un horario se dicta una vez por semana, aunque la feature 26 mueva su clase a otro día. El generador inserta con `on conflict do nothing` y no duplica nada. El check de `fecha` impide que una clase salga de su semana. Las clases únicas tienen `horario_id` nulo y Postgres no compara nulos en un `unique`.
- **Hora, estilo y nivel copiados:** es la regla de siempre ("lo que ya pasó no cambia", como `pago.monto`). Si mañana cambia el horario, las semanas pasadas siguen mostrando lo que pasó. Hoy no es así: la clase de una fecha muestra la hora actual de su horario.
- **`horario_id` nulo** se permite desde ya para no hacer otra migración en la 26, pero en esta feature ninguna clase lo tiene nulo.

### `horario.vigente_desde`

```sql
alter table horario add column vigente_desde date not null;  -- lunes de la primera semana
alter table horario add constraint horario_vigente_desde_lunes check (extract(isodow from vigente_desde) = 1);
```

Un horario creado "desde la semana del 19" no aparece en las semanas del 5 y del 12. El nombre sigue a `porcentaje_profesor.vigente_desde`. En esta feature, crear un horario siempre usa el lunes de la semana actual; la 26 deja elegir otro.

### La migración de datos

En la misma migración, antes de los `not null`:

- Las clases existentes copian la hora, el estilo y el nivel de su horario, y `semana` sale de `fecha - (isodow - 1)`.
- Los horarios existentes reciben como `vigente_desde` el lunes de la semana de la migración.
- `asistencia`, `pago` y `liquidacion` no se tocan.

Drizzle no sabe generar los `update` del medio: la migración se genera con `db:generate` y se le agregan los `update` a mano antes de los `set not null`, como ya se hizo en `0001_unaccent`.

## Horizonte y generador

- **Horizonte:** desde el lunes de la semana actual hasta la semana que contiene el último día del mes siguiente. Con el reloj en el jueves 8 de octubre de 2026, va del lunes 5 de octubre al domingo 6 de diciembre: la semana del 30 de noviembre contiene el 30, último día de noviembre. Las funciones de fecha (`lunesDe`, `finDelHorizonte`) van en `lib/fechas.ts`.
- **`generarClases(ej, ahora, horarioId?)`** recorre cada horario activo y cada semana del horizonte desde su `vigente_desde`, e inserta la clase con los datos del horario y el profesor titular, con `on conflict (horario_id, semana) do nothing`. Nunca pisa una clase que ya existe. Con `horarioId`, recorre solo ese horario.
- **Cuándo corre:** al arrancar y cada hora, en `programarTareas` de `src/tareas.ts`, como la baja automática. También después de crear o reactivar un horario, solo para ese horario y dentro de la misma transacción.
- **Semanas pasadas:** nunca se generan. La semana actual se genera entera, incluidos los días que ya pasaron, para que recepción pueda cargar una asistencia atrasada como hoy.

## Cambios propios

Una clase **tiene cambios propios** si su día de la semana, sus horas, su estilo, su nivel, su profesor o su estado difieren de su horario. Se calcula, no se guarda: es la misma regla que las clases restantes de un pago. Una marca guardada se desincroniza, y además seguiría prendida si alguien mueve una clase y después la vuelve a poner a mano en su lugar.

En esta feature, los únicos cambios propios posibles son los que ya existen: el suplente y la cancelación. El campo `tieneCambios` de la respuesta solo se calcula para las clases de la semana actual en adelante; en una clase anterior vale `false`, porque la comparación es contra el horario de hoy.

## Cambiar un horario

`PATCH /api/horarios/:id` deja de cambiar solo la fila del horario. En una transacción:

1. Guarda los datos viejos del horario y lo actualiza.
2. Actualiza sus clases desde la semana actual que todavía son iguales al horario viejo: fecha (por el día nuevo), horas, estilo, nivel y profesor. Las que ya pasaron y las que tienen cambios propios no se tocan.
3. Si una clase actualizada tiene asistencias y cambia el profesor, se recalcula su `porcentaje_bp` como en una suplencia. Si cambia la fecha y un alumno anotado tiene un pack que vence antes de la fecha nueva, falla todo con 422 y el error dice qué fecha.

Dar de baja (`activo: false`) borra sus clases desde hoy que no tienen asistencias. Si alguna tiene un alumno anotado, falla con 422: hay que quitarlo antes, igual que para cancelar. Una clase futura sin asistencias no tiene historial, así que borrarla no rompe "nada con historial se borra".

Reactivar (`activo: true`) pone `vigente_desde` en el lunes de la semana actual y genera sus clases.

**Arquitectura:** el horario y sus clases se actualizan juntos, pero `clases.service` ya usa `horarios.service` (para abrir una clase y para generar). Para no crear un ciclo, lo que toca los dos vive en `modules/clases/programacion.service.ts`, como `alumnos/listado.service.ts`. Ahí van `generarClases`, `actualizarHorarioYSusClases` y `darDeBajaHorario`. Las rutas de horarios lo llaman a él.

## La agenda

- `GET /api/clases?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` devuelve las clases de ese rango, también las canceladas, ordenadas por fecha, hora de inicio e id. Cada una trae su horario (`horarioId`), el profesor titular del horario, el profesor que la da, el estado, `tieneCambios` y la cantidad de asistentes. La agenda la usa con `desde = hasta`; la grilla, con una semana o un mes.
- Desaparecen `GET /api/clases/dia` y `POST /api/clases` (abrir una clase): toda clase del horizonte ya existe. `POST /api/clases` vuelve en la feature 26 con otro significado, crear una clase única.
- En la web, la agenda lista las clases del día. "Sin abrir" desaparece. "Tomar asistencia" lleva directo a `/clases/:id`. Para una fecha fuera del horizonte, la agenda dice "La grilla de ese día todavía no está armada".

## Leer de la clase, no del horario

Las consultas que van de la clase al horario para mostrar el estilo o la hora pasan a leer las columnas de la clase: el detalle de la clase, la actividad del alumno, el detalle de la liquidación y su CSV. Así una clase de una semana pasada muestra lo que pasó aunque el horario cambie, y la feature 26 puede tener clases sin horario.

## Qué no se implementa

- **Cambios de una sola semana desde la web** (mover, agregar una clase única): son la feature 26.
- **Elegir desde qué semana vale un cambio de horario:** en esta feature siempre es desde la semana actual. La 26 agrega `desde`.
- **Generar semanas pasadas** para completar el historial anterior a la migración: esas semanas solo tienen las clases que recepción abrió.
- **El estado `dictada`:** sigue en el enum sin usarse.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| `lunesDe` y `finDelHorizonte` con fechas a mano, incluido un domingo, el último día de un mes y diciembre | Unitario | Contar la semana desde el domingo, o calcular mal el mes siguiente en diciembre |
| Un horario de los jueves genera las clases del 8/10 al 3/12, ni una más ni una menos | Service con base real | Calcular mal el horizonte o el día dentro de la semana |
| Correr el generador dos veces deja las mismas clases | Service con base real | Sacar el `on conflict do nothing` |
| Una clase movida a mano al viernes, con un `update` directo en la base, no hace que el generador cree otra el jueves | Service con base real | Que el `unique` sea por fecha y no por semana |
| Un horario con `vigente_desde` el 19/10 no tiene clases el 8/10 ni el 15/10 | Service con base real | Ignorar `vigente_desde` |
| No se crean clases en semanas pasadas, y un horario inactivo no genera ninguna | Service con base real | Arrancar el horizonte en otra fecha o no filtrar `activo` |
| Crear un horario por HTTP deja sus clases creadas sin esperar a la tarea | Integración HTTP | Que crear no llame al generador |
| Cambiar el estilo de un horario no cambia la clase de la semana pasada | Integración HTTP | Leer el estilo o la hora del horario en lugar de la clase |
| `GET /api/clases?desde=2026-10-08&hasta=2026-10-08` trae las clases del día ordenadas por hora, con las canceladas, el titular, el profesor, `tieneCambios` y los asistentes | Integración HTTP | Cambios en la consulta de la agenda |
| Una clase con suplente responde `tieneCambios: true` y una igual a su horario, `false` | Integración HTTP | Comparar contra un campo equivocado |
| Cambiar la hora de un horario cambia sus clases de esta semana en adelante, salvo la que tiene suplente y la de la semana pasada | Integración HTTP | Que el `update` no compare contra el horario viejo, o que no respete la semana actual |
| Cambiar el día de un horario con un anotado cuyo pack vence antes da 422 y no cambia nada | Integración HTTP | Que falte la validación o la transacción |
| Dar de baja un horario borra sus clases futuras sin asistencias y conserva la de la semana pasada | Integración HTTP | Borrar clases con historial |
| Dar de baja un horario con un alumno anotado en una clase futura da 422 | Integración HTTP | Borrar asistencias sin avisar |
| La agenda de la web lista las clases del día y "Tomar asistencia" es un enlace a `/clases/:id`, sin `POST` | Web | Que la agenda siga abriendo la clase |
| Una fecha fuera del horizonte muestra "La grilla de ese día todavía no está armada" | Web | Que una fecha lejana se vea como un día sin clases |

La migración de datos se prueba a mano contra la base de desarrollo, que tiene 3 horarios.

## Tareas

### Tarea 1: Fechas del horizonte

**Archivos:** `apps/api/src/lib/fechas.ts`, `apps/api/src/lib/fechas.test.ts`

- [x] **Paso 1:** escribir los tests de `lunesDe` y `finDelHorizonte`.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test fechas` y verificar que fallan porque las funciones no existen.
- [x] **Paso 3:** implementarlas. Se sumó `semanasDelHorizonte`, la lista de lunes que recorre el generador, con su test.
- [x] **Paso 4:** correr el test y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(fechas): semana y horizonte de la grilla`.

### Tarea 2: Esquema y migración

**Archivos:** `apps/api/src/db/schema.ts`, la migración `0004` con sus `update` a mano, `apps/api/test/fabricas.ts` (las clases de test llevan `semana`, horas y estilo)

- [x] **Paso 1:** escribir dos tests que leen la base: abrir una clase guarda su semana y copia la hora, el estilo y el nivel del horario; crear un horario guarda `vigente_desde` en el lunes de la semana. Las fábricas no crean clases (las abre `abrirClase`), así que no hizo falta cambiarlas para eso; `crearHorarioDeTest` recibe opcionalmente el día de hoy.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test` y verificar que falla porque las columnas no existen.
- [x] **Paso 3:** cambiar `schema.ts`, generar la migración y agregarle los `update`. `abrirClase` copia la hora, el estilo y el nivel del horario mientras siga existiendo. `crearHorario` recibe el día de hoy (la ruta pasa `app.hoy()`). `Clase.horarioId` pasa a `number | null` en shared.
- [x] **Paso 4:** correr `pnpm --filter @studio/api test`, `pnpm typecheck` y `db:generate` (sin cambios), y verificar que pasan. Probar la migración contra una copia de la base de desarrollo: las 2 clases copiaron hora, estilo y nivel, y la del sábado 3 de octubre quedó en la semana del 28 de septiembre.
- [x] **Paso 5:** commit `feat(clases): la clase guarda su semana, su hora y su estilo`.

### Tarea 3: El generador

**Archivos:** `apps/api/src/modules/clases/programacion.service.ts`, su test, `apps/api/src/tareas.ts`, `horarios.routes.ts` (crear y reactivar)

- [ ] **Paso 1:** escribir los tests del generador de la tabla y el de crear un horario por HTTP.
- [ ] **Paso 2:** correr los tests y verificar que fallan porque el generador no existe.
- [ ] **Paso 3:** implementar `generarClases`, llamarlo en `programarTareas` y al crear o reactivar un horario.
- [ ] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(clases): crear las clases del horizonte por adelantado`.

### Tarea 4: Las clases de un rango y la agenda

**Archivos:** `packages/shared/src/clases.ts`, `clases.routes.ts`, `clases.repository.ts`, `clases.service.ts`, la agenda de la web y su test

- [ ] **Paso 1:** escribir los tests de `GET /api/clases?desde=&hasta=` (con `tieneCambios`) y los de la agenda en la web.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** implementar la consulta, sacar `GET /api/clases/dia` y `POST /api/clases`, y cambiar la agenda de la web.
- [ ] **Paso 4:** correr `pnpm test`, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan. El e2e ya no abre la clase: la toma de asistencia empieza en el enlace.
- [ ] **Paso 5:** commit `feat(agenda): la agenda lista las clases ya creadas`.

### Tarea 5: Cambiar y dar de baja un horario

**Archivos:** `programacion.service.ts`, `horarios.routes.ts`, sus tests

- [ ] **Paso 1:** escribir los tests de cambiar la hora, cambiar el día con un anotado, dar de baja con y sin asistencias.
- [ ] **Paso 2:** correr los tests y verificar que fallan porque el horario se cambia solo.
- [ ] **Paso 3:** implementar `actualizarHorarioYSusClases` y `darDeBajaHorario` y apuntar las rutas.
- [ ] **Paso 4:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(horarios): cambiar un horario cambia sus clases desde esta semana`.

### Tarea 6: Leer de la clase

**Archivos:** los repositories de clases, asistencias (actividad del alumno) y liquidaciones, y sus tests

- [ ] **Paso 1:** escribir el test de que cambiar el estilo de un horario no cambia la clase de la semana pasada en el detalle, la actividad y la liquidación.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** cambiar las consultas para que lean de la clase.
- [ ] **Paso 4:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `fix(clases): una clase pasada muestra su hora y su estilo de entonces`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [ ] `pnpm e2e` pasa.
- [ ] Contra la base de desarrollo: `db:migrate` completa las clases existentes, y al arrancar la API se crean las clases del horizonte de los 3 horarios.
- [ ] `docs/estructura de base de datos.md` describe las columnas nuevas y cierra la pregunta abierta 3.
