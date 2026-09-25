# Pantalla de liquidaciones e ingresos

**Estado:** lista  
**Depende de:** frontend-administracion, liquidaciones  
**Listo cuando:** `pnpm test` pasa; admin elige un mes, ve los ingresos por medio de pago y el sueldo de cada profesor, cierra y marca pagadas las liquidaciones, y descarga el detalle de un profesor.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Spec:** [Arquitectura del frontend](../arquitectura%20frontend.md); API en [liquidaciones](liquidaciones.md).

## Pantalla

**`/liquidaciones?periodo=AAAA-MM`** (por defecto, el mes anterior: es el que se liquida)
- Selector de mes.
- Ingresos del mes: total y una fila por medio de pago.
- Sueldos: una fila por profesor con asistencias, monto calculado y estado (Abierta, Cerrada, Pagada). Acciones: "Detalle", "Cerrar" si está abierta, "Marcar pagada" si está cerrada y sin pagar.
- El detalle muestra las sesiones del mes con asistentes y monto, y permite descargarlo como CSV.

## Decisiones

- **El monto de una liquidación cerrada es el guardado**, no el calculado: si difieren, se muestran los dos.
- **CSV separado por `;`**: Excel configurado en español usa `,` como separador decimal y abriría todo en una columna. El archivo lleva BOM para que Excel lea bien las tildes.
- **El CSV reemplaza al reporte en Excel de la app original**: un archivo por profesor y mes.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| El mes muestra ingresos por medio y el sueldo de cada profesor con su estado | Web | Si se muestra el monto calculado en una liquidación cerrada, admin paga otro número que el guardado |
| "Cerrar" manda profesor y período | Web | Si se manda el mes actual en lugar del elegido, se liquida el mes equivocado |
| "Marcar pagada" llama a la API de esa liquidación | Web | Si se usa el id del profesor en lugar del de la liquidación, se marca otra |
| El CSV del detalle usa `;`, fechas DD/MM/AAAA y cierra con el total | Unitario | Si se usa `,`, Excel en español lo abre en una sola columna |

---

### Tarea 1: Pantalla de liquidaciones

**Archivos:**
- Crear: `apps/web/src/features/liquidaciones/api.ts`, `LiquidacionesPage.tsx`, `csv.ts`
- Test: `apps/web/src/features/liquidaciones/liquidaciones.test.tsx`, `csv.test.ts`

- [x] **Paso 1:** escribir los 4 tests.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): liquidaciones e ingresos del mes`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan.
