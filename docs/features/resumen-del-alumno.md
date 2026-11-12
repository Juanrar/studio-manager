# Resumen del alumno en una ventana

**Estado:** pendiente  
**Depende de:** ficha-del-alumno, clases-anotadas-en-la-actividad  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; al tocar un alumno en el listado se abre una ventana ancha encima de la lista, con la pestaña Resumen primero: contacto, pack actual, indicadores de actividad, los profesores con los que toma clases y un gráfico de los últimos 12 meses con lo que compró y las clases que tomó.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Referencia:** la variante C del prototipo, en la rama `prototipo/ficha-del-alumno` (commit `7da0366`, fuera de main). Se ve en `/alumnos/:id?variante=C`. El estudio la eligió el 2026-11-11 entre cuatro variantes, a partir de la ficha de un cliente de un CRM de canchas de tenis.

## Para qué

Hoy la ficha cuenta lo que pasó hecho por hecho (Actividad) y lista los pagos. Para saber cuánto viene una alumna, con quién toma clases o si usa el pack que compra hay que contar a mano. El resumen responde eso al abrir la ficha.

## Qué no se hace

- **Compañeras con las que coincide en clase.** Se puede calcular, pero recepción no decide nada con ese dato.
- **Gráfico de plata gastada.** El monto sale del pack, que ya está debajo de cada mes.
- **Lo que es del tenis o de un CRM de ventas:** nivel, género, torneos, campañas, mensajes.
- **Enlace a WhatsApp en el teléfono.** Los teléfonos se cargan sin formato fijo y el enlace necesita el número completo con código de país.
- **Página entera para el alumno.** Se probó (variante B) y el estudio prefirió la ventana.

## Pantalla

La ruta no cambia: `/alumnos/:id` sigue siendo hija del listado, que queda montado con su búsqueda. Cambia el contenedor: en lugar de `PanelLateral`, una ventana centrada de hasta `max-w-5xl` sobre un fondo oscuro.

- **Encabezado:** inicial, nombre, estado del pack (o "Dado de baja"), pack en uso y "Alumna desde" con el día del alta. A la derecha, "Registrar pago" y el botón de cerrar.
- **Cerrar:** el botón, un clic fuera de la ventana o Escape. Vuelve a `/alumnos`.
- **Pestañas:** Resumen (la que se abre primero), Actividad, Datos y Pagos. Las tres últimas no cambian.
- **Resumen, arriba, en tres columnas:**
  - Contacto: teléfono, email y día del alta. Debajo, el pack actual con las clases restantes y el vencimiento.
  - Actividad: los indicadores (ver abajo).
  - Toma clases con: hasta cuatro profesores, con su inicial, el estilo y la cantidad de clases.
- **Resumen, abajo:** a la izquierda el gráfico "Mes a mes"; a la derecha, el mes elegido con lo que compró, cuántas clases tomó y la tabla de esas clases (día, estilo, profesor). Se abre con el mes actual elegido. Tocar una barra elige ese mes.
- **Gráfico:** una barra por mes, los últimos 12 contando el actual. En azul (`bg-acento`) las clases tomadas; encima, en ámbar, las vencidas sin usar. Arriba de la barra el número de tomadas; debajo el mes y lo que compró. Sin librería de gráficos: son `div` con altura proporcional, como en el prototipo.
- **Un mes con más de una compra** muestra debajo de la barra la primera y "+1"; el detalle de la derecha las muestra todas.
- **Alumno sin clases ni pagos:** los indicadores muestran "—", "Toma clases con" dice "Todavía no tomó clases" y el gráfico sale con las 12 barras vacías.

## Indicadores

| Indicador | Regla |
|---|---|
| Clases tomadas | Asistencias con fecha hasta hoy, desde el alta |
| Por semana | Asistencias de los últimos 56 días hasta hoy, dividido 8, con un decimal |
| Última clase | "Hoy", "Ayer" o "Hace N días" desde la última asistencia hasta hoy |
| Estilo que más toma | El estilo con más asistencias en los últimos 12 meses. Ante un empate, el de la asistencia más reciente |
| Suele venir | Los días de la semana y la hora con más asistencias en los últimos 56 días, hasta dos ("Martes y jueves 19:00"). Vacío con menos de 2 asistencias en ese período |
| Vencidas sin usar | Suma de las vencidas de los 12 meses del gráfico |
| Total pagado | Suma de `pago.monto` de los pagos no anulados. Solo para administradores |

