# Pagos

**Estado:** en curso  
**Depende de:** alumnos, packs  
**Listo cuando:** `pnpm test` pasa; recepción registra y anula pagos, admin extiende vencimientos, y cada pago muestra sus clases restantes.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** registrar la compra de un pack por un alumno, con los datos congelados al momento de la compra.

**Arquitectura:** módulo `pagos` con `routes` → `service` → `repository`. Usa `alumnos.service` y `packs.service` para validar. Esquemas en `packages/shared/src/pagos.ts`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tabla `pago`, decisiones 2, 4, 5, 6 y 7.

## Decisiones

- **El pago copia `monto` y `cantidadClases` del pack** al momento de la compra. Un cambio de precio posterior no lo altera.
- **El monto es siempre el precio del pack.** Descuentos y becas quedan fuera de v1.
- **Vence 1 mes después de la compra** (`sumarUnMes` sobre el día del estudio). El día del vencimiento todavía vale; al día siguiente está vencido.
- **Solo admin extiende un vencimiento.** La fecha nueva tiene que ser posterior a la compra.
- **Clases restantes = `cantidadClases` − asistencias del pago.** Se calcula, no se guarda.
- **Anular en lugar de borrar.** Pide un motivo. Un pago anulado no se puede volver a anular. La regla "no se anula un pago con asistencias" se agrega y prueba en la feature de asistencias.
- **Cambio de pack:** no hay una operación especial. Se anula el pago y se registra otro.
- **Alumno y pack tienen que estar activos** para registrar un pago. Si no, 422.

## API

| Método y ruta | Rol | Cuerpo o query | Respuesta |
|---|---|---|---|
| `GET /api/pagos` | recepcion | `?alumnoId=` (obligatorio) | `200 { items: Pago[] }`, el más nuevo primero |
| `POST /api/pagos` | recepcion | `{ alumnoId, packId, medio }` | `201` pago; `422` |
| `POST /api/pagos/:id/anular` | recepcion | `{ motivo }` | `200` pago; `404`; `422` |
| `PATCH /api/pagos/:id/vencimiento` | admin | `{ venceEl }` | `200` pago; `404`; `422` |

Forma del pago: `{ id, alumnoId, pack: { id, nombre }, cantidadClases, clasesUsadas, clasesRestantes, monto, medio, fecha, venceEl, vencido, anulado, motivoAnulacion, registradoPor: { id, nombre } }`. `fecha` es un instante ISO; `venceEl`, un día `AAAA-MM-DD`.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Registrar un pago copia precio y clases del pack, vence en un mes y guarda quién lo cobró | Integración | Si `venceEl` se calcula con 30 días o sobre la fecha UTC, o si no se guarda `registradoPor` |
| Cambiar el precio del pack no cambia pagos ya hechos | Integración | Si el listado toma el precio con un join al pack (como hacía la app original), un aumento reescribe la historia |
| No se puede pagar un pack dado de baja ni para un alumno dado de baja (tabla) | Integración | Si el service no mira `activo`, recepción vende packs que ya no existen |
| Un pago está vigente el día del vencimiento y vencido al día siguiente (tabla) | Integración | Si la comparación usa `<=` en lugar de `<`, el alumno pierde un día de su pack |
| Anular un pago lo marca anulado con su motivo, y anularlo de nuevo responde 422 | Integración | Si anular pisa `anuladoEn` cada vez, se pierde cuándo se anuló de verdad |
| Recepción no puede extender un vencimiento, y admin no puede ponerlo antes de la compra | Integración | Si la ruta queda con rol `recepcion` o sin validar la fecha, se regalan meses o se crean pagos vencidos desde el origen |

**No se testea:** `clasesUsadas`/`clasesRestantes` con asistencias (no existen todavía; lo prueba la feature de asistencias).

---

### Tarea 1: Módulo de pagos

**Archivos:**
- Crear: `packages/shared/src/pagos.ts` — `registrarPagoSchema`, `anularPagoSchema`, `extenderVencimientoSchema`, `pagosQuerySchema`, `type Pago`.
- Crear: `apps/api/src/modules/pagos/pagos.repository.ts`, `pagos.service.ts`, `pagos.routes.ts`
- Modificar: `apps/api/test/fabricas.ts` — `crearAlumnoDeTest`, `crearPackDeTest`.
- Test: `apps/api/src/modules/pagos/pagos.test.ts`

**Interfaces:**
- Produce: `registrarPago(datos, usuarioId, ahora: Date, hoy: FechaDia)`, `anularPago(id, motivo, ahora, hoy)`, `extenderVencimiento(id, venceEl, hoy)`, `listarPagosDeAlumno(alumnoId, hoy)`. La feature de asistencias agrega `elegirPagoParaAsistencia(tx, alumnoId, fecha)`.

- [ ] **Paso 1:** escribir los 6 tests de la tabla.
- [ ] **Paso 2:** correrlos y verificar que fallan con 404.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(pagos): registrar, anular y extender pagos`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
