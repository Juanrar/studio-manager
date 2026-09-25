# Alumnos

**Estado:** en curso  
**Depende de:** autenticacion  
**Listo cuando:** `pnpm test` pasa y recepción puede crear, buscar, editar y dar de baja alumnos por la API.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** ABM de alumnos para recepción, con una búsqueda que tolere tildes y mayúsculas.

**Arquitectura:** módulo `alumnos` con `routes` → `service` → `repository`. Esquemas Zod en `packages/shared/src/alumnos.ts`, reutilizables por el frontend. Los listados paginados usan un esquema común en `packages/shared/src/comun.ts`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tabla `alumno`; [Arquitectura del backend](../arquitectura%20backend.md), sección "API".

## Decisiones

- **Solo nombre y apellido son obligatorios.** Email, DNI y el resto son opcionales: mucha gente que llega a tomar una clase suelta no los da. Un texto vacío se guarda como `null`.
- **DNI:** solo números, entre 6 y 9 dígitos. No se puede repetir.
- **No hay borrado.** La baja es `activo = false` con `PATCH`. Un alumno con pagos no se puede borrar sin perder historial.
- **Búsqueda:** `q` busca en nombre, apellido y DNI, sin distinguir tildes ni mayúsculas. Usa la extensión `unaccent` de Postgres. Los caracteres `%` y `_` de `q` se escapan.
- **Orden:** apellido y nombre.
- **Paginación:** `pagina` desde 1, `porPagina` por defecto 20 y máximo 100. `total` cuenta todos los resultados, no solo la página.
- **Por defecto se listan solo activos.** `incluirInactivos=true` muestra todos.

## API

Todas piden rol `recepcion` (o `admin`).

| Método y ruta | Cuerpo o query | Respuesta |
|---|---|---|
| `GET /api/alumnos` | `?q=&pagina=&porPagina=&incluirInactivos=` | `200 { items, total, pagina, porPagina }` |
| `GET /api/alumnos/:id` | — | `200` alumno; `404` |
| `POST /api/alumnos` | `{ nombre, apellido, dni?, email?, telefono?, fechaNacimiento?, contactoEmergencia?, notas? }` | `201` alumno; `422` DNI repetido |
| `PATCH /api/alumnos/:id` | los mismos campos, todos opcionales, más `activo?` | `200` alumno; `404`; `422` DNI repetido |

Forma del alumno: `{ id, nombre, apellido, dni, email, telefono, fechaNacimiento, contactoEmergencia, notas, activo }`. Los opcionales vienen como `null` si no se cargaron. `fechaNacimiento` es `YYYY-MM-DD`.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Sin sesión responde 401 | Integración | Si alguien registra las rutas sin el `preHandler` de rol, los datos de los alumnos quedan públicos |
| Crear un alumno solo con nombre y apellido guarda el resto en `null` | Integración | Si el esquema vuelve obligatorio el email (como en la app original) o guarda `''` en lugar de `null` |
| Crear con un DNI repetido responde 422 | Integración | Si el service deja de traducir la violación de `alumno_dni_unique`, recepción ve un 500 |
| La búsqueda encuentra por apellido sin tildes ni mayúsculas, y por DNI | Integración | Si la query deja de usar `unaccent`/`lower`, "garcia" no encuentra a "García"; si deja de mirar el DNI, no se puede buscar por documento |
| El listado excluye a los dados de baja salvo con `incluirInactivos=true` | Integración | Si se pierde el filtro por `activo`, recepción ve alumnos que ya no vienen; si se ignora el parámetro, no se los puede reactivar |
| `total` cuenta todos los resultados aunque la página traiga menos | Integración | Si `total` se calcula con el largo de la página, el frontend no puede paginar |
| `PATCH` cambia solo los campos enviados | Integración | Si el `PATCH` manda `null` en los campos ausentes, editar el teléfono borra el email |

**No se testea:** `GET /api/alumnos/:id` por separado (lo usa el test de `PATCH`); el formato exacto de los mensajes de Zod.

---

### Tarea 1: Extensión unaccent

**Archivos:**
- Crear: migración custom con `pnpm --filter @studio/api exec drizzle-kit generate --custom --name=unaccent`, con el contenido `CREATE EXTENSION IF NOT EXISTS unaccent;`

- [ ] **Paso 1:** generar la migración custom y escribir el `CREATE EXTENSION`.
- [ ] **Paso 2:** aplicarla con `pnpm --filter @studio/api db:migrate` y verificar con `docker exec studio-manager-db psql -U studio -d studio_manager -c "select unaccent('García')"` que devuelve `Garcia`.
- [ ] **Paso 3:** commit `feat(db): habilitar la extensión unaccent`.

### Tarea 2: Módulo de alumnos

**Archivos:**
- Crear: `packages/shared/src/comun.ts` — `listadoQuerySchema`, `type Listado<T>`, helpers de campos opcionales (`textoOpcional`, `emailOpcional`, `fechaOpcional`), `fechaDiaSchema`.
- Crear: `packages/shared/src/alumnos.ts` — `crearAlumnoSchema`, `actualizarAlumnoSchema`, `type Alumno`.
- Crear: `apps/api/src/modules/alumnos/alumnos.repository.ts`, `alumnos.service.ts`, `alumnos.routes.ts`
- Modificar: `apps/api/src/app.ts` — registrar `rutasAlumnos`.
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`

**Interfaces:**
- Produce: `crearAlumno(datos)`, `actualizarAlumno(id, datos)`, `obtenerAlumno(id)`, `listarAlumnos(filtros): Promise<Listado<Alumno>>`. Las features de pagos y asistencias usan `obtenerAlumno` para validar que el alumno existe y está activo.

- [ ] **Paso 1:** escribir los 7 tests de la tabla.
- [ ] **Paso 2:** correrlos y verificar que fallan con 404.
- [ ] **Paso 3:** implementar esquemas, repository, service y rutas.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** commit `feat(alumnos): ABM y búsqueda de alumnos`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