## Qué devuelve la API

`GET /api/alumnos/:id/resumen` (nuevo), para los dos roles. Responde 404 si el alumno no existe.

```ts
type ResumenDeAlumno = {
  clasesTomadas: number;
  clasesEnOchoSemanas: number;          // la web divide por 8
  ultimaClase: string | null;           // día
  hoy: string;                          // día del estudio, para "Hace N días"
  estiloMasTomado: string | null;
  sueleVenir: { diasSemana: number[]; horaInicio: string } | null;
  vencidasSinUsar: number;
  totalPagado: number | null;           // null para recepción
  profesores: { id: number; nombre: string; apellido: string; estilo: string; clases: number }[];
  meses: {
    mes: string;                        // AAAA-MM, del más viejo al actual, siempre 12
    compras: { pack: string; veces: number }[];
    tomadas: number;
    vencidas: number;
    clases: { fecha: string; estilo: string; profesor: PersonaResumen }[];  // de la más nueva a la más vieja
  }[];
};
```

Reglas:

- **Tomadas de un mes:** asistencias cuya clase tiene fecha en ese mes y no es posterior a hoy. Una clase anotada para más adelante no cuenta.
- **Compras de un mes:** pagos no anulados cuyo cobro cae en ese mes, en la zona del estudio. Dos pagos del mismo pack se juntan: `{ pack: 'Clase suelta', veces: 2 }`. La clase suelta es el pack de una clase; no hay un tipo aparte.
- **Vencidas de un mes:** por cada pago no anulado **comprado** en ese mes y ya vencido (`vence_el` anterior a hoy), `cantidad_clases` menos sus asistencias. Van en el mes de la compra y no en el del vencimiento, para que "compró Pack 8, tomó 5, se le vencieron 3" se lea en una sola barra. Un pago que todavía no venció no suma vencidas.
- **Las tomadas de un mes no son solo del pack de ese mes:** un pack comprado el 20 se usa también el mes siguiente. Tomadas más vencidas puede no dar la cantidad del pack. Es lo esperado.
- **Profesor:** quien dio la clase (el suplente, si hubo), igual que en Actividad. Su `estilo` es el que más veces le tomó este alumno. Se ordenan de más clases a menos y se devuelven hasta cuatro.
- **Total pagado** se calcula solo si el usuario es administrador. Recepción recibe `null` y la pantalla no muestra el indicador.

## Arquitectura

- **`alumnos/ficha.service.ts` suma `resumenDelAlumno(id, hoy, rol)`.** Usa `asistenciasDeAlumno` y `listarPagosDeAlumno`, que ya usa la actividad. No hay SQL nuevo en alumnos.
- **`asistenciasDeAlumno` pasa a devolver también `horaInicio`**: hace falta para "Suele venir" y no cambia la actividad. Las vencidas salen de `listarPagosDeAlumno`, que ya trae `clasesUsadas` y `vencido`.
- **Las cuentas son funciones puras** en `alumnos/resumen.ts`, que reciben las asistencias, los pagos y `hoy`. Se prueban sin base, como `pagos/estado-del-pack.ts`.
- **`ResumenDeAlumno` va en `packages/shared`.**
- **`Ventana` nueva en `components/ui`**: el contenedor ancho con encabezado propio y cierre con Escape. `Dialogo` queda para los formularios.
- **La web pide el resumen solo al abrir la pestaña Resumen**, con su propia consulta. Registrar o anular un pago la invalida.
- Nada se guarda: todo se calcula al pedirlo. No hay migración.

## Decisiones

Las propuso el agente y el estudio las confirmó el 2026-11-11.

