# Agenda del día y asistencias

**Estado:** en curso  
**Depende de:** frontend-alumnos, asistencias  
**Listo cuando:** `pnpm test` pasa; recepción ve las clases del día, abre una clase, anota alumnos (y cobra una clase suelta en el acto si hace falta), borra una asistencia y registra una suplencia.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Spec:** [Arquitectura del frontend](../arquitectura%20frontend.md); API en [clases y sesiones](clases-y-sesiones.md) y [asistencias](asistencias.md).

## Pantallas

**`/agenda?fecha=AAAA-MM-DD`** (sin `fecha`, la API usa hoy)
- Día anterior, día siguiente y "Hoy". La fecha va en la URL para poder volver o compartirla.
- Una tarjeta por clase: horario, estilo, nivel, profesor (el de la sesión si ya se abrió), estado y cantidad de asistentes.
- "Tomar asistencia" abre la sesión (la crea si no existe) y lleva a su pantalla.

**`/sesiones/:id`**
- Clase, fecha, profesor y asistentes.
- Buscador de alumnos para anotar: muestra hasta 5 coincidencias mientras se escribe.
- Si la API responde que el alumno no tiene clases disponibles, aparece "Cobrar y anotar" con el pack (clase suelta por defecto) y el medio de pago.
- "Quitar" en cada asistencia.
- Selector de profesor para registrar una suplencia.
- "Cancelar clase".

## Cambios en la API

- **`GET /api/sesiones/:id`** (recepción): la sesión con los datos de su clase (`estilo`, `nivel`, `horaInicio`, `horaFin`).
- **Código de error:** `ReglaDeNegocioError` acepta un `codigo` opcional que la respuesta incluye como `{ error, codigo }`. Registrar una asistencia sin clases disponibles responde `codigo: 'SIN_CLASES_DISPONIBLES'`. El frontend decide con el código, no comparando el texto del mensaje.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| `GET /api/sesiones/:id` devuelve la sesión con su clase | API | Si falta el join con la clase, la pantalla no puede mostrar qué clase es |
| Sin clases disponibles, la respuesta trae `codigo: 'SIN_CLASES_DISPONIBLES'` | API | Si se pierde el código, el frontend no ofrece cobrar y recepción no puede anotar al alumno |
| La agenda muestra las clases del día con profesor, estado y asistentes | Web | Si se muestra el titular en lugar del suplente, o no se distingue una clase cancelada |
| "Tomar asistencia" abre la sesión con clase y fecha, y lleva a su pantalla | Web | Si se manda la fecha de hoy en lugar de la de la agenda, se abre la sesión del día equivocado |
| Anotar un alumno buscado manda su id y lo muestra en la lista | Web | Si la sugerencia no manda el id correcto o no se recarga la lista |
| Sin clases disponibles ofrece cobrar, y "Cobrar y anotar" manda pack y medio | Web | Si el frontend no reconoce el código, recepción queda trabada con un error |
| Quitar una asistencia llama a la API y la saca de la lista | Web | Si no se recarga, la clase parece seguir consumida |
| Una suplencia manda el profesor nuevo | Web | Si se manda el titular o no se recarga, la liquidación queda a nombre del profesor equivocado |

---

### Tarea 1: Cambios en la API

**Archivos:**
- Modificar: `apps/api/src/lib/errores.ts`, `apps/api/src/plugins/errores.ts`
- Modificar: `apps/api/src/modules/asistencias/asistencias.service.ts`
- Modificar: `apps/api/src/modules/clases/sesiones.repository.ts`, `sesiones.service.ts`, `sesiones.routes.ts`
- Modificar: `packages/shared/src/clases.ts` — `type SesionDetalle`.
- Test: `apps/api/src/modules/clases/sesiones.test.ts`, `apps/api/src/modules/asistencias/asistencias.test.ts`

- [x] **Paso 1:** escribir los 2 tests de la API.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr la suite de la API y verificar que pasa.
- [x] **Paso 5:** commit `feat(api): detalle de sesión y código de error sin clases disponibles`.

### Tarea 2: Agenda del día

**Archivos:**
- Crear: `apps/web/src/features/agenda/api.ts`, `AgendaPage.tsx`
- Test: `apps/web/src/features/agenda/agenda.test.tsx`

- [x] **Paso 1:** escribir los 2 tests de la agenda.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): agenda del día`.

### Tarea 3: Pantalla de la sesión

**Archivos:**
- Crear: `apps/web/src/features/agenda/SesionPage.tsx`, `AnotarAlumno.tsx`
- Crear: `apps/web/src/features/profesores/api.ts`
- Test: `apps/web/src/features/agenda/sesion.test.tsx`

- [ ] **Paso 1:** escribir los 4 tests de la sesión.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(web): tomar asistencia, cobrar en el acto y suplencias`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
