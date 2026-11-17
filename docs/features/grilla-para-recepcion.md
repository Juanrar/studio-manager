# Grilla para recepción

**Estado:** lista  
**Depende de:** navegacion-de-la-grilla  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; recepción entra a `/grilla`, ve las clases en Día, Semana y Mes, y no puede crear, mover, estirar ni editar ninguna.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Qué cambia

Pedido del estudio (2026-11-17): recepción también ve la grilla, pero no cambia ni crea clases. Administración la sigue usando como hoy.

- **Ruta:** `/grilla` sale de `SoloAdmin` en `rutas.tsx`.
- **Menú:** "Grilla" pasa a la sección Recepción de `Layout.tsx`, después de Agenda. Administración ve las dos secciones, así que la encuentra ahí.
- **Pantalla:** si el usuario de `useSesion()` no es admin, `GrillaPage` dibuja `VistaDeSemana` sin `interacciones`. Las clases no son botones (igual que en la semana incrustada del asistente), apretar un hueco no abre "Nueva clase" y no hay arrastre ni estirado. La navegación (Día, Semana, Mes, flechas, "Volver", tocar un día en Mes) funciona igual.
- **`VistaDeSemana`:** hoy "sin `interacciones`" implica "incrustada". Las dos props pasan a ser opcionales e independientes: sin `interacciones` es solo lectura; sin `incrustada` es la grilla completa, con la línea de "ahora".

La API no cambia. `GET /api/clases` ya es de recepción; `POST` y `DELETE /api/clases` y `POST`/`PATCH /api/horarios` ya responden 403 a recepción, y `PATCH /api/clases` le prohíbe mover o cambiar hora y estilo (tests en `clases.test.ts`). Recepción sigue pudiendo poner un suplente o cancelar desde la ficha de la clase, como antes.

Queda afuera: que tocar una clase en la grilla de recepción abra su asistencia (`/clases/:id`).

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Recepción entra a `/grilla`, ve "Grilla" en el menú y las clases de la semana por su nombre, sin ningún botón de clase | Web (`grilla-recepcion.test.tsx`) | Dejar `/grilla` dentro de `SoloAdmin`, sacar "Grilla" del menú de recepción o dibujar las clases como botones |
| Para recepción, apretar un hueco de un día futuro no abre "Nueva clase" y apretar una clase no abre su editor | Web (`grilla-recepcion.test.tsx`) | Pasarle `interacciones` a `VistaDeSemana` sin mirar el rol |
| Recepción pasa de semana con las flechas y va a la vista Mes | Web (`grilla-recepcion.test.tsx`) | Esconder la barra de navegación junto con la edición |

Los tests de administración que ya existen (`grilla.test.tsx`, `grilla-edicion.test.tsx`, `grilla-vistas.test.tsx`) siguen pasando sin cambios: prueban que admin edita igual que antes.

---

### Tarea 1: Grilla en solo lectura para recepción

**Archivos:**
- Modificar: `apps/web/src/rutas.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/features/grilla/GrillaPage.tsx`, `apps/web/src/features/grilla/VistaDeSemana.tsx`
- Test: `apps/web/src/features/grilla/test/grilla-recepcion.test.tsx`

- [x] **Paso 1:** escribir los tres tests de la tabla con `conSesion(RECEPCION)`, siguiendo `grilla.test.tsx`.
- [x] **Paso 2:** correrlos y verificar que fallan porque recepción ve "No tenés permiso para ver esta pantalla".
- [x] **Paso 3:** sacar `/grilla` de `SoloAdmin`, mover "Grilla" a la sección Recepción, separar `interacciones` de `incrustada` en `VistaDeSemana` y no pasarle `interacciones` cuando el usuario no es admin.
- [x] **Paso 4:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(grilla): recepción ve la grilla sin poder editarla`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan: shared 29, API 234, web 203.