1. Las vencidas van en el mes de la compra, no en el del vencimiento.
2. "Total pagado" lo ve solo el administrador.
3. "Por semana" y "Suele venir" miran las últimas 8 semanas; el estilo que más toma y el gráfico, los últimos 12 meses.
4. Hasta cuatro profesores.
5. El teléfono no lleva enlace a WhatsApp.
6. La ventana reemplaza al panel lateral también para Actividad, Datos y Pagos: no quedan dos formas de ver a un alumno.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Las cuentas del resumen: tomadas por mes, por semana, estilo, suele venir y profesores | Unitario puro | Si una clase anotada para la semana que viene cuenta como tomada, o un empate de estilos cambia entre pedidos |
| Las vencidas van en el mes de la compra y solo de pagos vencidos y no anulados | Unitario puro | Si un pack vigente con clases sin usar suma vencidas, el resumen dice que perdió clases que todavía puede tomar |
| Dos clases sueltas del mismo mes salen como una compra con `veces: 2` | Unitario puro | Si no se juntan, el mes muestra el mismo pack repetido |
| El resumen de un alumno con pagos y asistencias, completo, pedido por un administrador | Integración HTTP | Si el profesor es el titular en lugar del suplente, o el cobro se ubica en el mes UTC |
| Recepción recibe `totalPagado: null` | Integración HTTP | Si el total se calcula sin mirar el rol, recepción ve cuánto pagó cada alumno |
| El resumen de un alumno que no existe responde 404 | Integración HTTP | Si no se busca al alumno, responde un resumen vacío |
| La ficha se abre en una ventana con Resumen primero y muestra indicadores, profesores y el mes actual | Web | Si la pestaña inicial vuelve a ser Actividad o el mes elegido no es el actual |
| Tocar otro mes muestra sus compras y sus clases | Web | Si el detalle queda fijo en el mes actual |
| Recepción no ve "Total pagado" | Web | Si el indicador se dibuja con `null`, muestra "$0" |
| Escape y el clic afuera cierran la ventana y vuelven a `/alumnos` | Web | Si la ventana no cierra con el teclado, queda atrapado quien no usa el mouse |
| Con "Registrar pago" abierto, Escape y el clic en el fondo del diálogo no cierran la ventana; el clic dentro de la ventana tampoco | Web | Si el fondo de la ventana cierra con cualquier clic que le sube, cerrar un diálogo cierra también la ficha y se pierde lo que se estaba mirando |
| El encabezado dice "Alumna desde 10/03/2025" | Web | Si se pierde la fecha de alta del encabezado |
| Un alumno sin clases muestra "—" y "Todavía no tomó clases" | Web | Si se divide por cero o se dibuja `NaN` |

Los tests web de la ficha que ya existen cambian: hoy abren Actividad sin hacer clic y buscan el panel lateral.

## Casos que cuidar

No salen solos de las reglas y son los que más probablemente fallen. Cada uno tiene su test en la tarea que se indica.

- **Un `Dialogo` abierto dentro de la ventana** ("Registrar pago", "Editar alumno", "Anular"): cerrarlo con su fondo o con Escape no cierra la ventana (tarea 3).
- **El borde de los 56 días:** una clase de hace exactamente 56 días no cuenta en "Por semana" (tarea 1).
- **Alumno dado de alta hace menos de 12 meses, o sin nada:** igual salen 12 meses, vacíos, y ningún indicador muestra `NaN` (tareas 1 y 4).
- **El cobro cerca de la medianoche:** un pago de las 22:30 de Buenos Aires del último día del mes va en ese mes, no en el siguiente (tarea 2).
- **Un mes con dos compras distintas:** debajo de la barra va la primera y "+1" (tarea 5).

## Tareas

Los comandos de test: `pnpm --filter @studio/api test <ruta>` y `pnpm --filter @studio/web test <ruta>`. Los de la API necesitan Docker.

### Tarea 1: las cuentas del resumen

**Archivos:**
- Crear: `packages/shared/src/resumen-de-alumno.ts` (el tipo `ResumenDeAlumno` de "Qué devuelve la API", exportado desde el índice del paquete)
- Crear: `apps/api/src/modules/alumnos/resumen.ts`
- Crear: `apps/api/src/modules/alumnos/test/resumen.test.ts`

**Produce:**

```ts
export type ClaseParaResumen = { fecha: FechaDia; horaInicio: string; clase: string; profesor: PersonaResumen };
// Solo pagos no anulados. `dia` es el día del cobro en la zona del estudio.
export type PagoParaResumen = {
  dia: FechaDia; pack: string; cantidadClases: number; clasesUsadas: number; monto: number; vencido: boolean;
};
// `totalPagado` siempre viene calculado; el service lo pasa a null para recepción.
export function resumir(
  clases: ClaseParaResumen[], pagos: PagoParaResumen[], hoy: FechaDia,
): ResumenDeAlumno & { totalPagado: number };
```

Precisiones que el tipo no dice:

