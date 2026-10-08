# CLAUDE.md

Instrucciones para cualquier agente que trabaje en este repositorio. Leelo entero antes de tocar código.

## Qué es esto

Studio Manager: sistema web de gestión para un estudio de danza. Lo usa solo el personal del estudio, administradores y recepción. Los alumnos no entran al sistema. Reemplaza una aplicación de escritorio en Java Swing.

Monorepo con pnpm: `apps/api` (Fastify + TypeScript), `apps/web` (React + Vite) y `packages/shared` (esquemas Zod compartidos). Base: PostgreSQL con Drizzle.

## Cómo empezar una sesión

1. Leé [docs/features/index.md](docs/features/index.md). Es la fuente de verdad del progreso.
2. Mirá `git log --oneline -15` para ver dónde quedó el trabajo.
3. Corré `pnpm test` para saber si el repositorio está sano. Si está roto, arreglarlo es la tarea, no seguir con lo siguiente.
4. Elegí **una sola feature** del índice: la de estado `pendiente` con el número más bajo cuyas dependencias estén `listas`.
5. Marcala como `en curso` en el índice antes de empezar.

No arranques varias features a la vez. No declares el proyecto terminado: el índice dice qué falta.

## Cómo trabajar una feature

El archivo de la feature (`docs/features/<nombre>.md`) tiene tareas, y cada tarea tiene pasos con checkbox. Se hace en orden, de arriba hacia abajo.

Por cada paso:

1. Escribí el test primero.
2. Corré el test y verificá que falla, por el motivo correcto.
3. Escribí la implementación mínima.
4. Corré el test y verificá que pasa.
5. Commiteá.
6. Marcá el checkbox del paso en el archivo de la feature.

Reglas:

- Un checkbox se marca solo después de correr el comando y ver que pasa. Nunca por adelantado.
- Si un test no pasa, no sigas a la tarea siguiente.
- Si el plan de la feature está mal o no compila, corregí el archivo de la feature y dejá escrito por qué. El plan no es sagrado; los tests sí.
- Un commit por tarea, con mensaje en español y en modo `tipo(alcance): descripción`, por ejemplo `feat(pagos): registrar la compra de un pack`.

## Cómo cerrar una feature

1. Corré la verificación completa que está al final del archivo de la feature.
2. Corré `pnpm test` y `pnpm typecheck` en todo el repositorio.
3. Pasá la feature a `lista` en el índice.
4. Agregá una línea a la bitácora del índice: fecha, feature y qué pasó, incluido lo que quedó afuera o cualquier sorpresa.
5. Si aprendiste algo que sirve para las próximas sesiones (un comando que falla siempre, un patrón del repositorio), agregalo a este archivo.

## Dónde va la documentación

- **Features**: `docs/features/<nombre-de-la-feature>.md`. El nombre describe la feature, sin fecha ni número: `pagos.md`, `asistencias.md`. Cada archivo contiene el objetivo, la arquitectura, las restricciones, las tareas con sus pasos y la verificación final.
- **Progreso**: `docs/features/index.md`. Estados, dependencias, bitácora y decisiones.
- **Diseño**: `docs/arquitectura general.md`, `docs/arquitectura backend.md`, `docs/arquitectura frontend.md`, `docs/estructura de base de datos.md`.

No crees carpetas nuevas de planes ni de specs. Todo lo que sea plan o spec de una feature va en `docs/features/`.

## Reglas del dominio

Estas reglas se rompen fácil y cuestan caro. Están explicadas en [docs/estructura de base de datos.md](docs/estructura%20de%20base%20de%20datos.md).

