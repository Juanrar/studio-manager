# Liquidaciones en solapas

> **Para agentes:** usá superpowers:subagent-driven-development, con un subagente por tarea y una revisión después de cada una (pedido del estudio, 2026-11-11). Los pasos usan checkbox (`- [ ]`). Leé primero [CLAUDE.md](../../CLAUDE.md), [el índice](index.md) y `docs/entorno/web.md` y `docs/entorno/tests-api.md`.

**Estado:** pendiente  
**Depende de:** tablero-de-liquidaciones  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan. Un admin entra a `/liquidaciones` y ve tres solapas. Resumen muestra el mes sin acciones. En Liquidar busca un profesor, lo cierra y lo marca pagado. En Estadísticas busca un profesor, ve sus números y abre los alumnos de cada clase con su pack. El CSV trae cada clase con sus alumnos debajo.

**Objetivo:** separar mirar el mes, pagar sueldos y analizar a un profesor, y mostrar quién fue a cada clase, con qué pack y cuánto le toca al profesor por cada alumno.

**Arquitectura:** la API suma los alumnos de cada clase a `GET /api/tablero/profesores/:id`. La web deja una sola pantalla, `/liquidaciones`, con tres solapas. El mes, la solapa y el profesor elegido viven en la dirección. Liquidar y Estadísticas comparten el buscador con la lista de profesores. `/liquidaciones/:profesorId` redirige a Estadísticas.

**Prototipo:** rama `prototipo/detalle-de-liquidacion` (commit `afff50a`). El estudio lo aprobó el 2026-11-18. Se mira, no se copia: está escrito sin tests y con cerrar y pagar simulados.

## Qué pidió el estudio (2026-11-18)

- Ver quiénes fueron a cada clase, con qué pack y la parte que le corresponde al profesor. Un botón "Detalle" lo abre. El CSV también lo trae.
- El CSV va por clase, con los alumnos debajo.
- Resumen muestra solo cómo viene el estudio. No se liquida desde el ranking.
- La liquidación va aparte: se busca al profesor con un buscador y se liquida uno por uno.
- Liquidar muestra las clases con cantidad de alumnos y lo que le toca al profesor, sin nombres.
- Las estadísticas del profesor van en otra solapa, "Estadísticas", con buscador, lista y detalle. Ahí, "Detalle" abre los alumnos de cada clase. También se descarga el CSV.
- El estado de los alumnos se muestra en cuatro números (variante A del prototipo).
- Se elige la variante A de Liquidar: lista a la izquierda y profesor a la derecha.
- La solapa Estadísticas lleva un ícono de barras.
- Un botón para volver con flecha, que se reconozca.

## Pantalla

`/liquidaciones?periodo=AAAA-MM&solapa=resumen|liquidar|estadisticas&profesor=ID`

- `periodo` por defecto es el mes anterior, como hoy.
- `solapa` por defecto es `resumen`. Un valor desconocido también cae en `resumen`.
- Cambiar de solapa o de mes conserva `periodo`, `solapa` y `profesor`.
- Elegir un profesor escribe `profesor` con `replace`, para que "atrás" del navegador no recorra cada clic de la lista.

**Encabezado:** título "Liquidaciones de {mes}" con "mes en curso" como hoy, selector de mes a la derecha y debajo las solapas (`Pestanas`): Resumen (ícono `tablero`), Liquidar (`billetera`) y Estadísticas (`barras`).

**Resumen:**
- Indicadores, actividad diaria e ingresos del mes, sin cambios.
- Ranking de profesores con las columnas Profesor, Asistencias, Contra el mes anterior y Sueldo. El nombre es texto, no enlace. No tiene estado ni acciones.
- Panel "Alumnos activos hoy: {total}" con cuatro recuadros (Al día, Por vencer, Sin renovar, Sin pack), cada uno con un punto de color y el número grande. Reemplaza la barra apilada.

**Lista de profesores** (Liquidar y Estadísticas):
- Columna izquierda de `18rem` en pantallas `lg`. En pantallas angostas, la lista va arriba y el detalle abajo.
- Buscador con `aria-label="Buscar profesor"` y el texto "Buscar profesor por nombre o apellido". Tiene foco al entrar a la solapa.
- La búsqueda ignora tildes y mayúsculas. Cada palabra escrita tiene que aparecer en "nombre apellido": "zapata erik" encuentra a Erik Zapata. Enter elige el primero de la lista filtrada.
- Cada profesor es un botón con "Apellido, Nombre", su sueldo debajo y un dato a la derecha que pone la solapa. El elegido lleva `aria-current="true"` y fondo `bg-resalte`.
- Orden por apellido y nombre, con `localeCompare(..., 'es')`.
- Sin coincidencias: "Ningún profesor con ese nombre."
- Si el mes no tiene profesores: "No hay profesores en este mes."
- Sin profesor elegido, el panel derecho muestra el texto de la solapa.