- "Últimos 56 días": `fecha > hoy − 56 días` y `fecha <= hoy`.
- "Últimos 12 meses": el mes de `hoy` y los 11 anteriores, desde el día 1 del más viejo.
- `sueleVenir`: entre las clases de los últimos 56 días, la `horaInicio` con más clases (ante un empate, la de la clase más reciente); de esa hora, hasta dos días de la semana con más clases, devueltos de lunes a domingo. `null` con menos de 2 clases en el período.
- `profesores` cuenta desde siempre, no solo 12 meses. Ante un empate de clases, primero quien dio la más reciente.
- `compras` va en el orden en que se compraron.
- Las fechas se operan con `lib/fechas.ts`. Nunca `new Date()` sin argumento.

- [x] **Paso 1: escribir el test** `resumen.test.ts`, con `HOY = '2026-03-10'` (martes) y estos datos:

```ts
const erik = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const julia = { id: 2, nombre: 'Julia', apellido: 'Paz' };
const clases: ClaseParaResumen[] = [
  { fecha: '2026-03-17', horaInicio: '19:00', clase: 'Jazz', profesor: erik },  // anotada, no pasó
  { fecha: '2026-03-10', horaInicio: '19:00', clase: 'Jazz', profesor: julia }, // hoy, martes
  { fecha: '2026-03-05', horaInicio: '19:00', clase: 'Jazz', profesor: erik },  // jueves
  { fecha: '2026-03-03', horaInicio: '19:00', clase: 'Jazz', profesor: erik },  // martes
  { fecha: '2026-02-26', horaInicio: '18:00', clase: 'Salsa', profesor: erik },
  { fecha: '2026-01-13', horaInicio: '19:00', clase: 'Salsa', profesor: erik }, // hace justo 56 días
  { fecha: '2025-03-20', horaInicio: '19:00', clase: 'Salsa', profesor: erik }, // fuera de los 12 meses
];
const pagos: PagoParaResumen[] = [
  { dia: '2026-01-10', pack: 'Pack x4', cantidadClases: 4, clasesUsadas: 1, monto: 5200, vencido: true },
  { dia: '2026-02-20', pack: 'Clase suelta', cantidadClases: 1, clasesUsadas: 1, monto: 1500, vencido: true },
  { dia: '2026-02-20', pack: 'Clase suelta', cantidadClases: 1, clasesUsadas: 1, monto: 1500, vencido: true },
  { dia: '2026-03-02', pack: 'Pack x8', cantidadClases: 8, clasesUsadas: 3, monto: 9600, vencido: false },
];
```

  Un test compara el resultado completo con `toEqual`:

