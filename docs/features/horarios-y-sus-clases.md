# El horario y sus clases en un módulo

**Estado:** en curso  
**Depende de:** clases-por-adelantado, grilla-semanal, alta-de-profesor-desde-el-asistente  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; `apps/api/src/modules/clases/programacion.service.ts` no existe; la lista de lo que una clase copia de su horario está escrita una sola vez en la API; `clases.service.ts` no importa nada de `modules/horarios`.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md), [el índice de features](index.md), [docs/entorno/tests-api.md](../entorno/tests-api.md) y [docs/entorno/base-de-datos.md](../entorno/base-de-datos.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Para qué

Es un refactor: la API responde lo mismo antes y después. Sale de la revisión de arquitectura del 2026-11-13.

Día, hora de inicio, hora de fin, estilo, nivel y profesor son lo que una clase copia de su horario. Hoy esa lista está escrita a mano en siete lugares de la API. "Cambios propios" tiene dos definiciones que nada obliga a coincidir: `tieneCambios` (el punto ámbar de la grilla) e `igualesAlHorario` (qué clases siguen al horario cuando cambia). Agregar un campo a la clase, una sala por ejemplo, obliga a tocar los siete.

Editar un horario se lee hoy en cinco archivos de dos carpetas. `programacion.service.ts` vive en la carpeta de clases para esquivar un ciclo, y ese ciclo existe solo porque `clases.service` importa a horarios para `abrirClase`, una función que usan solo los tests.

## Qué se decidió

Decisiones tomadas con el estudio el 2026-11-13. No se vuelven a discutir en la ejecución.

1. **Horarios usa clases, y no al revés.** `clases.service.ts` deja de importar `horarios.service.ts`. `programacion.service.ts` se borra.
2. **Horarios es el módulo que ven las rutas, `tareas.ts` y el alta de profesor.** Expone solo operaciones completas: `crearHorario`, `crearHorarioEn`, `actualizarHorario`, `generarClases`, `listarHorarios` y `obtenerHorario`. No queda ninguna función exportada que cambie la fila del horario sin sus clases.
3. **Horarios decide qué horarios, qué semanas y desde cuándo.** Lee sus filas, calcula las semanas del horizonte, aplica `vigenteDesde` y resuelve `inicio` (el `desde` del pedido o hoy). `horariosParaGenerar` deja de exportarse.
4. **Clases decide qué le pasa a cada clase.** Crea las que faltan, saltea la clase que caería en un día pasado, rechaza si hay anotados con un pack que vence antes, copia los campos y recalcula el porcentaje cuando cambia el profesor. Ese código va en una sección de `clases.service.ts`, no en un archivo nuevo.
5. **"Cambios propios" tiene una sola definición**, en `clases.repository.ts`. Seguir al horario busca las clases sin cambios propios antes de actualizar la fila del horario, comparando contra la tabla `horario` con el mismo fragmento SQL que `tieneCambios`. Desaparecen `igualesAlHorario`, el tipo `DatosDeHorario` y `datosDe`.
6. **`abrirClase` pasa a `apps/api/test/fabricas.ts`** como `crearClaseDeTest`, apoyada en la misma operación de clases que usa el generador. `crearHorarioDeTest` sigue creando el horario sin clases e inserta la fila directo.
7. **Solo la API.** Las copias de la web (`comoHorario` en `GrillaPage.tsx`, `grillaDeLaPropuesta.ts`) y la regla del porcentaje en una suplencia quedan como están.

## Cómo queda

### `clases.repository.ts`

- Una constante con las columnas que una clase copia de su horario: `horaInicio`, `horaFin`, `estilo`, `nivel`, `profesorId`. El día va aparte, porque la clase guarda una fecha y el horario un día de la semana. Esa lista aparece una sola vez en la API.
- Un fragmento SQL "la clase difiere de su horario", armado a partir de esa lista más el día y el estado. Lo usan `tieneCambios` y la consulta de las clases que siguen al horario.
- `sinCambiosPropiosDesde(ej, horarioId, desde)`: las clases de un horario desde una fecha que no difieren de él. Reemplaza a `igualesAlHorario`.
- `copiarDelHorario(ej, id, fecha)`: pone en la clase la fecha y las columnas de la lista, leídas de la fila de su horario.
- Se borran `buscarIdPorHorarioYFecha` e `insertarSiNoExiste`.

### `clases.service.ts`, sección "Las clases de un horario"

La usa solo `horarios.service.ts`. Todas reciben el ejecutor.

- `crearClasesQueFaltan(ej, horarios, semanas)`: arma una clase por horario y semana copiando la lista, y nunca pisa una que ya existe. Devuelve cuántas creó.
- `seguirAlHorario(ej, horarioId, inicio, hoy, cambiarElHorario)`: busca las clases sin cambios propios desde `inicio`, llama a `cambiarElHorario` (que actualiza la fila y devuelve el día y el profesor nuevos) y después pone al día cada clase con las reglas de hoy. El orden queda adentro: quien llama no puede equivocarlo.
- `quitarClasesDesde(ej, horario, desde)`: rechaza si alguna tiene anotados y borra las demás.
- `adoptarClaseUnica(ej, claseId, horarioId, semana)`: la clase única pasa a ser la primera de la serie, con las tres verificaciones de hoy.

### `horarios.service.ts`

- `crearHorario(datos, hoy)` abre la transacción y `crearHorarioEn(ej, datos, hoy)` la recibe. Crean la fila, adoptan la clase única si viene `claseId` y generan las clases.
- `actualizarHorario(id, datos, hoy)` es lo que hoy hace `actualizarHorarioYSusClases`. Cambia de firma: suma `hoy`.
- `generarClases(ej, hoy, horarioId?)`.
- `listarHorarios` y `obtenerHorario` no cambian.

Los mensajes de error y los códigos HTTP no cambian.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Con una clase por cada cambio propio (otro día, otra hora de inicio, otra hora de fin, otro estilo, otro nivel, un suplente, cancelada) y una sin cambios, cambiar el horario hace que lo sigan exactamente las que `GET /api/clases` mostraba con `tieneCambios: false` | Integración HTTP, en el archivo de la propagación | Agregar un campo a la clase en la comparación y olvidarlo en la copia, o al revés; volver a escribir dos definiciones de cambios propios |

Este test nace en verde, porque hoy las dos definiciones coinciden. Fija el comportamiento antes de tocar el código. Para comprobar que detecta el error, al terminar la tarea 1 se quita a mano una columna de la lista, se verifica que el test falla y se repone.

El resto de la feature se verifica con los tests que ya existen. Cambian por la mudanza:

- `clases/test/programacion.service.test.ts` pasa a `horarios/test/propagacion.test.ts` con `git mv`, sin reescribirlo.
- `describe('abrirClase')` de `clases.test.ts` se borra: la función deja de ser código de producción.
- Los 9 usos de `actualizarHorario` en tests (solo la fila) pasan a la operación completa, con `hoy`. Si un test dependía de que la baja no borrara las clases futuras, se corrige el test y se anota en la bitácora.

---

### Tarea 1: Una sola definición de cambios propios

**Archivos:**
- Modificar: `apps/api/src/modules/clases/clases.repository.ts`, `apps/api/src/modules/clases/programacion.service.ts`
- Test: `apps/api/src/modules/clases/test/programacion.service.test.ts`

- [x] **Paso 1:** escribir el test de la tabla de arriba, por HTTP, con los valores escritos a mano.
- [x] **Paso 2:** correrlo y verificar que pasa con el código actual.
- [x] **Paso 3:** en `clases.repository.ts`, escribir la lista de columnas copiadas y el fragmento "difiere de su horario"; `tieneCambios` pasa a usarlo.
- [x] **Paso 4:** agregar `sinCambiosPropiosDesde` y cambiar `copiarDelHorario` para que lea de la fila del horario. En `programacion.service.ts`, `seguirAlHorario` busca las clases antes de actualizar la fila. Borrar `igualesAlHorario`, `DatosDeHorario` y `datosDe`.
- [x] **Paso 5:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 6:** quitar a mano una columna de la lista, verificar que el test nuevo falla y reponerla.
- [x] **Paso 7:** commit `refactor(clases): una sola definición de cambios propios`.

### Tarea 2: `abrirClase` pasa a las fábricas de test

**Archivos:**
- Modificar: `apps/api/src/modules/clases/clases.service.ts`, `apps/api/src/modules/clases/clases.repository.ts`, `apps/api/src/modules/clases/programacion.service.ts`, `apps/api/test/fabricas.ts`, `docs/entorno/tests-api.md`
- Test: los seis archivos que importan `abrirClase` (`alumnos.test.ts`, `asistencias.test.ts`, `liquidaciones.test.ts`, `clases.test.ts`, `programacion.service.test.ts`)

- [x] **Paso 1:** agregar `crearClasesQueFaltan` en `clases.service.ts`, que arma las filas copiando la lista de la tarea 1; `generarClases` pasa a usarla.
- [x] **Paso 2:** agregar `crearClaseDeTest(horarioId, fecha)` en `fabricas.ts`, que llama a `crearClasesQueFaltan` con la semana de esa fecha y devuelve `{ id, fecha }`. Si la clase de esa semana ya existe, devuelve esa.
- [x] **Paso 3:** `crearHorarioDeTest` inserta la fila directo, sin `crearHorario`.
- [x] **Paso 4:** cambiar los usos de `abrirClase` por `crearClaseDeTest`. Borrar `abrirClase`, `ClaseAbierta`, `describe('abrirClase')`, `buscarIdPorHorarioYFecha` e `insertarSiNoExiste`. `clases.service.ts` deja de importar `horarios.service.ts`.
- [x] **Paso 5:** actualizar la nota de "Datos de prueba" en `docs/entorno/tests-api.md`.
- [x] **Paso 6:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 7:** commit `refactor(tests): abrirClase pasa a las fábricas de test`.

### Tarea 3: El horario y la propagación en el módulo de horarios

**Archivos:**
- Modificar: `apps/api/src/modules/horarios/horarios.service.ts`, `apps/api/src/modules/horarios/horarios.repository.ts`, `apps/api/src/modules/horarios/horarios.routes.ts`, `apps/api/src/modules/clases/clases.service.ts`, `apps/api/src/tareas.ts`, `apps/api/src/modules/asistente/alta-de-profesor.service.ts`, `docs/entorno/tests-api.md`
- Borrar: `apps/api/src/modules/clases/programacion.service.ts`
- Mover: `apps/api/src/modules/clases/test/programacion.service.test.ts` a `apps/api/src/modules/horarios/test/propagacion.test.ts`
- Test: los archivos que importan `programacion.service.ts` o `actualizarHorario`

- [ ] **Paso 1:** pasar a `clases.service.ts` `seguirAlHorario`, `quitarClasesDesde` y `adoptarClaseUnica`, como dice "Cómo queda".
- [ ] **Paso 2:** dejar en `horarios.service.ts` las operaciones completas con los nombres cortos. Las que tocan solo la fila quedan privadas. `horariosParaGenerar` deja de exportarse.
- [ ] **Paso 3:** borrar `programacion.service.ts` y actualizar los imports de `horarios.routes.ts`, `tareas.ts`, `alta-de-profesor.service.ts` y los tests.
- [ ] **Paso 4:** mover el test de la propagación con `git mv` y arreglar sus imports. Pasar los 9 usos de `actualizarHorario` de los tests a la operación completa.
- [ ] **Paso 5:** actualizar `docs/entorno/tests-api.md` (dónde vive `generarClases`).
- [ ] **Paso 6:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 7:** commit `refactor(horarios): el horario y la propagación a sus clases en un módulo`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [ ] `apps/api/src/modules/clases/programacion.service.ts` no existe y nadie lo importa.
- [ ] `clases.service.ts` no importa nada de `modules/horarios`.
- [ ] Buscar `horaInicio` en `apps/api/src/modules/clases` y `apps/api/src/modules/horarios`, sin los tests: la lista de lo que la clase copia aparece una sola vez. Las demás apariciones son columnas de un listado o campos de una edición.
- [ ] `pnpm e2e` pasa.
