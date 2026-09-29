# Clases anotadas en la actividad

**Estado:** en curso  
**Depende de:** ficha-del-alumno  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; en la actividad de la ficha, una clase anotada para más adelante aparece como "Anotado en..." con el día de la clase.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Qué cambia

En la [ficha del alumno](ficha-del-alumno.md), una asistencia registrada para una fecha futura no aparecía en la actividad hasta ese día, aunque ya descontaba una clase del pack. Se pidió que aparezca como anotada.

- `GET /api/alumnos/:id/actividad` devuelve todas las asistencias. Las de un día posterior a hoy vienen como `{ tipo: 'anotado', fecha, clase, profesor }`; las de hoy o antes siguen siendo `asistencia`.
- La pantalla las muestra como "Anotado en **Hip-Hop** con Julia Paz", con un ícono de calendario. Van arriba de todo, porque son lo más nuevo.

Decisión: una clase de hoy cuenta como asistida, igual que la última clase del listado. La API no mira la hora de la clase.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| La actividad trae las clases futuras como anotadas, antes que el resto | Integración HTTP (cambia el de la ficha) | Si una clase futura vuelve a esconderse, el pack descuenta una clase que la ficha no explica |
| La actividad muestra "Anotado en" para una clase futura | Web (cambia el de la ficha) | Si se muestra como "Asistió", la ficha dice que fue a una clase que todavía no pasó |

---

### Tarea 1: La API devuelve las clases anotadas

**Archivos:**
- Modificar: `packages/shared/src/alumnos.ts`, `apps/api/src/modules/asistencias/asistencias.repository.ts`, `asistencias.service.ts`, `apps/api/src/modules/alumnos/ficha.service.ts`
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`

- [ ] **Paso 1:** cambiar el test de la actividad: la clase del martes que viene aparece como anotada.
- [ ] **Paso 2:** correrlo y verificar que falla porque la clase no aparece.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(alumnos): clases anotadas en la actividad`.

### Tarea 2: La ficha muestra las clases anotadas

**Archivos:**
- Modificar: `apps/web/src/features/alumnos/FichaAlumnoPage.tsx`
- Test: `apps/web/src/features/alumnos/ficha.test.tsx`

- [ ] **Paso 1:** sumar una clase anotada al test de la actividad.
- [ ] **Paso 2:** correrlo y verificar que falla porque el tipo nuevo no se muestra.
- [ ] **Paso 3:** implementar el texto y el ícono.
- [ ] **Paso 4:** correr los tests web y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(web): clases anotadas en la actividad de la ficha`.

## Verificación final

- [ ] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan.
