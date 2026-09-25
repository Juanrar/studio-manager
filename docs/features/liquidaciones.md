# Liquidaciones y reportes

**Estado:** en curso  
**Depende de:** asistencias  
**Listo cuando:** `pnpm test` pasa; admin ve el sueldo calculado de cada profesor en un mes, lo cierra, lo marca pagado y ve los ingresos del mes por medio de pago.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** calcular cuánto cobra cada profesor por mes, congelar ese monto al pagarlo, y dar a admin los números del mes.

**Arquitectura:** módulo `liquidaciones`. Su repository lee `asistencia` y `sesion` para sumar (es un módulo de reportes, de solo lectura sobre esas tablas). La suma se hace en el código con `aplicarPorcentaje`, así el redondeo vive en un solo lugar. Los ingresos se calculan en `pagos.service`. `asistencias` y `sesiones` usan `liquidaciones.service.verificarMesAbierto`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tabla `liquidacion`, sección "Redondeo" y la consulta "Sueldo de un profesor en un mes".

## Decisiones

- **Período como `AAAA-MM`** en la API. En la base se guarda el día 1 del mes.
- **Monto de un profesor en un mes** = suma, por cada asistencia de sus sesiones de ese mes, de `aplicarPorcentaje(valorClase, porcentajeBp)`. Cuenta el profesor de la sesión (el suplente, si hubo).
- **El resumen muestra a todos los profesores activos**, aunque no tengan asistencias, y a los inactivos que sí tengan.
- **Cerrar una liquidación** guarda el monto calculado en ese momento. Solo se puede cerrar un mes que ya terminó. Cerrar dos veces responde 422.
- **Mes cerrado, mes congelado:** con la liquidación de un profesor cerrada, no se pueden registrar ni borrar asistencias de sus sesiones de ese mes, ni cambiar el profesor de esas sesiones. Si no, el monto guardado dejaría de coincidir con las asistencias.
- **Ingresos del mes:** pagos no anulados cuya fecha, en la zona del estudio, cae en el mes. Un pago a las 23:00 del 31 es del mes que termina, aunque en UTC ya sea el día 1.
- **Todo esto es solo para admin.**

## API

| Método y ruta | Rol | Cuerpo o query | Respuesta |
|---|---|---|---|
| `GET /api/liquidaciones` | admin | `?periodo=AAAA-MM` | `200 { periodo, items: ResumenProfesor[] }` |
| `GET /api/liquidaciones/detalle` | admin | `?profesorId=&periodo=` | `200 { items: DetalleSesion[] }` |
| `POST /api/liquidaciones` | admin | `{ profesorId, periodo }` | `201` liquidación; `422` |
| `POST /api/liquidaciones/:id/pagar` | admin | — | `200` liquidación |
| `GET /api/pagos/ingresos` | admin | `?periodo=AAAA-MM` | `200 { periodo, total, porMedio: { medio, cantidad, total }[] }` |

Formas:

- `ResumenProfesor`: `{ profesor: { id, nombre, apellido }, asistencias, montoCalculado, liquidacion: Liquidacion | null }`
- `Liquidacion`: `{ id, profesorId, periodo, monto, pagadoEn }`
- `DetalleSesion`: `{ sesionId, fecha, estilo, asistentes, monto }`, ordenado por fecha

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| El resumen suma por profesor solo las asistencias del mes, con el porcentaje de cada una, e incluye a los profesores sin asistencias | Integración | Si el filtro de fechas incluye el mes anterior, si se usa el porcentaje actual en lugar del guardado, o si se filtra a los profesores sin asistencias |
| El detalle agrupa por sesión con su monto | Integración | Si se agrupa por clase en vez de por sesión, dos martes del mismo horario se mezclan |
| Cerrar guarda el monto calculado y cerrar de nuevo responde 422 | Integración | Si no se traduce `liquidacion_profesor_periodo_uq`, o si se guarda otro monto que el del resumen |
| No se cierra un mes que no terminó | Integración | Si se quita la validación, se liquida un mes con asistencias que todavía faltan cargar |
| Con el mes cerrado no se registran asistencias de ese profesor | Integración | Si `registrarAsistencia` no consulta el cierre, el monto pagado deja de coincidir |
| Con el mes cerrado no se borran asistencias de ese profesor | Integración | Mismo motivo, en el camino de borrado |
| Con el mes cerrado no se cambia el profesor de una sesión | Integración | Una suplencia cargada tarde movería plata entre dos liquidaciones ya cerradas |
| Ingresos del mes por medio: excluye anulados y usa el día del estudio | Integración | Si se filtra por fecha UTC, un pago del 31 a la noche cae en el mes siguiente; si no se excluyen anulados, se cuentan cobros que no existieron |
| Recepción no accede a liquidaciones ni ingresos | Integración | Si las rutas quedan con rol `recepcion`, recepción ve sueldos |

**No se testea:** marcar una liquidación como pagada (es un cambio de campo sin reglas).

---

### Tarea 1: Resumen, detalle y cierre

**Archivos:**
- Crear: `packages/shared/src/liquidaciones.ts` — `periodoSchema`, `cerrarLiquidacionSchema`, tipos.
- Crear: `apps/api/src/modules/liquidaciones/liquidaciones.repository.ts`, `liquidaciones.service.ts`, `liquidaciones.routes.ts`
- Modificar: `apps/api/src/lib/fechas.ts` — `periodoAFecha`, `rangoDelPeriodo`.
- Test: `apps/api/src/modules/liquidaciones/liquidaciones.test.ts`

- [x] **Paso 1:** escribir los 4 primeros tests de la tabla y el de permisos.
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan. El de permisos queda rojo solo en la parte de ingresos, que llega en la tarea 3.
- [x] **Paso 5:** commit `feat(liquidaciones): resumen, detalle y cierre de sueldos`.

### Tarea 2: Mes congelado

**Archivos:**
- Modificar: `apps/api/src/modules/asistencias/asistencias.service.ts`, `apps/api/src/modules/clases/sesiones.service.ts`
- Test: los 3 tests de "mes cerrado" en `liquidaciones.test.ts`

- [ ] **Paso 1:** escribir los 3 tests.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** llamar a `verificarMesAbierto` en registrar, borrar y suplencia.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(liquidaciones): congelar las asistencias de un mes liquidado`.

### Tarea 3: Ingresos del mes

**Archivos:**
- Modificar: `apps/api/src/modules/pagos/pagos.repository.ts`, `pagos.service.ts`, `pagos.routes.ts`
- Test: el test de ingresos en `liquidaciones.test.ts`

- [ ] **Paso 1:** escribir el test.
- [ ] **Paso 2:** correrlo y verificar que falla.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr el test y verificar que pasa.
- [ ] **Paso 5:** commit `feat(pagos): ingresos del mes por medio de pago`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
