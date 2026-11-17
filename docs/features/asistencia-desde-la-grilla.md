# Asistencia desde la grilla

**Estado:** lista  
**Depende de:** grilla-para-recepcion  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; en `/grilla`, recepción toca una clase y llega a `/clases/:id`, la pantalla de su asistencia.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Qué cambia

Pedido del estudio (2026-11-17), después de la [grilla para recepción](grilla-para-recepcion.md): en la grilla de recepción, tocar una clase abre su asistencia, como en la Agenda.

- **Recepción:** en Día y Semana, cada clase es un enlace (`<Link>` de react-router) a `/clases/:id`, con el mismo `aria-label` de hoy (`nombreDeLaClase`). Vale para clases pasadas, de hoy, futuras y canceladas: la pantalla de la clase ya resuelve cada caso.
- **Administración:** no cambia. Tocar una clase sigue abriendo su editor.
- **Semana incrustada del asistente:** no cambia. Sus clases son propuestas con id negativo y no tienen pantalla.
- **`VistaDeSemana`:** suma una prop opcional `enlaceDeClase?: (clase: Clase) => string`. Si está y no hay `interacciones`, `ClaseEnLaGrilla` se dibuja como enlace. `GrillaPage` se la pasa solo cuando el usuario no es admin.
- **Vista Mes:** no cambia. Tocar un día sigue llevando a la vista Día, y ahí se toca la clase.

La API no cambia: `GET /api/clases/:id` ya es de recepción.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Para recepción, cada clase de la semana es un enlace con su nombre a `/clases/:id`, incluida la de un día pasado; tocar una lleva a esa dirección | Web (`grilla-recepcion.test.tsx`) | No pasarle `enlaceDeClase` a `VistaDeSemana`, armar mal la dirección, o dejar sin enlace las clases pasadas |
| El test existente "apretar un hueco... y apretar una clase no abre su editor" sigue pasando, con la clase buscada como enlace | Web (`grilla-recepcion.test.tsx`, se ajusta) | Abrir el editor para recepción además del enlace |
| La semana incrustada sigue sin botones ni enlaces | Web (`semana-incrustada.test.tsx`, suma `queryAllByRole('link')`) | Dibujar enlaces en la grilla del asistente |

Los tests de administración (`grilla-edicion.test.tsx`) siguen pasando sin cambios.

---

### Tarea 1: La clase de la grilla de recepción abre su asistencia

**Archivos:**
- Modificar: `apps/web/src/features/grilla/VistaDeSemana.tsx`, `apps/web/src/features/grilla/GrillaPage.tsx`
- Test: `apps/web/src/features/grilla/test/grilla-recepcion.test.tsx`, `apps/web/src/features/grilla/test/semana-incrustada.test.tsx`

- [x] **Paso 1:** escribir y ajustar los tests de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan porque no hay enlaces a las clases.
- [x] **Paso 3:** sumar `enlaceDeClase` a `VistaDeSemana`, dibujar la clase como enlace cuando corresponde y pasársela desde `GrillaPage` a recepción.
- [x] **Paso 4:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(grilla): recepción abre la asistencia de una clase desde la grilla`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan: shared 29, API 234, web 204.
