# Tablero de liquidaciones

**Estado:** en curso  
**Depende de:** frontend-liquidaciones, ficha-del-profesor  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; admin abre `/liquidaciones`, ve el resumen del mes con indicadores, actividad diaria, ranking de profesores y estado de los alumnos, y desde el ranking abre la ficha de un profesor en ese mes, donde cierra, marca pagada y descarga el CSV.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Qué cambia

Pedido del estudio (2026-11-18): la pantalla de liquidaciones pasa a ser un tablero, con un resumen del mes y una ficha por profesor. La referencia fue un CRM de canchas de tenis; esto es lo mismo pensado para un estudio de danza.

`/liquidaciones?periodo=AAAA-MM` deja de ser una tabla de ingresos y sueldos y pasa a ser el resumen. El detalle de un profesor deja el diálogo y pasa a su propia pantalla, `/liquidaciones/:profesorId?periodo=AAAA-MM`. Las acciones de hoy (cerrar, marcar pagada, descargar CSV) se conservan.

**Spec:** [liquidaciones](liquidaciones.md), [pantalla de liquidaciones](frontend-liquidaciones.md), [estructura de base de datos](../estructura%20de%20base%20de%20datos.md).

## Pantalla 1: resumen del mes

Selector de mes arriba, como hoy. Por defecto, el mes anterior.

**Indicadores**, cada uno con la variación contra el mes anterior:

| Indicador | Cálculo |
|---|---|
| Ingresos cobrados | Suma de `pago.monto` no anulados cuya fecha, en el día del estudio, cae en el mes. Es lo que ya devuelve `ingresosDelPeriodo` |
| Sueldos del mes | Por profesor, el monto guardado si la liquidación está cerrada; si no, el calculado. Se suman |
| Le queda al estudio | Ingresos cobrados menos sueldos del mes. Puede ser negativo |
| Asistencias | Asistencias en clases con fecha en el mes |
| Alumnos activos | Alumnos distintos con al menos una asistencia en el mes |
| Alumnos nuevos | Alumnos cuyo primer pago no anulado cae en el mes |
| Clases que se perdieron | Pagos no anulados con `vence_el` en el mes y ya vencidos (`vence_el < hoy`): clases no usadas y su valor, `dividirEnPartes(monto, cantidad_clases)` por cada una |

**Actividad diaria:** un gráfico con una barra por día del mes (asistencias) y una línea (lo cobrado ese día).

**Ingresos por medio de pago:** la tabla de hoy, en un panel.

**Ranking de profesores:** una fila por profesor, ordenada por asistencias de mayor a menor. Columnas: profesor, asistencias, variación contra el mes anterior, sueldo y estado (Abierta, Cerrada, Pagada). Acciones: "Cerrar" y "Marcar pagada" como hoy. El nombre lleva a la ficha.

**Estado de los alumnos (hoy):** una barra apilada con los alumnos activos según el estado de su pack, el mismo que muestra el listado de alumnos.

| Grupo | `EstadoPack` |
|---|---|
| Al día | `vigente` |
| Por vencer | `por_vencer` |
| Sin renovar | `vencido`, `sin_clases` |
| Sin pack | `sin_pack` |

## Pantalla 2: ficha del profesor en el mes

**Encabezado:** nombre, porcentaje vigente, alias/CBU, estado de la liquidación y las acciones "Cerrar", "Marcar pagada" y "Descargar CSV".

**Indicadores:**

| Indicador | Cálculo |
|---|---|
| Sueldo | Guardado si está cerrada; calculado si no. Si difieren, se muestran los dos (regla de hoy) |
| Clases dictadas | Clases del mes con ese `profesor_id`, no canceladas y con fecha `<= hoy` |
| Clases canceladas | Clases del mes con ese `profesor_id` y estado `cancelada` |
| Asistentes por clase | Asistencias dividido clases dictadas, con un decimal. Las clases sin nadie cuentan |
| Alumnos distintos | Alumnos distintos en sus clases del mes |
| Suplencias dadas | Clases del mes que dio y cuyo horario tiene otro titular |
| Suplencias recibidas | Clases del mes de horarios donde es titular y que dio otro profesor |

**Sueldo de los últimos 6 meses:** barras, terminando en el mes elegido. Cada mes usa el guardado si está cerrado y el calculado si no.

**Por horario:** tabla con horario (estilo, día y hora), clases dictadas, asistentes por clase y monto. Las clases únicas (`horario_id` nulo) van juntas en una fila "Clases únicas".

**Clases del mes:** la tabla del diálogo de detalle de hoy (fecha, estilo, asistentes, monto).

## Decisiones