**Liquidar:**
- Arriba: "{n} de {total} profesores pagados" y "Falta pagar {suma}". La suma es el sueldo de los no pagados (guardado si está cerrada, calculado si no).
- En la lista, el dato a la derecha es la insignia de estado: "Sin cerrar" (ámbar), "Por pagar" (azul), "Pagada" (verde).
- Texto sin elegido: "Elegí un profesor de la lista para ver y liquidar su sueldo."
- El panel del profesor muestra:
  - nombre y los pasos Abierta → Cerrada → Pagada; el paso actual va con aro y los anteriores con tilde, y en Pagada los tres llevan tilde;
  - a la derecha, "Descargar CSV" y un solo botón principal: "Cerrar liquidación" si está abierta, "Marcar como pagada" si está cerrada, ninguno si está pagada;
  - los datos Sueldo, Clases dictadas, Porcentaje y Alias o CBU; si la liquidación está cerrada y el monto guardado difiere del calculado, debajo del sueldo va "Calculado hoy: {monto}" en ámbar, la regla de hoy;
  - "Clases del mes": una fila por clase con fecha `DD/MM`, clase, "{n} alumno(s)" y la parte del profesor; si no hay clases, "No dio clases con asistentes este mes.".
- "Cerrar liquidación" abre un `Dialogo` titulado "Cerrar liquidación" con "¿Cerrar la liquidación de {Nombre Apellido} por {sueldo}? Después el monto no cambia aunque se carguen asistencias." y los botones "Cancelar" y "Cerrar liquidación". Confirmar llama a la API.
- Si la API falla (por ejemplo, el mes no terminó), el panel muestra el mensaje en un `Aviso`.
- Si el profesor de la dirección no está en la lista del mes: "Ese profesor no tiene liquidación en este mes."

**Estadísticas:**
- En la lista, el dato a la derecha es "{n} asistencia(s)".
- Texto sin elegido: "Elegí un profesor de la lista para ver sus estadísticas del mes."
- Si el profesor de la dirección no está en la lista del mes: "Ese profesor no tiene datos en este mes."
- El panel muestra:
  - nombre, "Porcentaje: {p} · Alias o CBU: {alias}" y "Descargar CSV";
  - los indicadores, el sueldo de 6 meses y la tabla por horario que hoy tiene la ficha;
  - "Clases del mes": tabla con Fecha, Clase, Asistentes, Monto y un botón "Detalle" por fila (en `CeldaDeAcciones`). "Detalle" abre debajo una fila con la tabla Alumno, Pack, Valor de la clase, Parte del profesor y cambia a "Ocultar". Se pueden abrir varias clases a la vez.
- No tiene botones de cerrar ni de pagar.

**`/liquidaciones/:profesorId?periodo=X`** redirige con `replace` a `/liquidaciones?periodo=X&solapa=estadisticas&profesor=:profesorId`. Sin `periodo`, usa el mes anterior.

**Volver:** en `Pagina`, `volverA` deja de ser un enlace gris con "/" y pasa a ser un enlace con forma de botón secundario, ícono `anterior` y el texto. Cambia en todas las pantallas que lo usan.

## CSV

Nombre del archivo: `sueldo-{apellido}-{nombre}-{periodo}.csv` en minúsculas, como hoy. Separador `;`, fin de línea `\r\n`, con BOM, fechas `DD/MM/AAAA`. Los montos van sin formato.

```
Fecha;Clase;Alumno;Pack;Valor de la clase;Parte del profesor
03/03/2026;Hip-Hop;2 alumnos;;;1400
;;Martina García;Pack x4;1300;700
;;Joaquín Pérez;Clase suelta;1500;700
Total;;;;;1400
```

La fila de la clase lleva "{n} alumno(s)" en la columna Alumno y la parte del profesor de toda la clase en la última. El total suma las partes de todas las clases.

## API

`GET /api/tablero/profesores/:id` cambia solo en `clases`. Tipos en `packages/shared/src/tablero.ts`:

- `AlumnoDeLaClase`: `{ alumnoId: number; nombre: string; apellido: string; pack: string; valorClase: number; parte: number }`
- `ClaseDelMes`: `DetalleDeClase & { alumnos: AlumnoDeLaClase[] }`
- `TableroDelProfesor.clases`: `ClaseDelMes[]`

