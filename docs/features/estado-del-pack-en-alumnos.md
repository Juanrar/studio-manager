# Estado del pack en el listado de alumnos

**Estado:** lista  
**Depende de:** pagos, asistencias, rediseno-de-la-interfaz  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; el listado de alumnos muestra, por cada alumno, el estado de su pack, el pack que está usando, las clases que le quedan, el vencimiento y su última clase, y el total de alumnos con el pack vigente.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Referencia:** la pantalla de alumnos de la maqueta estilo Twenty (variante A).

## Qué devuelve la API

`GET /api/alumnos` suma a cada alumno:

- `estadoPack`: `vigente`, `por_vencer`, `sin_clases`, `vencido` o `sin_pack`.
- `pagoActual`: `{ pack, cantidadClases, clasesRestantes, venceEl }`, o `null` si nunca pagó.
- `ultimaClase`: el día de su última asistencia hasta hoy, o `null`.

Y al listado, `vigentes` (alumnos activos del filtro con el pack vigente, en todas las páginas) y `hoy` (el día del estudio para el que se calcularon los estados).

## Reglas del estado del pack

Se miran los pagos no anulados del alumno. Un pago "sirve" si no venció (el día del vencimiento todavía vale) y le quedan clases.

| Situación | Estado | `pagoActual` |
|---|---|---|
| Tiene pagos que sirven | `por_vencer` si entre todos le queda 1 clase o menos, o si el último de ellos vence en 7 días o menos; si no, `vigente` | El que se usa primero: el que vence antes, igual que al registrar una asistencia |
| Tiene pagos sin vencer, pero sin clases | `sin_clases` | El que vence último |
| Solo tiene pagos vencidos | `vencido` | El último |
| No tiene pagos | `sin_pack` | `null` |

"Por vencer" mira todos los pagos que sirven: a quien ya pagó el pack siguiente no le aparece que hay que cobrarle. El umbral de 7 días y 1 clase es una decisión tomada por defecto y está anotada en el índice.

Un alumno dado de baja conserva el estado de su pack en la respuesta; la pantalla muestra "Dado de baja" en su lugar y no lo cuenta en `vigentes`.

## Arquitectura

- **La regla es una función pura** en `apps/api/src/modules/pagos/estado-del-pack.ts`: recibe los pagos de un alumno y el día, y devuelve el estado y el pago a mostrar. Se prueba sin base.
- **`pagos.service` expone `resumenDePacks(alumnoIds, hoy)`** y **`asistencias.service` expone `ultimasClases(alumnoIds, hoy)`**. Cada uno consulta sus tablas para todos los alumnos juntos: dos consultas por listado, no una por alumno.
- **El listado pasa a `alumnos/listado.service.ts`.** `pagos.service` y `asistencias.service` ya importan `alumnos.service`; si el listado siguiera ahí, habría una dependencia circular. `clases` ya tiene dos services por el mismo motivo de orden.
- **`vigentes` calcula el estado de todos los alumnos del filtro**, no solo los de la página. Con los cientos de alumnos de un estudio anda bien; si fueran miles, convendría contarlo en SQL.
- **`hoy` viaja en la respuesta** porque el frontend no controla el reloj en los tests: con él decide si una fecha corta lleva el año ("20 dic 2025") o no ("18 oct").

## Qué no se implementa de la maqueta

- **Selector de vistas ("Todos los alumnos ▾") y columna "+"**: no hay vistas ni columnas configurables.
- **Nombre como "Lucía Fernández"**: queda "Fernández, Lucía", porque el listado está ordenado por apellido.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Con clases y más de 7 días de margen, el pack está vigente y se muestra el que se usa primero | Unitario | Si se muestra el pago más nuevo, recepción ve un vencimiento que no es el que corre |
| Queda 1 clase, o el pack vence en 7 días: por vencer. A los 8 días: vigente | Unitario | Si cambia el umbral sin querer, se avisa tarde o siempre |
| Con el pack siguiente ya pagado, el que está por terminarse no lo pone por vencer | Unitario | Si se mira solo el pack en uso, se le cobra dos veces a quien ya pagó |
| Pagos sin vencer y sin clases: sin clases; solo vencidos: vencido con el último; sin pagos: sin pack | Unitario | Si se confunden, recepción no sabe si el alumno usó todo o dejó vencer el pack |
| El día del vencimiento el pack todavía sirve | Unitario | Si se compara con `<=`, el último día se pierde una clase paga |
| `sumarDias` suma y cruza meses | Unitario | Si falla el cruce de mes, "por vencer" se calcula mal a fin de mes |
| El listado trae estado, pago en uso y última clase de cada alumno, ignora pagos anulados y clases futuras, y cuenta vigentes solo entre activos | Integración HTTP | Si la consulta toma un pago anulado o una clase de la semana que viene, recepción cobra o llama a quien no corresponde |
| La tabla muestra estado, pack, clases, vencimiento y última clase, "Dado de baja" para los inactivos y el total de vigentes | Web | Si la pantalla muestra el estado del pack de alguien dado de baja, parece que sigue viniendo |

