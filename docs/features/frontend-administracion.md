# Pantallas de administración

**Estado:** en curso  
**Depende de:** frontend-base, packs, profesores, clases-y-sesiones, autenticacion  
**Listo cuando:** `pnpm test` pasa; admin gestiona packs, profesores con su historial de porcentajes, el horario semanal y los usuarios.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Spec:** [Arquitectura del frontend](../arquitectura%20frontend.md); API en [packs](packs.md), [profesores](profesores.md), [clases y sesiones](clases-y-sesiones.md) y [autenticación](autenticacion.md).

## Pantallas

Todas son solo para admin y siguen el mismo patrón: tabla, "Nuevo…" en un diálogo, "Editar" en cada fila, y dar de baja o reactivar en lugar de borrar.

- **`/packs`**: nombre, clases, precio y estado.
- **`/profesores`**: nombre, alias o CBU, teléfono, porcentaje vigente y estado. En cada profesor, "Porcentajes" abre el historial y permite cargar uno nuevo con su fecha de vigencia.
- **`/clases`**: el horario agrupado por día de la semana, con estilo, nivel, horario y profesor titular.
- **`/usuarios`**: nombre, email, rol y estado. Al editar se puede cambiar el rol, activar o desactivar y poner una contraseña nueva.

## Decisiones

- **El porcentaje se escribe como porcentaje** ("52,5") y se manda en puntos básicos (5250). La conversión está en `lib/formato.ts`.
- **El precio se escribe en pesos enteros.** Un precio con centavos muestra el error del esquema compartido y no llama a la API.
- **El día de la clase se elige por nombre** y se manda como número ISO (lunes 1, domingo 7), igual que la API.

## Tests

| Test | Por qué vale la pena: qué cambio lo rompe |
|---|---|
| Crear un pack manda cantidad y precio como números | Si el formulario manda texto, la API responde 400 y no se puede crear nada |
| Un precio con centavos muestra el error y no llama a la API | Si se saca la validación del esquema compartido, el error llega de la API, lejos del campo |
| Crear un profesor con "52,5" manda 5250 puntos básicos | Si se manda 52,5 o 525, el profesor cobra 100 veces menos o 10 veces menos |
| Cargar un porcentaje nuevo manda puntos básicos y la fecha de vigencia | Mismo riesgo de conversión, en el historial |
| Crear una clase del martes manda `diaSemana: 2` y las horas en `HH:MM` | Si el día se manda 0-based, la clase aparece el lunes en la agenda |
| Crear un usuario manda el rol elegido | Si el rol no se manda, la API rechaza y admin no puede dar de alta a recepción |

---

### Tarea 1: Packs

**Archivos:** `apps/web/src/features/packs/PacksPage.tsx`, `api.ts`; test `packs.test.tsx`.

- [x] **Paso 1:** escribir los 2 tests de packs.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): administración de packs`.

### Tarea 2: Profesores y porcentajes

**Archivos:** `apps/web/src/features/profesores/ProfesoresPage.tsx`, `api.ts`; `lib/formato.ts`; test `profesores.test.tsx`.

- [ ] **Paso 1:** escribir los 2 tests de profesores.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(web): administración de profesores y porcentajes`.

### Tarea 3: Horario de clases

**Archivos:** `apps/web/src/features/clases/ClasesPage.tsx`, `api.ts`; test `clases.test.tsx`.

- [ ] **Paso 1:** escribir el test de clases.
- [ ] **Paso 2:** correrlo y verificar que falla.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr el test y verificar que pasa.
- [ ] **Paso 5:** commit `feat(web): administración del horario de clases`.

### Tarea 4: Usuarios

**Archivos:** `apps/web/src/features/usuarios/UsuariosPage.tsx`, `api.ts`; test `usuarios.test.tsx`.

- [ ] **Paso 1:** escribir el test de usuarios.
- [ ] **Paso 2:** correrlo y verificar que falla.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr el test y verificar que pasa.
- [ ] **Paso 5:** commit `feat(web): administración de usuarios`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