`DetalleDeClase` no cambia: lo sigue usando `GET /api/liquidaciones/detalle`.

`parte` es `aplicarPorcentaje(asistencia.valor_clase, asistencia.porcentaje_bp)`, con los valores copiados al registrar. Por eso la suma de `parte` de una clase es su `monto`. Los alumnos de cada clase van ordenados por apellido y nombre.

## Decisiones

- **Una sola pantalla con solapas.** La ficha aparte del profesor se va. Así no hace falta volver para pasar de un profesor a otro.
- **El pack es su nombre actual** (`pack.nombre` del pago de la asistencia). El nombre no se copia al registrar, así que renombrar un pack cambia lo que se ve en meses anteriores. El dinero no cambia porque sale de `valor_clase` y `porcentaje_bp`, que sí se copian.
- **El repository de `tablero` une `asistencia` con `alumno`, `pago` y `pack`** en la misma consulta, como ya une `clase` y `horario`. Es lectura, y pedir los nombres a cada service multiplicaría las consultas.
- **El ranking queda solo para mirar.** Cerrar y pagar viven en Liquidar.
- **La barra apilada sale.** Si `BarraApilada` queda sin uso, se borra junto con su test.
- **Ícono de Resumen:** `tablero` ("layout-dashboard" de Tabler). El que usaba el prototipo era una torta de cumpleaños. Decisión del agente: el estudio no respondió y se puede cambiar.
- **Sale el CSV por asistencia** del primer prototipo.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| La ficha trae en cada clase sus alumnos con nombre, pack, valor de la clase y parte, ordenados por apellido; un alumno con pack y otro con clase suelta en la misma clase, y una asistencia con porcentaje copiado distinto del vigente | Integración (`tablero.test.ts`) | Calcular la parte con el porcentaje vigente, perder el nombre del pack o mezclar alumnos de otra clase |
| La suma de `parte` de cada clase es su `monto` | Integración | Redondear cada parte de otra forma que el monto |
| El CSV escribe la clase con "{n} alumnos" y su parte, debajo cada alumno y al final el total; un estilo con `;` va entre comillas | Unitario (`csv.test.ts`) | Cambiar el orden de las columnas, perder los alumnos o sumar dos veces el total |
| Una clase de un alumno dice "1 alumno" | Unitario | Escribir "1 alumnos" |
| Las solapas cambian `solapa` en la dirección y conservan `periodo` y `profesor`; cambiar el mes conserva la solapa | Web (`tablero.test.tsx`) | Perder al profesor elegido al pasar de Liquidar a Estadísticas |
| `solapa` desconocida muestra Resumen | Web | Mostrar una pantalla vacía |
| El ranking no tiene estado, botones ni enlaces | Web | Volver a liquidar desde el ranking |
| El estado de los alumnos muestra el total y los cuatro números, con vencidos y sin clases juntos en "Sin renovar" | Web | Perder un estado al agrupar |
| El buscador encuentra sin tildes ni mayúsculas y con apellido primero ("zapata erik"); sin coincidencias muestra el aviso | Web (`liquidar.test.tsx`) | Comparar con tildes, o exigir el orden nombre apellido |
| Enter elige el primero de la lista filtrada y escribe `profesor` en la dirección | Web | Elegir el primero sin filtrar |
| La cabecera cuenta pagados y suma lo que falta pagar, con el monto guardado de una cerrada | Web | Sumar el calculado de una cerrada, o contar las cerradas como pagadas |
| La lista muestra la insignia de cada estado | Web | Mostrar "Pagada" en una cerrada |
| Una abierta muestra "Cerrar liquidación"; el diálogo trae nombre y monto; Cancelar no llama a la API; Confirmar manda `{ profesorId, periodo }` | Web | Cerrar sin confirmar, o mandar el mes actual en lugar del elegido |
| Una cerrada muestra "Marcar como pagada" y llama a `/liquidaciones/:id/pagar`; una pagada no muestra botón y sus tres pasos llevan tilde | Web | Mostrar un botón de más, o dejar Pagada como paso pendiente |
| El error de la API al cerrar se muestra en el panel | Web | Tragar el error de un mes que no terminó |
| Las clases muestran fecha, clase, "{n} alumnos" y la parte, sin nombres de alumnos | Web | Mostrar los alumnos en Liquidar |
| Con la liquidación cerrada y montos distintos muestra "Calculado hoy" | Web | Perder la regla de los dos montos |
| Un profesor de la dirección que no está en la lista muestra "Ese profesor no tiene liquidación en este mes." | Web | Romper el panel o mostrar otro profesor |
| "Descargar CSV" arma el archivo con las clases y sus alumnos y el nombre del archivo | Web | Descargar el CSV viejo por clase sin alumnos |
| Estadísticas muestra indicadores, sueldo de 6 meses, por horario y las clases, con "{n} asistencias" en la lista | Web (`estadisticas.test.tsx`, sale de `ficha-liquidacion.test.tsx`) | Perder lo que mostraba la ficha |
| "Detalle" abre los alumnos de esa clase y cambia a "Ocultar"; abrir otra deja abierta la primera | Web | Mostrar los alumnos de otra clase, o cerrar las demás |
| Estadísticas no tiene botones de cerrar ni de pagar | Web | Duplicar las acciones de Liquidar |
| `/liquidaciones/7?periodo=2026-03` termina en Estadísticas con el profesor 7 elegido | Web | Dejar el enlace viejo roto |
| `volverA` es un enlace con el texto y la flecha, y sigue llamándose "Liquidaciones" o "Agenda" para el lector de pantalla | Web (`pagina.test.tsx`) | Dejar el ícono sin `aria-hidden` y cambiar el nombre del enlace |
| El e2e encuentra a Erik en Liquidar con "$1.400" y "Sin cerrar" | E2E (`flujo-principal.spec.ts`) | Romper el camino real del buscador |