```ts
const vacio = (mes: string) => ({ mes, compras: [], tomadas: 0, vencidas: 0, clases: [] });
expect(resumir(clases, pagos, HOY)).toEqual({
  clasesTomadas: 6,
  clasesEnOchoSemanas: 4,
  ultimaClase: '2026-03-10',
  hoy: HOY,
  estiloMasTomado: 'Jazz',
  sueleVenir: { diasSemana: [2, 4], horaInicio: '19:00' },
  vencidasSinUsar: 3,
  totalPagado: 17800,
  profesores: [
    { ...erik, estilo: 'Salsa', clases: 5 },
    { ...julia, estilo: 'Jazz', clases: 1 },
  ],
  meses: [
    ...['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'].map(vacio),
    { mes: '2026-01', compras: [{ pack: 'Pack x4', veces: 1 }], tomadas: 1, vencidas: 3,
      clases: [{ fecha: '2026-01-13', estilo: 'Salsa', profesor: erik }] },
    { mes: '2026-02', compras: [{ pack: 'Clase suelta', veces: 2 }], tomadas: 1, vencidas: 0,
      clases: [{ fecha: '2026-02-26', estilo: 'Salsa', profesor: erik }] },
    { mes: '2026-03', compras: [{ pack: 'Pack x8', veces: 1 }], tomadas: 3, vencidas: 0,
      clases: [
        { fecha: '2026-03-10', estilo: 'Jazz', profesor: julia },
        { fecha: '2026-03-05', estilo: 'Jazz', profesor: erik },
        { fecha: '2026-03-03', estilo: 'Jazz', profesor: erik },
      ] },
  ],
});
```

  Otros tres tests, cortos:
  - Sin clases ni pagos: `clasesTomadas: 0`, `clasesEnOchoSemanas: 0`, `ultimaClase: null`, `estiloMasTomado: null`, `sueleVenir: null`, `vencidasSinUsar: 0`, `totalPagado: 0`, `profesores: []` y 12 meses vacíos de `2025-04` a `2026-03`.
  - Empate de estilos: una clase de Jazz el `2026-03-03` y una de Salsa el `2026-03-05` dan `estiloMasTomado: 'Salsa'`.
  - Más de cuatro profesores: con cinco, vuelven los cuatro con más clases.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test src/modules/alumnos/test/resumen.test.ts` y ver que falla porque `resumir` no existe.
- [x] **Paso 3:** escribir el tipo en `packages/shared` y `resumir` en `resumen.ts`.
- [x] **Paso 4:** correr el test y ver que pasa. Correr `pnpm typecheck`.
- [x] **Paso 5:** commit `feat(alumnos): cuentas del resumen del alumno`.

### Tarea 2: `GET /api/alumnos/:id/resumen`

**Archivos:**
- Modificar: `apps/api/src/modules/asistencias/asistencias.repository.ts` (`listarDeAlumno` y `ClaseDeAlumno` suman `horaInicio`, en `HH:MM` como en `GET /api/clases`)
- Modificar: `apps/api/src/modules/alumnos/ficha.service.ts`, `alumnos.routes.ts`
- Modificar: `apps/api/src/modules/alumnos/test/alumnos.test.ts`

**Usa:** `resumir` de la tarea 1; `asistenciasDeAlumno(id)` y `listarPagosDeAlumno(id, hoy)`, que ya devuelve `anulado`, `vencido`, `clasesUsadas`, `cantidadClases`, `monto`, `fecha` y `pack.nombre`.

**Produce:** `resumenDelAlumno(id: number, hoy: FechaDia, rol: Rol): Promise<ResumenDeAlumno>` en `ficha.service.ts`. Busca al alumno con `buscarConAlta` (404 si no existe), descarta los pagos anulados, pasa `pago.fecha` a día con `diaDe` y pone `totalPagado: null` si el rol no es `admin`. La ruta le pasa `request.usuario!.rol`.

`actividadDelAlumno` no tiene que devolver `horaInicio`: el evento de la actividad no cambia. El test de la actividad que ya existe compara la respuesta completa y lo verifica.

- [x] **Paso 1: escribir los tests** en un `describe('GET /api/alumnos/:id/resumen')` de `alumnos.test.ts`, con las mismas fábricas que el test de la actividad:
  - *El resumen completo, pedido por un administrador.* Martina, alta el `2026-02-20`. Paga un Pack x4 ($5200) el `2026-02-20` y se anula. Paga un Pack x8 ($9600) con `new Date('2026-03-01T01:30:00Z')` y día `'2026-02-28'` (22:30 del 28 de febrero en Buenos Aires). Horario de Hip-Hop de Erik, martes 19:00. Asistencias el `2026-03-03`, hoy (`2026-03-10`, con Julia de suplente) y el `2026-03-17`. Se espera la respuesta completa con `toEqual`: `clasesTomadas: 2`, `clasesEnOchoSemanas: 2`, `ultimaClase: '2026-03-10'`, `hoy: '2026-03-10'`, `estiloMasTomado: 'Hip-Hop'`, `sueleVenir: { diasSemana: [2], horaInicio: '19:00' }`, `vencidasSinUsar: 0`, `totalPagado: 9600`, `profesores` con Julia y después Erik (una clase cada uno, primero la más reciente), y 12 meses donde `2026-02` tiene `compras: [{ pack: 'Pack x8', veces: 1 }]` y `tomadas: 0`, y `2026-03` tiene `compras: []`, `tomadas: 2` y sus dos clases.
  - *Recepción recibe `totalPagado: null`.* El mismo pedido con la cookie de recepción.
  - *404:* sumar `'/api/alumnos/999/resumen'` a la lista del test "la ficha y la actividad de un alumno que no existe responden 404".
- [x] **Paso 2:** correr `pnpm --filter @studio/api test src/modules/alumnos/test/alumnos.test.ts` y ver que los nuevos fallan con 404 de ruta.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr todos los tests de la API (`pnpm --filter @studio/api test`) y `pnpm typecheck`.
- [x] **Paso 5:** commit `feat(alumnos): resumen del alumno en la API`.

### Tarea 3: la ficha se abre en una ventana

**Archivos:**
- Modificar: `apps/web/src/components/ui/index.tsx` (componente `Ventana`)
- Modificar: `apps/web/src/features/alumnos/FichaAlumnoPage.tsx`
- Modificar: `apps/web/src/features/alumnos/test/ficha.test.tsx`, `e2e/flujo-principal.spec.ts` (línea 96: `getByRole('dialog', ...)`)

**Produce:**

```tsx
// Ventana ancha centrada sobre la página. `encabezado` va a la izquierda del botón de cerrar.
export function Ventana(props: { etiqueta: string; alCerrar: () => void; encabezado: ReactNode; children: ReactNode }): JSX.Element;
```

- `role="dialog"`, `aria-modal="true"`, `aria-label={etiqueta}`. Fondo `fixed inset-0 z-20 bg-black/60`, caja `max-w-5xl` con `max-h-full`, el encabezado fijo y el contenido con scroll propio. Las clases, como en `VarianteC` del prototipo.
- El fondo cierra solo si `evento.target === evento.currentTarget`: un `Dialogo` abierto adentro es hijo en React y su clic sube hasta acá.
- Escape cierra solo si la ventana es el único `[role="dialog"]` del documento.
- En `FichaAlumnoPage`, `Ventana` reemplaza a `PanelLateral` en los dos lugares. El encabezado lleva avatar, nombre, insignias (suma `Alumna desde {formatearFecha(alta)}`) y "Registrar pago". Las pestañas no cambian en esta tarea.
- `PanelLateral` se borra de `components/ui` si no lo usa nadie más (hoy solo la ficha).

- [x] **Paso 1: tests.** En `ficha.test.tsx`, los tests existentes buscan la ficha con `getByRole('dialog', { name: 'Ficha de Martina García' })`. Nuevos:
  - *Escape cierra la ventana y vuelve a `/alumnos`:* después de `usuario.keyboard('{Escape}')` no hay `dialog` y sigue la tabla del listado.
  - *Con "Registrar pago" abierto, Escape y el clic en el fondo del diálogo no cierran la ventana:* sigue en pantalla `dialog` "Ficha de Martina García".
  - *El encabezado muestra "Alumna desde 10/03/2025".*
- [x] **Paso 2:** correr `pnpm --filter @studio/web test src/features/alumnos/test/ficha.test.tsx` y ver que fallan por el rol `dialog`.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr todos los tests web y `pnpm typecheck`.
- [ ] **Paso 5:** commit `feat(alumnos): la ficha se abre en una ventana`.

### Tarea 4: pestaña Resumen con indicadores y profesores

**Archivos:**
- Crear: `apps/web/src/features/alumnos/ResumenDelAlumno.tsx`
- Modificar: `apps/web/src/features/alumnos/api.ts`, `FichaAlumnoPage.tsx`, `apps/web/src/lib/formato.ts`
- Modificar: `apps/web/test/datos.ts`, `apps/web/src/features/alumnos/test/ficha.test.tsx`
- Crear: `apps/web/src/features/alumnos/test/resumen.test.tsx`

**Produce:**
- `useResumenDeAlumno(id)`, con clave `['alumnos', id, 'resumen']` (así la invalidan registrar y anular un pago, que ya invalidan `['alumnos']`).
- `unResumenDeAlumno(datos?: Partial<ResumenDeAlumno>): ResumenDeAlumno` en `test/datos.ts`. Por defecto, el resultado del test de la tarea 1 con `totalPagado: 17800`.
- `haceCuanto(fecha: string, hoy: string): string` en `lib/formato.ts`: "Hoy", "Ayer", "Hace N días".
- `<ResumenDelAlumno datos={ficha} />`, que pide el resumen y dibuja la fila de arriba: Contacto y pack actual, Actividad, Toma clases con. La disposición es la de `VarianteC`.
- La pestaña `resumen` (`{ id: 'resumen', texto: 'Resumen', icono: 'progreso' }`) va primera y es la inicial.

Textos fijos: "Clases tomadas" con la nota "desde el alta"; "Por semana" con "últimas 8 semanas" y el valor con coma y un decimal (`4 / 8` es "0,5"); "Última clase"; "Estilo que más toma"; "Suele venir" ("Martes y jueves 19:00", con `nombreDelDia`); "Vencidas sin usar" con "últimos 12 meses"; "Total pagado". Un valor que falta se muestra "—". Sin profesores: "Todavía no tomó clases". "Total pagado" no se dibuja si es `null`.

- [ ] **Paso 1: tests.** En `resumen.test.tsx`, con el modelo de `ficha.test.tsx`:
  - *La ficha se abre en Resumen y muestra indicadores y profesores:* con `unResumenDeAlumno()`, se leen "6", "0,5", "Hoy", "Jazz", "Martes y jueves 19:00", "3", "$17.800" (con `formatearPesos`), y "Erik Zapata" con "Salsa · 5 clases".
  - *Recepción no ve "Total pagado":* con `totalPagado: null` no existe ese texto.
  - *Un alumno sin clases:* con el resumen vacío se ve "Todavía no tomó clases", "Por semana" dice "0" y no aparece `NaN`.

  En `ficha.test.tsx`, `fichaDeMartina` simula también `/api/alumnos/10/resumen` y los tests de Actividad hacen clic en la pestaña antes de buscar.
- [ ] **Paso 2:** correr los dos archivos y ver que fallan: MSW rechaza el pedido de actividad que ya no se hace al abrir, y los nuevos no encuentran la pestaña.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr todos los tests web y `pnpm typecheck`.
- [ ] **Paso 5:** commit `feat(alumnos): pestaña Resumen con indicadores y profesores`. Actualizar en CLAUDE.md la nota "Tests web de la ficha del alumno": la pestaña que se abre primero es Resumen y pide `/api/alumnos/:id/resumen`.

### Tarea 5: mes a mes

**Archivos:**
- Crear: `apps/web/src/features/alumnos/MesAMes.tsx`
- Modificar: `ResumenDelAlumno.tsx`, `test/resumen.test.tsx`

**Produce:** `<MesAMes meses={resumen.meses} />`: el gráfico a la izquierda y el mes elegido a la derecha, como `GraficoPorMes`, `ResumenDelMes` y `ClasesDelMes` del prototipo. El mes elegido es estado local y empieza en el último.

- Cada barra es un `button` con `aria-pressed` y nombre accesible "Marzo 2026: 3 clases tomadas".
- La altura es proporcional al mayor `tomadas + vencidas` de los 12 meses. Si es 0, todas las barras miden el mínimo.
- Debajo de la barra: el mes en tres letras y la primera compra (`veces > 1` se escribe "2 × Clase suelta"); con más de una compra distinta, "+1"; sin compras, "—".
- El detalle: título con `formatearMes`, una insignia violeta por compra, "N clases tomadas" (singular con 1), insignia ámbar "N sin usar" si hay vencidas, y la tabla Día / Clase / Profesor. Sin clases: "No tomó clases este mes."

- [ ] **Paso 1: tests** en `resumen.test.tsx`:
  - *Se abre con el mes actual:* el detalle dice "Marzo 2026", "Pack x8", "3 clases tomadas" y tiene tres filas; la primera es `['10/03', 'Jazz', 'Julia Paz']` (con `celdasDe`).
  - *Tocar otro mes muestra sus compras y sus clases:* clic en el botón "Enero 2026: 1 clase tomada"; el detalle pasa a "Enero 2026", "Pack x4", "1 clase tomada", "3 sin usar".
  - *Un mes con dos compras distintas:* con `compras: [{ pack: 'Pack x8', veces: 1 }, { pack: 'Clase suelta', veces: 1 }]`, la barra muestra "Pack x8" y "+1", y el detalle las dos insignias.
  - *Un mes sin nada:* clic en "Abril 2025: 0 clases tomadas" muestra "No tomó clases este mes.".
- [ ] **Paso 2:** correr y ver que fallan porque no existe el botón del mes.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr todos los tests web y `pnpm typecheck`.
- [ ] **Paso 5:** commit `feat(alumnos): compras y clases mes a mes en el resumen`.

### Tarea 6: cierre

- [ ] `pnpm test`, `pnpm typecheck` y `pnpm e2e`.
- [ ] Mirar en Chromium a 1280 y 1024 px (ver "Verificación final"). A 1024 px las tres columnas de arriba tienen que seguir entrando o pasar a una debajo de otra; anotar en la bitácora lo que quede afuera.
- [ ] Actualizar `docs/arquitectura frontend.md` si nombra el panel lateral de la ficha.
- [ ] Pasar la feature a `lista` en el índice y sumar la línea de la bitácora.

## Verificación final

- `pnpm test`, `pnpm typecheck` y `pnpm e2e`.
- En Chromium, a 1280 y 1024 px, con la base del e2e: abrir un alumno con pagos y asistencias de varios meses, cambiar de mes, entrar como recepción y comprobar que no aparece "Total pagado".
