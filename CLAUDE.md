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
- **`clase` es el horario semanal; `sesion` es la clase de una fecha.** La asistencia apunta a la sesión, nunca al horario.
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
| `pnpm db:up` / `pnpm db:down` | Levanta o apaga Postgres en el puerto 5433 |
| `pnpm test` | Corre los tests de todos los paquetes |
| `pnpm typecheck` | Verifica los tipos |
| `pnpm dev:api` | Levanta la API en el puerto 3000 |
| `pnpm dev:web` | Levanta el frontend en el puerto 5173, con proxy de `/api` a la API |
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
- **Tests del frontend:** `apps/web/test/render.tsx` renderiza la app completa en una ruta con `renderizarEn()`, y `conSesion()` simula `GET /api/auth/yo`. MSW falla si llega un pedido que el test no previó. No necesitan Docker.
- **Si la sesión se reinició, Docker Desktop puede estar apagado.** Los tests de la API fallan con `Could not find a working container runtime strategy`. Hay que abrir Docker Desktop y esperar a que `docker info` responda.
- **Tests web que pasan por `/agenda`** sin probar la agenda: llamar a `conAgendaVacia()`, si no la agenda hace un pedido que MSW no esperaba.
- **Un solo Postgres por corrida de tests**, archivos en serie. Cada archivo llama a `base.limpiar()` en `beforeEach`.

## Estilo de escritura

En el código, los commits y la documentación: español, directo, sin relleno. Nombres de dominio en español (`alumno`, `pago`, `asistencia`), no mezclados con inglés.
