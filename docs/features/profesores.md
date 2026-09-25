# Profesores y porcentajes

**Estado:** lista  
**Depende de:** autenticacion  
**Listo cuando:** `pnpm test` pasa; admin gestiona profesores y su historial de porcentajes, y existe `porcentajeVigente()` para calcular sueldos.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** ABM de profesores y el historial del porcentaje que cobra cada uno por alumno.

**Arquitectura:** módulo `profesores` con `routes` → `service` → `repository`. Esquemas en `packages/shared/src/profesores.ts`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tablas `profesor` y `porcentaje_profesor`, decisiones 3 y 8.

## Decisiones

- **El porcentaje está en puntos básicos**: de 1 a 10000, donde 5000 es el 50%. El esquema rechaza fuera de rango con un 400.
- **Al crear un profesor se carga su porcentaje inicial**, vigente desde el día de alta (fecha del estudio según el reloj de la app). Sin porcentaje no se le puede calcular el sueldo.
- **Un cambio de porcentaje es una fila nueva** con su `vigenteDesde`. Nunca se edita una fila vieja: las asistencias ya registradas guardaron el porcentaje de su momento.
- **Porcentaje vigente en una fecha:** la fila con el `vigenteDesde` más reciente que sea menor o igual a esa fecha. Si no hay ninguna, es un error de regla de negocio.
- **Dos porcentajes con la misma fecha** para el mismo profesor responden 422.
- **Recepción puede ver profesores** (los necesita para las clases y las suplencias), pero no crearlos ni editarlos.

## API

| Método y ruta | Rol | Cuerpo o query | Respuesta |
|---|---|---|---|
| `GET /api/profesores` | recepcion | `?incluirInactivos=true` | `200 { items: Profesor[] }` |
| `GET /api/profesores/:id` | recepcion | — | `200` profesor; `404` |
| `POST /api/profesores` | admin | `{ nombre, apellido, dni?, email?, telefono?, aliasCbu?, porcentajeBp }` | `201` profesor |
| `PATCH /api/profesores/:id` | admin | datos personales opcionales y `activo?` | `200` profesor; `404` |
| `GET /api/profesores/:id/porcentajes` | admin | — | `200 { items: { id, porcentajeBp, vigenteDesde }[] }`, el más nuevo primero |
| `POST /api/profesores/:id/porcentajes` | admin | `{ porcentajeBp, vigenteDesde }` | `201`; `422` fecha repetida; `404` profesor |

Forma del profesor: `{ id, nombre, apellido, dni, email, telefono, aliasCbu, activo, porcentajeVigenteBp }`. `porcentajeVigenteBp` es el vigente hoy, o `null` si todavía no hay ninguno vigente.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Admin crea un profesor con 52,5% y el listado lo muestra con `porcentajeVigenteBp: 5250` | Integración | Si el alta no guarda el porcentaje inicial o el listado no lo calcula, el sueldo no se puede liquidar |
| Recepción puede listar profesores pero no crearlos | Integración | Si las escrituras quedan con rol `recepcion`, recepción cambia porcentajes |
| Un porcentaje de 10001 puntos básicos responde 400 | Integración | Si el esquema confunde porcentaje con puntos básicos (rango 0 a 100 o sin máximo), se cargan valores 100 veces más grandes |
| Dos porcentajes con la misma fecha responden 422 | Integración | Si no se traduce `porcentaje_profesor_vigencia_uq`, admin ve un 500 |
| `porcentajeVigente` elige según la fecha (tabla: el día anterior al cambio, el día del cambio, antes del primer porcentaje) | Service con base | Si la comparación usa `<` en lugar de `<=`, el día del cambio se paga con el porcentaje viejo; si falta el orden descendente, se toma el más antiguo |

**No se testea:** el `PATCH` de datos personales (mismo patrón que alumnos); el listado del historial (lo cubre indirectamente el test de fecha repetida).

---

### Tarea 1: Módulo de profesores

**Archivos:**
- Crear: `packages/shared/src/profesores.ts` — `porcentajeBpSchema`, `crearProfesorSchema`, `actualizarProfesorSchema`, `nuevoPorcentajeSchema`, `type Profesor`, `type PorcentajeProfesor`.
- Crear: `apps/api/src/modules/profesores/profesores.repository.ts`, `profesores.service.ts`, `profesores.routes.ts`
- Modificar: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/profesores/profesores.test.ts` y `profesores.service.test.ts`

**Interfaces:**
- Produce: `porcentajeVigente(ej: Ejecutor, profesorId: number, fecha: FechaDia): Promise<number>` y `obtenerProfesor(id): Promise<Profesor>`. La feature de asistencias usa `porcentajeVigente` dentro de su transacción.

- [x] **Paso 1:** escribir los 5 tests de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan (404 en las rutas; módulo inexistente en el service).
- [x] **Paso 3:** implementar esquemas, repository, service y rutas.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(profesores): ABM de profesores e historial de porcentajes`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan.
