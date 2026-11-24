# Menú lateral en el teléfono

**Estado:** lista  
**Depende de:** rediseno-de-la-interfaz  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; en una pantalla angosta el menú queda oculto detrás de un botón en una barra superior y se abre como panel lateral con todas las pantallas.

## Para qué

En el teléfono el menú se mostraba arriba del contenido, con las opciones repartidas en tres filas y sin los títulos de sección. Ocupaba casi un cuarto de la pantalla en cada vista y el contenido quedaba abajo.

## Pantalla

Por debajo de `md` (768px):

- Una barra superior de 48px con el botón "Abrir menú" (ícono `menu`, trazo `menu-2` de Tabler) y la marca.
- El botón abre el menú desde la izquierda: 288px de ancho, como máximo el 85% de la pantalla, con un fondo oscuro detrás.
- El menú muestra las dos secciones con sus títulos, opciones de 40px de alto para el dedo, y abajo el usuario con "Cerrar sesión".
- Se cierra al elegir una pantalla, con el botón "Cerrar menú", con Escape o tocando el fondo. Al cerrar, el foco vuelve al botón de la barra.
- Cerrado, el menú lleva `invisible`: no se puede enfocar ni lo lee un lector de pantalla.

Desde `md` no cambia nada: el menú queda fijo a la izquierda como antes. El menú y la barra lateral son el mismo `aside`; las clases `md:` lo devuelven a su lugar.

La altura de la app pasa de `h-screen` a `h-dvh`, para que la barra del navegador del teléfono no tape el final del contenido.

## Tests

| Test | Qué lo rompe |
|---|---|
| `layout.test.tsx`: el botón de la barra superior abre el menú | Que el botón no cambie `aria-expanded` o que el foco no pase al botón de cerrar |
| `layout.test.tsx`: elegir una pantalla, el botón de cerrar y Escape cierran el menú | Que alguna de las tres formas de cerrar deje el menú abierto o pierda el foco |

El toque en el fondo y lo que se ve en cada ancho no se prueban en jsdom (no evalúa media queries). Se miraron con capturas de Playwright en un Pixel 7 y en 1280x720.

## Tareas

- [x] Test del botón que abre el menú y de las tres formas de cerrarlo.
- [x] Barra superior, menú deslizable y fondo en `Layout.tsx`; ícono `menu`; `BotonIcono` acepta `ref`.
- [x] Capturas en teléfono (cerrado y abierto) y en escritorio.

## Verificación

`pnpm --filter @studio/web test` (266 tests) y `pnpm typecheck` pasan.