- **El dinero son pesos enteros.** No hay centavos. Las columnas de dinero son `bigint`. Toda cuenta con dinero pasa por `apps/api/src/lib/dinero.ts`.
- **Los porcentajes son enteros en puntos básicos**: `porcentaje_bp`, de 1 a 10000. 50% es 5000.
- **Las clases restantes se calculan**, contando asistencias del pago. No hay contador guardado.
- **Lo que ya pasó no cambia.** `pago.monto`, `asistencia.valor_clase` y `asistencia.porcentaje_bp` se copian al momento de registrar. Un cambio de precio no altera meses anteriores.
- **`horario` es lo que se repite cada semana; `clase` es la de una fecha.** La asistencia apunta a la clase, nunca al horario. "Sesión" es solo la del login (`sesion_usuario`).
- **Nada con historial se borra.** Se usa `activo = false` o `anulado_en`.
- **Las fechas del negocio son días** (`YYYY-MM-DD`) en la zona `America/Argentina/Buenos_Aires`. Pasan por `apps/api/src/lib/fechas.ts`.

## Reglas del código

- TypeScript `strict`, ESM, Node 22.
- Capas en el backend: `routes` → `service` → `repository` → `db`. Las rutas no tienen reglas de negocio ni SQL. Los services no conocen HTTP.
- Un módulo usa el **service** de otro módulo, nunca su repository.
- Las operaciones que escriben en más de una tabla van en una transacción abierta en el service.
- Los errores de negocio se lanzan con las clases de `lib/errores.ts`. No se devuelve `null` para indicar una falla.
- La validación de entrada usa los esquemas Zod de `packages/shared`, los mismos que usa el frontend.
- Nunca se mockea la base de datos. Los tests de integración corren contra un Postgres real con Testcontainers.
- Nada de secretos en el repositorio. `.env` está ignorado; se versiona `.env.example`.
- En la web, los colores salen de las variables de `apps/web/src/index.css` (`bg-panel`, `text-tenue`, `border-borde`). La paleta de Tailwind se usa solo para estados: verde, rojo y ámbar.
- Cada pantalla usa `Pagina` de `components/ui`, y los botones de una fila van en `CeldaDeAcciones`. Un `<td>` con `display: flex` descuadra los bordes de la tabla.
- Un ícono nuevo se agrega copiando su trazo de Tabler en `components/ui/Icono.tsx`. No se instala `@tabler/icons-react`: su índice importa miles de archivos y vuelve lentos los tests.

## Tests de referencia

Antes de escribir tests nuevos, mirá estos. Son el modelo a seguir; si un test viejo no se parece, ganan estos.

| Tipo | Archivo | Qué muestra |
|---|---|---|
| Integración HTTP | `apps/api/src/modules/auth/auth.test.ts` | App completa con `crearAppDeTest()`, reloj fijo, login con `loguear()`, aserciones sobre la respuesta completa |
| Service con base real | `apps/api/src/modules/usuarios/usuarios.service.test.ts` | Llamar al service directo y verificar lo persistido |
| Unitario puro | `apps/api/src/lib/dinero.test.ts` | Funciones sin dependencias |

Reglas que siguen:

- La mayoría de los tests son de integración, con `app.inject()` contra el Postgres de test.
- Nunca `new Date()` en un test: la app se crea con `reloj: relojFijo(...)` (ver `apps/api/test/app.ts`).
- Cada test tiene una razón escrita en la tabla de tests de su feature: qué cambio de código lo rompería.
- Aserciones completas con valores escritos a mano, no chequeos de un campo suelto.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala las dependencias del monorepo |
| `pnpm dev` | Levanta Postgres, espera el healthcheck y arranca la API y el frontend juntos |
| `pnpm db:up` / `pnpm db:down` | Levanta o apaga Postgres en el puerto 5433 |
| `pnpm test` | Corre los tests de todos los paquetes |
| `pnpm typecheck` | Verifica los tipos |
| `pnpm dev:api` | Levanta la API en el puerto 3000 |
| `pnpm dev:web` | Levanta el frontend en el puerto 5173, con proxy de `/api` a la API |
| `pnpm build` | Compila el frontend en `apps/web/dist` |
| `pnpm start` | Levanta la API; con `WEB_DIST=../web/dist` también sirve el frontend |
| `pnpm e2e` | Prueba de punta a punta con Playwright: base limpia, build y recorrido en Chromium |
| `pnpm --filter @studio/api db:generate` | Genera una migración desde `schema.ts` |
| `pnpm --filter @studio/api db:migrate` | Aplica las migraciones |