---

### Tarea 1: Regla del estado del pack

**Archivos:**
- Crear: `apps/api/src/modules/pagos/estado-del-pack.ts`, `estado-del-pack.test.ts`
- Modificar: `apps/api/src/lib/fechas.ts`, `fechas.test.ts`, `packages/shared/src/pagos.ts`

- [x] **Paso 1:** escribir los tests de `sumarDias` y de la regla.
- [x] **Paso 2:** correrlos y verificar que fallan porque las funciones no existen.
- [x] **Paso 3:** implementar `sumarDias`, los tipos `EstadoPack` y `PagoActual`, y `estadoDelPack`.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(pagos): regla del estado del pack de un alumno`.

Cambio al plan: la regla ordena por vencimiento y después por id, no por fecha de cobro. Los ids crecen con la fecha, así que el orden es el mismo que usa la asistencia y la función no necesita la fecha.

### Tarea 2: El listado de alumnos devuelve el estado del pack

**Archivos:**
- Crear: `apps/api/src/modules/alumnos/listado.service.ts`
- Modificar: `alumnos.repository.ts`, `alumnos.service.ts`, `alumnos.routes.ts`, `pagos.repository.ts`, `pagos.service.ts`, `asistencias.repository.ts`, `asistencias.service.ts`, `packages/shared/src/alumnos.ts`
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`

- [x] **Paso 1:** escribir el test HTTP del listado.
- [x] **Paso 2:** correrlo y verificar que falla porque la respuesta no trae los campos nuevos.
- [x] **Paso 3:** implementar las consultas, los services y el listado.
- [x] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): estado del pack y última clase en el listado`.

Cambio al plan: el test "total cuenta todos los resultados" compara la respuesta entera, así que ahora también espera `vigentes` y `hoy`.

### Tarea 3: La tabla de alumnos

**Archivos:**
- Modificar: `apps/web/src/features/alumnos/AlumnosPage.tsx`, `api.ts`, `apps/web/src/lib/formato.ts`, `apps/web/src/components/ui/index.tsx`, `Icono.tsx`
- Test: `apps/web/src/features/alumnos/alumnos.test.tsx`, `ficha.test.tsx`, `apps/web/src/features/agenda/sesion.test.tsx`, `apps/web/test/datos.ts`

- [x] **Paso 1:** escribir el test de la tabla y pasar los handlers del listado a la forma nueva.
- [x] **Paso 2:** correrlo y verificar que falla porque faltan las columnas.
- [x] **Paso 3:** implementar las columnas con íconos en los encabezados, la barra de clases, las fechas cortas y el total de vigentes.
- [x] **Paso 4:** correr los tests web, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): estado del pack en la tabla de alumnos`.

Cambios al plan:
- `test/tabla.ts` tiene `celdasDe(fila)`: el texto de cada celda sin lo que es `aria-hidden`, como la inicial del avatar.
- `Tabla` acepta columnas con ícono (`{ texto, icono }`); por ahora solo la usa esta pantalla.
- Las fechas cortas usan una lista propia de meses: `Intl` en español escribe "sept" o "20 de dic de 2025" según la versión de ICU.

## Verificación final

- [x] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan: API 119, web 31, e2e 1.
- [x] Captura de la pantalla de alumnos con datos reales de la API, comparada con la maqueta: vigente, por vencer, sin clases, vencido y sin pack, con el total de vigentes que coincide con la tabla.