## Review Focus

Casos que la tabla cubre por pedido de esta sección, por si un revisor los busca:

1. Cerrar en el mes en curso: la API responde 400 y el panel tiene que mostrarlo (test "El error de la API al cerrar").
2. Profesor en la dirección que no está en el mes (test "no tiene liquidación").
3. Búsqueda con apellido primero o sin tildes (test del buscador).
4. Cambiar de mes con un profesor elegido: se conserva y se piden sus datos del mes nuevo (test de solapas).
5. Una clase con un solo alumno en pantalla y en el CSV (test "1 alumno").

---

### Tarea 1: Alumnos de cada clase en la API

**Archivos:**
- Modificar: `packages/shared/src/tablero.ts` (`AlumnoDeLaClase`, `ClaseDelMes`, `TableroDelProfesor.clases`).
- Modificar: `apps/api/src/modules/tablero/tablero.repository.ts`: `listarAlumnosDeLasClases(ej: Ejecutor, profesorId: number, desde: FechaDia, hasta: FechaDia): Promise<AlumnoEnClase[]>`, con `AlumnoEnClase = { claseId: number; alumnoId: number; nombre: string; apellido: string; pack: string; valorClase: number; porcentajeBp: number }`, ordenado por apellido y nombre.
- Modificar: `apps/api/src/modules/tablero/tablero.service.ts`: `tableroDelProfesor` arma `clases: ClaseDelMes[]`.
- Test: `apps/api/src/modules/tablero/test/tablero.test.ts`

**Interfaces:**
- Produce: `ClaseDelMes` y `AlumnoDeLaClase` exportados desde `@studio/shared`, y `TableroDelProfesor.clases: ClaseDelMes[]`.

- [x] **Paso 1:** escribir los dos tests de la API de la tabla y sumar `alumnos` a la respuesta completa del test de la ficha que ya existe.
- [x] **Paso 2:** correr `pnpm --filter @studio/api exec vitest run src/modules/tablero` y verificar que fallan porque falta `alumnos`.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan. Correr `pnpm typecheck`.
- [x] **Paso 5:** commit `feat(tablero): alumnos de cada clase en la ficha del profesor`.

### Tarea 2: Solapas, resumen sin acciones y botón de volver

**Archivos:**
- Modificar: `apps/web/src/components/ui/Icono.tsx`: íconos `tablero` (Tabler "layout-dashboard") y `barras` (Tabler "chart-bar", los trazos están en el prototipo).
- Modificar: `apps/web/src/components/ui/index.tsx`: `volverA` en `Pagina`.
- Modificar: `apps/web/src/features/liquidaciones/LiquidacionesPage.tsx`: lee `periodo`, `solapa` y `profesor`, dibuja las solapas y pasa a cada solapa `{ tablero: TableroDelMes; periodo: string; profesorId: number | null; alElegir: (id: number) => void }`. Liquidar y Estadísticas quedan vacías hasta las tareas 3 y 4.
- Crear: `apps/web/src/features/liquidaciones/ResumenDelMes.tsx` con lo que hoy es `Resumen`, el ranking sin acciones y `EstadoDeAlumnos`.
- Borrar `BarraApilada` y su test si queda sin uso.
- Test: `apps/web/src/features/liquidaciones/test/tablero.test.tsx`; crear `apps/web/src/components/ui/test/pagina.test.tsx`. Los tests de cerrar y pagar desde el ranking salen de `tablero.test.tsx`: vuelven en la tarea 3.

