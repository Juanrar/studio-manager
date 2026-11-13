# Tests de la API

Trampas de los tests de integración y de service. El modelo a seguir está en la sección "Tests" de `CLAUDE.md`.

## Base y ejecución

- **Un solo Postgres por corrida**, archivos en serie. Cada archivo llama a `base.limpiar()` en `beforeEach`.
- **Si la sesión se reinició, Docker Desktop puede estar apagado.** Los tests fallan con `Could not find a working container runtime strategy`. Abrí Docker Desktop y esperá a que `docker info` responda.
- **Una tabla nueva va en `TABLAS`** de `apps/api/test/db.ts`.

## Errores y concurrencia

- **Drizzle envuelve los errores del driver** en `cause`. Para detectar violaciones de `unique` usá `esViolacionUnica()` de `lib/postgres.ts`.
- **Para probar un bloqueo `for update`** sin depender de la suerte: abrí una transacción que tome el bloqueo y, adentro, otra con `set local lock_timeout = '50ms'` que tiene que fallar con código `55P03`. Ver `apps/api/src/modules/pagos/test/pagos.service.test.ts`.

## Reloj y sesión

- **Un test que adelanta el reloj más de 7 días** tiene que volver a loguearse con la app nueva: la sesión vence a los 7 días.

## Datos de prueba

- **El alta de un alumno usa el reloj de la app:** `crearAlumno(datos, ahora)`. En los tests, `crearAlumnoDeTest(datos, ahora)` usa `AHORA` si no se le pasa otro momento.
- **Asistencias y suplencias en fechas pasadas:** el profesor tiene que tener un porcentaje vigente desde antes de esa fecha, si no la API responde 422. `crearProfesorDeTest` lo pone desde `2026-01-01`.
- **Las clases se crean por adelantado** con `generarClases(ej, hoy)` de `modules/clases/programacion.service.ts`. `crearHorarioDeTest` inserta solo la fila del horario: para tener sus clases se llama a `generarClases(db, hoy)`, y para una semana pasada, que el generador no crea, a `crearClaseDeTest(horarioId, fecha)` de `apps/api/test/fabricas.ts`, que devuelve `{ id, fecha }`. `POST /api/horarios` sí las crea.

## Tareas que corren solas

La baja automática vive en `programarTareas` de `src/tareas.ts`, llamada desde `server.ts` después de `listen`. Ahí Fastify ya no deja agregar hooks, así que devuelve una función para detenerlas. Los tests usan `buildApp` y no las arrancan.