- **Solo admin**, como las liquidaciones de hoy. Recepción no ve sueldos ni ingresos.
- **Sin cupo, sin ocupación.** El estudio tiene una sala y no limita alumnos (decisión 3 del índice). Donde el CRM mostraba ocupación, acá se muestran asistentes por clase.
- **Le queda al estudio es ingresos menos sueldos del mes** (pedido del estudio, 2026-11-18). Un pack cobrado a fin de mes cuenta como ingreso de ese mes, pero sus clases se le pagan al profesor el mes siguiente: el número de un mes sube y el del siguiente baja. Se eligió igual porque algunos estudios venden packs solo en las primeras dos semanas del mes, y ahí casi todas las clases de un pack se dan en el mes en que se cobró. Si el estudio vende packs todo el mes y el número salta, la alternativa es calcularlo por asistencia: `valor_clase - aplicarPorcentaje(valor_clase, porcentaje_bp)` de cada asistencia del mes.
- **La comparación es contra el mes anterior completo**, también cuando el mes elegido está en curso. La web muestra "mes en curso" al lado del título para que no se lea como una caída.
- **Variación sin base:** si el mes anterior es 0, la web muestra "—" en lugar de un porcentaje.
- **El titular de una suplencia es el titular actual del horario.** El horario no guarda la historia de su profesor. Si cambió de titular a mitad de mes, las suplencias de ese mes se cuentan contra el nuevo.
- **Gráficos en SVG escrito a mano**, en `components/ui/Graficos.tsx`. No se instala una biblioteca de gráficos, por el mismo motivo que los íconos: menos dependencias y tests rápidos. Dos componentes: `BarrasConLinea` y `BarraApilada`. Los colores salen de las variables de `index.css`; los estados de la barra de alumnos usan verde, ámbar y rojo.
- **Módulo `tablero` en la API**, de solo lectura. Su repository lee `asistencia`, `clase` y `horario`, como ya hace `liquidaciones`. Lo de pagos sale de funciones nuevas en `pagos.service`, los sueldos de `liquidaciones.service` y los ids de alumnos activos de `alumnos.service`.

## API

| Método y ruta | Rol | Query | Respuesta |
|---|---|---|---|
| `GET /api/tablero` | admin | `?periodo=AAAA-MM` | `200 TableroDelMes` |
| `GET /api/tablero/profesores/:id` | admin | `?periodo=AAAA-MM` | `200 TableroDelProfesor`; `404` si no existe |

Formas, en `packages/shared/src/tablero.ts`:

- `Indicadores`: `{ ingresos, sueldos, leQuedaAlEstudio, asistencias, alumnosActivos, alumnosNuevos, clasesPerdidas, valorPerdido }`
- `TableroDelMes`: `{ periodo, actual: Indicadores, anterior: Indicadores, porDia: { fecha, asistencias, cobrado }[], ingresosPorMedio: IngresosDelPeriodo['porMedio'], profesores: FilaDelRanking[], alumnosPorEstado: Record<EstadoPack, number> }`
- `FilaDelRanking`: `ResumenProfesor & { asistenciasMesAnterior: number }`
- `TableroDelProfesor`: `{ periodo, profesor: { id, nombre, apellido, aliasCbu, porcentajeBp }, liquidacion: Liquidacion | null, montoCalculado, clasesDictadas, clasesCanceladas, asistencias, alumnosDistintos, suplenciasDadas, suplenciasRecibidas, sueldoPorMes: { periodo, monto }[], porHorario: { horarioId: number | null, estilo, diaSemana: number | null, horaInicio: string | null, clases, asistencias, monto }[], clases: DetalleDeClase[] }`

`porDia` trae todos los días del mes, con 0 en los días sin actividad. `sueldoPorMes` trae 6 meses, del más viejo al elegido.

`GET /api/liquidaciones/detalle` queda: lo usa el CSV.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Indicadores de un mes con pagos, un pago anulado, asistencias de dos profesores con porcentajes distintos y un pack vencido con 2 clases sin usar: respuesta completa de `actual` | Integración (`tablero.test.ts`) | Contar el pago anulado, calcular los sueldos con el porcentaje actual en vez del copiado, o contar como perdidas las clases de un pack que vence más adelante |
| Un mes con sueldos mayores que los ingresos devuelve `leQuedaAlEstudio` negativo | Integración | Recortar el resultado a 0 y esconder un mes a pérdida |
| `anterior` trae los indicadores del mes previo, y un alumno con pagos en los dos meses es nuevo solo en el primero | Integración | Calcular `anterior` con el rango del mes elegido, o tomar como nuevo a cualquiera que pagó en el mes |
| `sueldos` usa el monto guardado de una liquidación cerrada aunque después cambie una asistencia de otro profesor abierto | Integración | Sumar siempre el calculado, que no es lo que el estudio paga |
| `porDia` tiene un elemento por día del mes, y un pago a las 23:30 del último día cae en ese día y no en el siguiente | Integración | Agrupar por fecha UTC, o devolver solo los días con actividad |
| `alumnosPorEstado` cuenta solo alumnos activos, uno por cada estado | Integración | Contar alumnos dados de baja, o perder un estado al agrupar |
| Ficha de un profesor: clases dictadas sin contar la cancelada ni la futura, suplencia dada y recibida, por horario con la fila de clases únicas | Integración | Contar clases futuras como dictadas, invertir dadas y recibidas, o perder las clases sin horario |
| `sueldoPorMes` trae 6 meses, con el guardado en el cerrado y el calculado en los abiertos | Integración | Pedir un rango de 5 meses, o ignorar la liquidación cerrada |
| Recepción recibe 403 en las dos rutas; un profesor que no existe da 404 | Integración | Dejar las rutas sin `requerirRol('admin')` |
| La variación muestra el porcentaje con signo y "—" cuando el mes anterior es 0 | Unitario (`variacion.test.ts`) | Dividir por cero y mostrar "Infinity%" |
| El resumen muestra los indicadores, el ranking ordenado por asistencias y el estado de los alumnos; el nombre de un profesor lleva a su ficha con el mismo período | Web (`tablero.test.tsx`) | Perder el período al navegar, o mostrar el ranking en el orden de la API |
| "Cerrar" y "Marcar pagada" siguen funcionando desde el ranking | Web (`tablero.test.tsx`, sale de `liquidaciones.test.tsx`) | Mandar el mes actual en lugar del elegido |
| La ficha muestra indicadores, sueldo de 6 meses, la tabla por horario y las clases; con la liquidación cerrada y montos distintos muestra los dos | Web (`ficha-liquidacion.test.tsx`) | Mostrar solo el calculado en una liquidación cerrada |
| `BarrasConLinea` dibuja una barra por dato con su valor en el título accesible | Web (`graficos.test.tsx`) | Escalar mal y dibujar barras de alto negativo o sin rótulo para lectores de pantalla |

