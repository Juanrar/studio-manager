# Frontend y tests web

Trampas del frontend y de sus tests. Los tests web no necesitan Docker. Lo que jsdom no puede verificar (diseño, media queries, arrastre real) se prueba en Chromium: ver `e2e.md`.

## Base de los tests

- `apps/web/test/render.tsx` renderiza la app completa en una ruta con `renderizarEn()`, y `conSesion()` simula `GET /api/auth/yo`.
- MSW falla si llega un pedido que el test no previó.
- Un test que pasa por `/agenda` sin probar la agenda llama a `conAgendaVacia()`, si no la agenda hace un pedido que MSW no esperaba.
- jsdom no calcula el diseño ni evalúa media queries como `pointer-coarse`.
- jsdom descarta un estilo inválido (`height: NaNpx`): un test que busca `NaN` en el HTML no lo ve. Afirmá el valor del estilo.

## Menú

En el teléfono el menú está cerrado detrás del botón "Abrir menú" y lleva `invisible`. jsdom no aplica las clases de Tailwind, así que un test encuentra los links de `navigation` "Menú" sin abrirlo. El e2e corre en escritorio, donde el menú está siempre a la vista.

## Tablas y listados

`celdasDe(fila)` de `apps/web/test/tabla.ts` devuelve el texto de cada celda sin lo que es `aria-hidden` (la inicial del avatar). El listado de alumnos se simula con `unListadoDeAlumnos` y `unAlumnoEnListado` de `test/datos.ts`.

## Ficha del alumno

- La ficha pide `/api/alumnos/:id` (se simula con `unaFichaDeAlumno`) y `/api/alumnos/:id/resumen` (`unResumenDeAlumno`), porque Resumen es la pestaña que se abre primero.
- `/api/alumnos/:id/actividad` solo se pide al hacer clic en Actividad.
- La tabla de pagos está en la pestaña Pagos: hacé clic en ella antes de buscar filas.
- `Ventana` de `components/ui` es su contenedor: `role="dialog"`, tapa toda la pantalla (también el menú lateral) y cierra con el botón, Escape o un clic que empieza y termina en el fondo. Un `Dialogo` abierto adentro no la cierra. En un test se busca con `getByRole('dialog', { name: 'Ficha de ...' })`, y el e2e tiene que cerrarla antes de ir a otra pantalla.

## Grilla y agenda

Las dos deciden qué es hoy con el reloj del navegador, así que los tests fijan el reloj y lo sueltan en `afterEach`.

- **Grilla:** `vi.useFakeTimers({ toFake: ['Date'] })` y `vi.setSystemTime(...)`. Para tocar un hueco se simula `getBoundingClientRect` del contenedor de las columnas (el padre de cada `group` de día) y se usa `usuario.pointer` con coordenadas. El arrastre real se prueba en el e2e.
- **Agenda:** además se renueva cada minuto con `useAhora` (`setInterval`). Usá `vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })` y avanzá con `act(() => vi.advanceTimersByTime(60_000))`. Para que el día que se mira no sea hoy, el reloj va en otro día.

## SelectorDeHora

El campo es un combobox (`getByRole('combobox', { name: 'Empieza' })`) y la lista se abre en un portal sobre `document.body`: `screen` la encuentra y `within(fila)` no.

## Listas que se reemplazan enteras

Una lista que se reemplaza entera (las clases del mes en el resumen) no lleva una clave que se pueda repetir, como la fecha: con dos filas de la misma clave React deja una fila vieja al cambiar los datos. Se le pone `key` al contenedor para que se remonte.

## Fallas sueltas de la grilla con la máquina cargada

El 2026-11-23, un `pnpm test` corrido apenas se prendió Docker Desktop dio 2 fallas en `apps/web`: un test de `grilla-edicion.test.tsx` (el archivo tardó 8 s) y uno de `grilla-vistas.test.tsx` (4,6 s). Los dos archivos solos pasaron, la suite web sola pasó, y un segundo `pnpm test` completo pasó entero. No se guardó el mensaje porque la salida iba filtrada con `grep`. Si vuelve a pasar, se guarda la salida completa (`pnpm test > salida.txt 2>&1`) y se mira si es un `findBy` que vence a los 1000 ms o el `testTimeout` de 5 s. No se agregan esperas ni reintentos mientras no se sepa la causa.
