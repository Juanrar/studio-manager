# Clases y sesiones

**Estado:** en curso  
**Depende de:** profesores  
**Listo cuando:** `pnpm test` pasa; admin arma el horario semanal y recepción ve la agenda del día, abre sesiones y registra suplencias.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** separar el horario semanal (`clase`) de la clase que ocurrió en una fecha (`sesion`), que es a donde apuntan las asistencias.

**Arquitectura:** módulo `clases` con dos juegos de archivos: `clases.*` para el horario y `sesiones.*` para las sesiones. `clases.service` usa `profesores.service` para validar al profesor. Esquemas en `packages/shared/src/clases.ts`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tablas `clase` y `sesion`, decisión 1.

## Decisiones

- **Horarios como `HH:MM`** en la API. Postgres guarda `time`; el repository devuelve `HH:MM`, sin segundos.
- **`diaSemana` sigue ISO:** 1 es lunes, 7 es domingo.
- **Solo un profesor activo puede ser titular** de una clase. Si no existe o está inactivo, 422.
- **Una sesión se abre cuando recepción la necesita** (para tomar asistencia). Abrirla dos veces devuelve la misma sesión: un doble clic no puede dar un 500.
- **La fecha de una sesión tiene que caer en el día de la semana de su clase.** Si no, 422.
- **Suplencia:** se cambia `profesorId` de la sesión, no el titular de la clase.
- **Estados usados en v1:** `programada` y `cancelada`. `dictada` queda sin uso, porque el sueldo se calcula por asistencias.
- **Queda para la feature de asistencias**, donde se puede probar con datos reales: no cancelar una sesión con asistencias, y recalcular el porcentaje de las asistencias cuando se registra una suplencia después de tomarlas.
- **Sin salas ni control de superposición** en v1: el estudio tiene una sola sala.

## API

| Método y ruta | Rol | Cuerpo o query | Respuesta |
|---|---|---|---|
| `GET /api/clases` | recepcion | `?incluirInactivos=true` | `200 { items: Clase[] }`, por día y hora |
| `POST /api/clases` | admin | `{ estilo, nivel?, diaSemana, horaInicio, horaFin, profesorId }` | `201` clase; `422` profesor inválido |
| `PATCH /api/clases/:id` | admin | campos opcionales y `activa?` | `200` clase; `404`; `422` |
| `GET /api/sesiones/dia` | recepcion | `?fecha=AAAA-MM-DD` (por defecto hoy) | `200 { fecha, items: ClaseDelDia[] }` |
| `POST /api/sesiones` | recepcion | `{ claseId, fecha }` | `201` sesión nueva, o `200` si ya existía; `422` |
| `PATCH /api/sesiones/:id` | recepcion | `{ profesorId?, estado? }` | `200` sesión; `404`; `422` |

Formas:

- `Clase`: `{ id, estilo, nivel, diaSemana, horaInicio, horaFin, profesor: { id, nombre, apellido }, activa }`
- `Sesion`: `{ id, claseId, fecha, estado, profesor: { id, nombre, apellido }, asistentes }`
- `ClaseDelDia`: `{ claseId, estilo, nivel, horaInicio, horaFin, profesorTitular, sesion: Sesion | null }`

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Admin crea una clase (con la respuesta completa, horas en `HH:MM`) y recepción no puede | Integración | Si el repository devuelve `19:00:00`, el frontend compara horas mal; si la ruta queda con rol `recepcion`, cualquiera cambia el horario |
| Hora de fin igual o anterior al inicio responde 400 al crear | Integración | Si se pierde el `refine` del esquema, la base rechaza con su `check` y el usuario ve un 500 |
| `PATCH` que deja el fin antes del inicio responde 422 | Integración | En el `PATCH` el esquema no ve la otra hora; si el service no traduce la violación de `clase_horario_valido`, sale un 500 |
| Profesor inactivo como titular responde 422 | Integración | Si el service no valida al profesor, se arman clases con profesores dados de baja |
| La agenda de un martes trae solo las clases activas del martes, por hora, sin sesión | Integración | Si el día de la semana se calcula 0-based (domingo = 0), la agenda del martes muestra las del miércoles |
| Abrir la misma sesión dos veces devuelve la misma sesión | Integración | Si el service inserta sin mirar `sesion_clase_fecha_uq`, un doble clic de recepción da un 500 |
| Abrir una sesión en una fecha de otro día de la semana responde 422 | Integración | Si no se compara el día, se crean sesiones de una clase en días que no se dicta |
| Una suplencia cambia el profesor de la sesión y no el titular de la clase | Integración | Si el `PATCH` de sesión actualiza la clase, la suplencia de un día cambia al titular para siempre |

**No se testea:** el filtro de inactivos de `GET /api/clases` (mismo patrón que packs); cancelar una sesión sin asistencias (es un cambio de campo; la regla interesante se prueba en asistencias).

---

### Tarea 1: Horario semanal

**Archivos:**
- Crear: `packages/shared/src/clases.ts` — `horaSchema`, `crearClaseSchema`, `actualizarClaseSchema`, `abrirSesionSchema`, `actualizarSesionSchema`, `agendaQuerySchema`, tipos `Clase`, `Sesion`, `ClaseDelDia`, `PersonaResumen`.
- Modificar: `apps/api/src/lib/postgres.ts` — `esViolacionCheck(error, restriccion)`.
- Crear: `apps/api/src/modules/clases/clases.repository.ts`, `clases.service.ts`, `clases.routes.ts`
- Test: `apps/api/src/modules/clases/clases.test.ts`

- [x] **Paso 1:** escribir los 4 tests de clases de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(clases): horario semanal de clases`.

### Tarea 2: Sesiones y agenda del día

**Archivos:**
- Crear: `apps/api/src/modules/clases/sesiones.repository.ts`, `sesiones.service.ts`, `sesiones.routes.ts`
- Test: `apps/api/src/modules/clases/sesiones.test.ts`

**Interfaces:**
- Produce: `bloquearSesion(tx, sesionId): Promise<{ id, claseId, fecha, estado, profesorId }>` (hace `select ... for update`), que usa la feature de asistencias.

- [ ] **Paso 1:** escribir los 4 tests de sesiones de la tabla.
- [ ] **Paso 2:** correrlos y verificar que fallan con 404.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(clases): sesiones, agenda del día y suplencias`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
