# Rediseño de la interfaz

**Estado:** en curso  
**Depende de:** e2e-y-produccion  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; la app tiene barra lateral, el contenido va en una tarjeta, las tablas son densas, la ficha del alumno se abre en un panel al costado de la lista y la agenda del día es una tabla.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Referencia:** la variante A en oscuro de la maqueta que se armó a partir de [Twenty CRM](https://github.com/twentyhq/twenty). No se copia código de Twenty, solo el aspecto.

## Qué cambia

- **Colores como variables de Tailwind** en `index.css` (`@theme`): `fondo`, `panel`, `elevado`, `resalte`, `borde`, `borde-fuerte`, `texto`, `tenue`, `apagado`, `acento` y `acento-fondo`. Se usan como clases: `bg-panel`, `text-tenue`, `border-borde`. Solo hay tema oscuro.
- **Fuente Inter**, empaquetada con `@fontsource-variable/inter`: la app no le pide nada a Google. `text-sm` pasa a 13px, como en Twenty.
- **Barra lateral**: nombre del sistema, sección Recepción (Agenda, Alumnos), sección Administración (solo admin) y, abajo, el usuario con el botón de cerrar sesión. El contenido va en una tarjeta con borde.
- **`Pagina` reemplaza a `Titulo`**: barra superior con el título y las acciones, una barra opcional debajo para búsqueda y filtros, y el contenido con scroll propio.
- **Tablas densas**: filas de 32px y bordes finos entre celdas.
- **Alumnos**: el nombre es un chip con la inicial. La ficha se abre en un panel a la derecha. `/alumnos/:id` pasa a ser ruta hija de `/alumnos`, así la lista y la búsqueda siguen montadas.
- **Agenda**: una tabla con horario, clase, nivel, profesor, asistentes, estado y acción, en lugar de tarjetas.

## Qué quedó afuera de la maqueta

- **Buscador global con Ctrl K**: no existe en la app. Sería una feature aparte.
- **Configuración, Filtro, Orden, Opciones, selector de vistas, columna "+", menús "⋯", flechas y "abrir como página" del panel**: en la maqueta no hacían nada y en la app no tienen qué hacer.
- **Casillas de selección en las tablas y menú desplegable del nombre del estudio**: se sacaron a pedido.
- **Íconos en los encabezados de columna y en los títulos**: son decoración. Quedan los del menú, que ayudan a encontrar la pantalla.
- **Pestañas en el panel del alumno**: con datos y pagos alcanza mostrar todo junto. La pestaña Actividad necesita las asistencias del alumno, que la API no devuelve.
- **Columnas de pack, estado del pack, clases restantes, vencimiento y última clase en el listado de alumnos**: `GET /api/alumnos` no devuelve pagos. Hace falta una feature de backend.
- **Modo claro.**

## Decisiones

- **Íconos copiados, no importados**: los trazos SVG de [Tabler Icons](https://tabler.io/icons) (MIT, los mismos que usa Twenty) viven en `components/ui/Icono.tsx`. El paquete `@tabler/icons-react` importa miles de archivos desde su índice y vuelve lentos los tests de Vitest.
- **Acento azul** (`#4a86f7`), como en la maqueta aprobada.
- **Estados de la clase del día**: sin sesión es "Sin abrir", `programada` es "Abierta" y `cancelada` es "Cancelada". `dictada` existe en el esquema, pero la API todavía no la asigna.
- **El panel del alumno se cierra con un botón que navega a `/alumnos`**. No se cierra con Escape: los diálogos que se abren encima (registrar pago, anular) tendrían que ganarle al panel, y hoy los diálogos no manejan Escape.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Abrir un alumno muestra su ficha al costado sin perder la búsqueda, y cerrarla vuelve a la lista | Web | Si la ficha vuelve a ser una pantalla aparte, recepción pierde la búsqueda cada vez que mira un alumno |
| La agenda muestra cada clase en una fila con el profesor que la da, los asistentes y el estado | Web (reemplaza al de tarjetas) | Si la fila muestra al titular en lugar del suplente, o "Sin abrir" en una clase abierta, recepción lee mal el día |
| "Tomar asistencia" en la fila abre la sesión de esa clase y esa fecha | Web (adaptado) | Si el botón queda en otra fila, se abre la clase equivocada |
| Recorrido de punta a punta | E2E (adaptado) | Si el panel o la tabla nueva tapan un paso del flujo real, recepción no puede cobrar ni tomar asistencia |

Los cambios puramente visuales (colores, fuente, barra lateral, tablas) no tienen test propio: no cambian lo que el usuario puede hacer. Los cubre la suite existente, que sigue buscando por rol y por texto, y la revisión con capturas de la verificación final.

---

### Tarea 1: Colores, fuente, íconos y componentes base

**Archivos:**
- Modificar: `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/components/ui/index.tsx`
- Crear: `apps/web/src/components/ui/Icono.tsx`

- [x] **Paso 1:** instalar `@fontsource-variable/inter` e importarlo en `main.tsx`.
- [x] **Paso 2:** definir los colores y la fuente en `index.css`.
- [x] **Paso 3:** rehacer `Boton`, las entradas, `Tabla`, `Celda`, `Insignia`, `Aviso` y `Dialogo` con los colores nuevos; agregar `Icono`, `Avatar`, `Pagina` y `PanelLateral`. Se sumaron `BotonIcono` (botón con solo un ícono y `aria-label`), `Casilla` (la casilla "Mostrar dados de baja" se repetía en cuatro pantallas) y `CeldaDeAcciones`: un `<td>` con `display: flex` pierde el comportamiento de celda y descuadra los bordes nuevos.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): colores, fuente y componentes con el estilo nuevo`.

### Tarea 2: Barra lateral y páginas con `Pagina`

**Archivos:**
- Modificar: `apps/web/src/components/Layout.tsx`, `apps/web/src/features/auth/RequiereSesion.tsx`, `LoginPage.tsx` y todas las páginas que usan `Titulo`
- Modificar: `e2e/flujo-principal.spec.ts` (el título de la agenda pasa a ser "Agenda")

- [x] **Paso 1:** rehacer `Layout` con la barra lateral y la tarjeta de contenido.
- [x] **Paso 2:** pasar cada página a `Pagina` y borrar `Titulo`. Reemplazar los colores `stone`, `violet` y `amber` sueltos por los nuevos.
- [x] **Paso 3:** correr `pnpm --filter @studio/web test`, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 4:** commit `feat(web): barra lateral y encabezado de página`.

Cambios al plan:
- `Pagina` acepta `volverA` para la miga "Agenda /" de la sesión y "Alumnos /" de la ficha. El e2e ahora navega por el menú lateral (`irA`), porque la miga también es un link llamado "Alumnos".
- `NOMBRES_ROL` pasó a `lib/formato.ts`: lo usan el menú y la pantalla de usuarios.
- Las fechas largas usaban `capitalize`, que pone en mayúscula cada palabra ("Martes 29 De Septiembre"). Ahora es `first-letter:uppercase`.
- Las celdas no parten el texto: en el celular la tabla se desplaza de costado.

### Tarea 3: Ficha del alumno en un panel lateral

**Archivos:**
- Modificar: `apps/web/src/rutas.tsx`, `apps/web/src/features/alumnos/AlumnosPage.tsx`, `FichaAlumnoPage.tsx`
- Test: `apps/web/src/features/alumnos/alumnos.test.tsx`, `ficha.test.tsx` (la ficha ahora también carga la lista)

- [x] **Paso 1:** escribir el test del panel.
- [x] **Paso 2:** correrlo y verificar que falla porque no hay panel.
- [x] **Paso 3:** implementar: ruta hija, `Outlet` en la lista, fila marcada y ficha dentro de `PanelLateral`. Agregar el listado a los handlers de `ficha.test.tsx`.
- [x] **Paso 4:** correr los tests web, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): ficha del alumno en un panel al costado de la lista`.

Cambio al plan: la ficha se separó en `FichaAlumnoPage` (carga y panel) y `Ficha` (contenido) con `key` por alumno, para que el diálogo de edición no quede abierto al pasar de un alumno a otro con el panel abierto.

### Tarea 4: Agenda del día en una tabla

**Archivos:**
- Modificar: `apps/web/src/features/agenda/AgendaPage.tsx`, `e2e/flujo-principal.spec.ts`
- Test: `apps/web/src/features/agenda/agenda.test.tsx`

- [ ] **Paso 1:** cambiar los tests de la agenda para que busquen filas en lugar de tarjetas, y agregar la columna de estado.
- [ ] **Paso 2:** correrlos y verificar que fallan porque no hay filas.
- [ ] **Paso 3:** implementar la tabla y adaptar el paso de asistencia del e2e.
- [ ] **Paso 4:** correr los tests web, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(web): agenda del día en una tabla`.

## Verificación final

- [ ] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan.
- [ ] Con `pnpm dev` y la API real, capturas de agenda, alumnos con el panel abierto, sesión, liquidaciones y login: nada se corta ni queda con los colores viejos.