**Interfaces:**
- Produce: `type PropsDeSolapa = { tablero: TableroDelMes; periodo: string; profesorId: number | null; alElegir: (id: number) => void }`, exportado desde `LiquidacionesPage.tsx`.

- [x] **Paso 1:** escribir los tests de solapas, `solapa` desconocida, ranking, estado de los alumnos y `volverA`.
- [x] **Paso 2:** correr `pnpm --filter @studio/web exec vitest run src/features/liquidaciones src/components/ui` y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(liquidaciones): solapas y resumen sin acciones`.

### Tarea 3: Solapa Liquidar y CSV con alumnos

**Archivos:**
- Crear: `apps/web/src/features/liquidaciones/ListaDeProfesores.tsx`: `ListaDeProfesores({ profesores, elegido, alElegir, datoDe, sinElegido, children })`, con `profesores: FilaDelRanking[]`, `datoDe: (fila: FilaDelRanking) => ReactNode` y `sinElegido: string`. Exporta `coincideConBusqueda(fila: FilaDelRanking, busqueda: string): boolean`.
- Crear: `apps/web/src/features/liquidaciones/Liquidar.tsx`: `Liquidar(props: PropsDeSolapa)`, `estadoDeLiquidacion(liquidacion: Liquidacion | null): 'abierta' | 'cerrada' | 'pagada'` y el panel del profesor. Usa `useCerrarLiquidacion` y `useMarcarPagada` de `api.ts` y `useTableroDelProfesor` para las clases y los datos.
- Modificar: `apps/web/src/features/liquidaciones/csv.ts`: `detalleACsv(clases: ClaseDelMes[]): string` con el formato de "CSV"; `nombreDelCsv(ficha: TableroDelProfesor): string`.
- Modificar: `LiquidacionesPage.tsx` para mostrar `Liquidar`.
- Test: crear `apps/web/src/features/liquidaciones/test/liquidar.test.tsx`; modificar `csv.test.ts`.

**Interfaces:**
- Consume: `PropsDeSolapa` (tarea 2), `ClaseDelMes` (tarea 1).
- Produce: `ListaDeProfesores`, `detalleACsv`, `nombreDelCsv`, que usa la tarea 4.

- [x] **Paso 1:** escribir los tests de CSV y de Liquidar de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(liquidaciones): solapa para liquidar con buscador`.

### Tarea 4: Solapa Estadísticas, redirección y e2e

**Archivos:**
- Crear: `apps/web/src/features/liquidaciones/Estadisticas.tsx`: `Estadisticas(props: PropsDeSolapa)` y el panel con lo que hoy muestra `FichaLiquidacionPage` (indicadores, sueldo de 6 meses, por horario) más las clases con "Detalle".
- Modificar: `apps/web/src/features/liquidaciones/FichaLiquidacionPage.tsx`: queda solo la redirección.
- Modificar: `LiquidacionesPage.tsx` para mostrar `Estadisticas`.
- Modificar: `e2e/flujo-principal.spec.ts`: el último paso va a la solapa Liquidar, busca "Zapata", lo elige y verifica "$1.400" y "Sin cerrar" en la lista.
- Test: mover `ficha-liquidacion.test.tsx` a `estadisticas.test.tsx` y adaptarlo; los tests de cerrar, pagar y CSV de la ficha salen, porque ya están en `liquidar.test.tsx`.

**Interfaces:**
- Consume: `PropsDeSolapa` (tarea 2), `ListaDeProfesores`, `detalleACsv` y `nombreDelCsv` (tarea 3).

- [x] **Paso 1:** escribir los tests de Estadísticas y de la redirección, y adaptar el e2e.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests web y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(liquidaciones): solapa de estadísticas del profesor`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] `pnpm e2e` pasa.
- [ ] Mirar las tres solapas en Chromium con datos simulados (`docs/entorno/e2e.md`): pasos centrados, "Detalle" abierto en Estadísticas y la pantalla angosta con la lista arriba.
- [ ] Bitácora del índice y nota en `docs/entorno/web.md` si apareció alguna trampa nueva.