Los tests de `csv.test.ts` siguen sin cambios.

---

### Tarea 1: Resumen del mes en la API

**Archivos:**
- Crear: `packages/shared/src/tablero.ts` (tipos) y exportarlo desde el índice de `@studio/shared`.
- Crear: `apps/api/src/modules/tablero/tablero.repository.ts`, `tablero.service.ts`, `tablero.routes.ts`, y registrar las rutas en `app.ts`.
- Modificar: `apps/api/src/modules/pagos/pagos.repository.ts` y `pagos.service.ts`: `cobradoPorDia(periodo)`, `alumnosNuevos(periodo)`, `clasesPerdidas(periodo, hoy)`.
- Modificar: `apps/api/src/modules/alumnos/alumnos.service.ts`: `idsDeAlumnosActivos()`.
- Test: `apps/api/src/modules/tablero/test/tablero.test.ts`

- [x] **Paso 1:** escribir los 6 primeros tests de la tabla y la parte de `/api/tablero` del test de permisos.
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(tablero): resumen del mes para liquidaciones`.

### Tarea 2: Ficha del profesor en la API

**Archivos:**
- Modificar: `tablero.repository.ts`, `tablero.service.ts`, `tablero.routes.ts`, `packages/shared/src/tablero.ts`.
- Test: `tablero.test.ts`

- [x] **Paso 1:** escribir los tests de la ficha, de `sueldoPorMes` y el resto del de permisos.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(tablero): ficha del profesor en el mes`.

### Tarea 3: Gráficos y pantalla de resumen

**Archivos:**
- Crear: `apps/web/src/components/ui/Graficos.tsx` (`BarrasConLinea`, `BarraApilada`) y exportarlos desde `index.tsx`.
- Crear: `apps/web/src/features/liquidaciones/variacion.ts`.
- Modificar: `apps/web/src/features/liquidaciones/api.ts`, `LiquidacionesPage.tsx`.
- Test: `apps/web/src/components/ui/test/graficos.test.tsx`, `apps/web/src/features/liquidaciones/test/variacion.test.ts`, `tablero.test.tsx`; mover los tests de cerrar y marcar pagada de `liquidaciones.test.tsx` a `tablero.test.tsx`.

- [ ] **Paso 1:** escribir los tests de variación, gráficos y resumen.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(liquidaciones): tablero con el resumen del mes`.

### Tarea 4: Pantalla de la ficha del profesor

**Archivos:**
- Crear: `apps/web/src/features/liquidaciones/FichaLiquidacionPage.tsx`.
- Modificar: `apps/web/src/rutas.tsx` (`liquidaciones/:profesorId` dentro de `SoloAdmin`), `api.ts`; quitar el diálogo de detalle de `LiquidacionesPage.tsx`.
- Test: `apps/web/src/features/liquidaciones/test/ficha-liquidacion.test.tsx`

- [ ] **Paso 1:** escribir el test de la ficha.
- [ ] **Paso 2:** correrlo y verificar que falla.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr el test y verificar que pasa.
- [ ] **Paso 5:** commit `feat(liquidaciones): ficha del profesor en el mes`.

## Queda para después

Propuesto en la misma conversación y dejado afuera de esta feature para que la primera versión sea chica:

- Packs vendidos (dona por pack, en cantidad y en pesos).
- Ingresos por medio de pago como dona.
- Mapa de calor de días por hora con asistentes promedio.
- Asistencias por estilo.
- En la ficha del profesor: asistentes de cada clase en barras, retención contra el mes anterior y alumnos más frecuentes.
- Ver 3 o 6 meses en el resumen.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] `pnpm e2e` pasa: recorre la liquidación y tiene que seguir encontrando cerrar y marcar pagada.
- [ ] Mirar `/liquidaciones` y una ficha en Chromium con la base de desarrollo, en tema claro y oscuro.