Los tests de integración necesitan Docker corriendo.

## Cosas del entorno que ya se resolvieron

- **pnpm 12 bloquea los scripts de instalación** de las dependencias. Se aprueban o rechazan en `allowBuilds` de `pnpm-workspace.yaml`. Hoy: `esbuild` sí; `cpu-features`, `ssh2` y `protobufjs` no (vienen con testcontainers y no hacen falta).
- **Testcontainers en Windows:** `localhost` resuelve a `::1` y Docker Desktop publica solo en IPv4. `apps/api/test/global-setup.ts` define `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1`.
- **Node 22.12 no ejecuta `.ts` sin flag.** Los scripts usan `tsx`.
- **Drizzle envuelve los errores del driver** en `cause`. Para detectar violaciones de `unique` usá `esViolacionUnica()` de `lib/postgres.ts`.
- **Un test que adelanta el reloj más de 7 días** tiene que volver a loguearse con la app nueva: la sesión vence a los 7 días.
- **Para probar un bloqueo `for update`** sin depender de la suerte: abrir una transacción que tome el bloqueo y, adentro, otra con `set local lock_timeout = '50ms'` que tiene que fallar con código `55P03`. Ver `apps/api/src/modules/pagos/pagos.service.test.ts`.
- **`localhost` en Windows resuelve a `::1`** y la API escucha en IPv4: el proxy de Vite apunta a `127.0.0.1:3000`.
- **Vite escucha solo en `[::1]:5173`.** Un `curl` a `127.0.0.1:5173` queda colgado; usá `localhost:5173`.
- **Cortar `pnpm dev` desde una tarea en segundo plano** deja vivos la API y Vite en Windows. Buscá los PID con `netstat -ano` en los puertos 3000 y 5173 y cerralos.
- **Tests del frontend:** `apps/web/test/render.tsx` renderiza la app completa en una ruta con `renderizarEn()`, y `conSesion()` simula `GET /api/auth/yo`. MSW falla si llega un pedido que el test no previó. No necesitan Docker.
- **Si la sesión se reinició, Docker Desktop puede estar apagado.** Los tests de la API fallan con `Could not find a working container runtime strategy`. Hay que abrir Docker Desktop y esperar a que `docker info` responda.
- **Tests web que pasan por `/agenda`** sin probar la agenda: llamar a `conAgendaVacia()`, si no la agenda hace un pedido que MSW no esperaba.
- **Tests web de tablas:** `celdasDe(fila)` de `apps/web/test/tabla.ts` devuelve el texto de cada celda sin lo que es `aria-hidden` (la inicial del avatar). El listado de alumnos se simula con `unListadoDeAlumnos` y `unAlumnoEnListado` de `test/datos.ts`.
- **Tests web de la ficha del alumno:** la ficha pide `/api/alumnos/:id` (se simula con `unaFichaDeAlumno`) y `/api/alumnos/:id/actividad`, porque Actividad es la pestaña que se abre primero. La tabla de pagos está en la pestaña Pagos: hay que hacer clic en ella antes de buscar filas.
- **El alta de un alumno usa el reloj de la app:** `crearAlumno(datos, ahora)`. En los tests, `crearAlumnoDeTest(datos, ahora)` usa `AHORA` si no se le pasa otro momento.
- **Asistencias y suplencias en fechas pasadas:** el profesor tiene que tener un porcentaje vigente desde antes de esa fecha, si no la API responde 422. En los tests, `crearProfesorDeTest` lo pone desde `2026-01-01`.
- **`pnpm e2e` no corre dentro de `pnpm test`:** necesita Docker, compila el frontend y usa la base `studio_manager_e2e` (se borra y se crea en cada corrida). Usa el reloj real: crea la clase para el día de hoy en Buenos Aires.
- **Un solo Postgres por corrida de tests**, archivos en serie. Cada archivo llama a `base.limpiar()` en `beforeEach`.
- **Drizzle escribe las columnas sin la tabla** cuando la consulta es de una sola tabla. En una subconsulta con `sql`, `${profesor.id}` sale como `"id"` y puede apuntar a la tabla de adentro. Para ver el SQL sin ejecutarlo: `.toSQL()`.
- **Git Bash convierte en ruta de Windows** cualquier argumento que empieza con `/` (`/agenda` pasa a `C:/Program Files/Git/agenda`). Se evita con `MSYS_NO_PATHCONV=1`.
- **`curl -d` en Git Bash manda mal las tildes** y la API responde "Request body size did not match Content-Length". Para cargar datos con acentos, usar un script de Node con `fetch`.
- **Migraciones:** `pnpm --filter @studio/api db:generate --name <nombre>` la genera desde `schema.ts`. `pnpm dev` no la aplica: en la base de desarrollo hay que correr `pnpm --filter @studio/api db:migrate`. Una tabla nueva también va en `TABLAS` de `apps/api/test/db.ts`.
- **Tareas que corren solas** (la baja automática): `programarTareas` de `src/tareas.ts`, llamada desde `server.ts` después de `listen`. Ahí Fastify ya no deja agregar hooks, así que devuelve una función para detenerlas. Los tests usan `buildApp` y no las arrancan.
- **El e2e borra `studio_manager_e2e`** en cada corrida. Sirve para mirar la app con datos sin tocar la base de desarrollo: API con esa base en otro puerto y `WEB_DIST=../web/dist`. Un script de capturas que vive fuera del repo carga Playwright con `createRequire('<repo>/e2e/package.json')`.
- **`pnpm e2e` usa el puerto fijo 3100** (`PUERTO_E2E` en `e2e/entorno.ts`). Si otro proceso lo ocupa, Playwright no levanta la API. Se cambia el número para esa corrida y se vuelve atrás con `git checkout -- e2e/entorno.ts`. No se cierra un proceso que no es de este proyecto.
- **jsdom no calcula el diseño** ni evalúa media queries como `pointer-coarse`. La posición de una lista flotante o lo que se ve en una pantalla táctil se verifica en Chromium con un script de Playwright, como en la nota anterior.
- **Tests web del `SelectorDeHora`:** el campo es un combobox (`getByRole('combobox', { name: 'Empieza' })`) y la lista se abre en un portal sobre `document.body`, así que `screen` la encuentra y `within(fila)` no.
- **Las clases se crean por adelantado** con `generarClases(ej, hoy)` de `modules/clases/programacion.service.ts`. En los tests de la API, `crearHorarioDeTest` crea solo el horario: para tener sus clases se llama a `generarClases(db, hoy)`, y para una semana pasada, que el generador no crea, a `abrirClase(horarioId, fecha)`. `POST /api/horarios` sí las crea.
- **Renombrar una tabla o una columna con Drizzle:** `db:generate` pregunta en la terminal si es un renombre, y un agente no puede contestar. La migración se escribe a mano (`db:generate --custom --name <nombre>`) y el snapshot se regenera desde `schema.ts` en una carpeta temporal: `pnpm exec drizzle-kit generate --dialect postgresql --schema ./src/db/schema.ts --out <carpeta> --casing snake_case`, copiando el `id` y el `prevId` del snapshot que creó `--custom`. Hay que renombrar también las claves foráneas, las secuencias y las claves primarias. Después `db:generate` tiene que decir que no hay cambios. Ejemplo: la migración `0003_renombrar_horario_y_clase`.
- **Un worktree nuevo no tiene `apps/api/.env`** (git lo ignora): `pnpm e2e` falla en el seed con `.env: not found`. Se copia el `.env.example` de la raíz.
- **`vitest run --reporter=json`** escribe `.vitest/json/output.json` dentro del paquete, que git no ignora. Se pasa `--outputFile` con una ruta fuera del repositorio.

## Estilo de escritura

En el código, los commits y la documentación: español, directo, sin relleno. Nombres de dominio en español (`alumno`, `pago`, `asistencia`), no mezclados con inglés.
