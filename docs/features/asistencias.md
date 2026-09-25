# Asistencias

**Estado:** lista  
**Depende de:** clases-y-sesiones, pagos  
**Listo cuando:** `pnpm test` pasa; recepción registra asistencias que consumen clases del pack correcto, cobra una clase suelta en el acto si hace falta, y dos registros simultáneos no pueden usar la misma última clase.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** registrar que un alumno tomó una clase, consumiendo una clase de un pago y dejando fijo cuánto vale esa clase y qué porcentaje le toca al profesor.

**Arquitectura:** módulo `asistencias`. Usa `sesiones.service.bloquearSesion`, `pagos.service.elegirPagoParaAsistencia` y `profesores.service.porcentajeVigente`, todo dentro de una transacción. Las reglas que dependen de asistencias y viven en otros módulos (cancelar sesión, suplencia, anular pago) se agregan en sus propios services.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), sección "Reglas de negocio" y "Redondeo"; [Arquitectura del backend](../arquitectura%20backend.md), sección "Transacciones".

## Reglas

**Registrar una asistencia** (todo en una transacción):

1. Se bloquea la sesión (`for update`). Si está `cancelada`, 422.
2. El alumno tiene que estar activo.
3. Se eligen los pagos válidos del alumno para la fecha de la sesión: no anulados, `venceEl >= fecha`. Se bloquean (`for update`) y **después** se cuentan sus asistencias, para ver la cuenta ya actualizada si otro registro terminó mientras se esperaba el bloqueo.
4. Se usa el que vence primero entre los que tienen clases restantes.
5. Si no hay ninguno y el pedido trae `cobrar: { packId, medio }`, se registra ese pago en la misma transacción y se usa. Si no trae `cobrar`, 422.
6. `valorClase = round(monto / cantidadClases)`; `porcentajeBp` = porcentaje vigente del profesor de la sesión en la fecha de la sesión.
7. El mismo alumno no puede estar dos veces en la misma sesión (422).

**Otras reglas:**

- **Borrar una asistencia** devuelve la clase al pack, porque las restantes se calculan contando.
- **No se cancela una sesión con asistencias.** Primero hay que borrarlas.
- **Suplencia después de tomar asistencia:** al cambiar el profesor de una sesión se recalcula `porcentajeBp` de sus asistencias con el porcentaje del profesor nuevo en esa fecha. El sueldo sigue a quien dio la clase.
- **No se anula un pago con asistencias.** Primero hay que borrarlas o moverlas.

## API

| Método y ruta | Rol | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /api/sesiones/:id/asistencias` | recepcion | — | `200 { items: Asistencia[] }` |
| `POST /api/sesiones/:id/asistencias` | recepcion | `{ alumnoId, cobrar?: { packId, medio } }` | `201` asistencia; `422` |
| `DELETE /api/asistencias/:id` | recepcion | — | `204`; `404` |

Forma de la asistencia: `{ id, sesionId, alumno: { id, nombre, apellido }, pagoId, pack: string, valorClase, porcentajeBp }`.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Registrar con un pack vigente fija valor y porcentaje, y descuenta una clase del pago | Integración | Si `valorClase` se toma del precio actual del pack o sin dividir, o si el porcentaje no se copia, la liquidación sale mal |
| Con dos pagos válidos usa el que vence primero | Integración | Si el orden se invierte o falta, el alumno pierde las clases del pack que vence antes |
| No usa pagos vencidos, anulados ni sin clases restantes | Integración | Si se pierde cualquiera de los tres filtros, se consumen clases que no corresponden |
| Sin pago válido y con `cobrar`, registra una clase suelta en el acto y la usa | Integración | Si el cobro queda fuera de la transacción o no se usa el pago nuevo, recepción cobra y la asistencia falla |
| El mismo alumno dos veces en la misma sesión responde 422 | Integración | Si no se traduce `asistencia_sesion_alumno_uq`, un doble clic da un 500 |
| No se registran asistencias en una sesión cancelada | Integración | Si se saltea el chequeo de estado, se pagan clases que no se dieron |
| Seis registros simultáneos con una sola clase disponible: uno pasa y cinco reciben 422 | Integración | Es la regla vista desde afuera. Detecta la carrera sin `for update` solo a veces (1 de cada 3 corridas en la prueba), por eso existe el test siguiente |
| Una segunda transacción no puede elegir el pago que tiene bloqueado la primera | Service con base | Determinístico: con `lock_timeout = 50ms` la segunda falla esperando el bloqueo. Si se quita el `for update`, no hay nada que esperar y el test falla siempre |
| Borrar una asistencia devuelve la clase al pack | Integración | Si alguien vuelve a agregar un contador de clases restantes, se desincroniza (el bug de la app original) |
| No se cancela una sesión con asistencias | Integración | Si se quita la regla, la sesión cancelada sigue sumando al sueldo |
| Una suplencia recalcula el porcentaje de las asistencias ya tomadas | Integración | Si solo se cambia el profesor, el suplente cobra con el porcentaje del titular |
| No se anula un pago con asistencias | Integración | Si se quita la regla, quedan asistencias colgando de un pago anulado |

---

### Tarea 1: Registrar y borrar asistencias

**Archivos:**
- Crear: `packages/shared/src/asistencias.ts` — `registrarAsistenciaSchema`, `type Asistencia`.
- Modificar: `apps/api/src/modules/pagos/pagos.service.ts` y `pagos.repository.ts` — `elegirPagoParaAsistencia(tx, alumnoId, fecha)` y registrar un pago dentro de una transacción ajena.
- Crear: `apps/api/src/modules/asistencias/asistencias.repository.ts`, `asistencias.service.ts`, `asistencias.routes.ts`
- Test: `apps/api/src/modules/asistencias/asistencias.test.ts`

- [x] **Paso 1:** escribir los 9 primeros tests de la tabla (el de bloqueo va en `pagos.service.test.ts`).
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan. Para el de concurrencia, verificar también que falla si se quita el `for update`.
- [x] **Paso 5:** commit `feat(asistencias): registrar asistencias consumiendo clases del pack`.

### Tarea 2: Reglas en sesiones y pagos

**Archivos:**
- Modificar: `apps/api/src/modules/clases/sesiones.service.ts` y `sesiones.repository.ts`
- Modificar: `apps/api/src/modules/pagos/pagos.service.ts`
- Test: los 3 últimos tests de la tabla, en `asistencias.test.ts`

- [x] **Paso 1:** escribir los 3 tests.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar las tres reglas.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistencias): reglas de cancelación, suplencia y anulación`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan.
