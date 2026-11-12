# CLAUDE.md

Instrucciones para cualquier agente que trabaje en este repositorio. Leé este archivo y, antes de tocar código, los de `docs/entorno/` que corresponden a tu tarea (ver "Antes de tocar").

## Qué es esto

Studio Manager: sistema web de gestión para un estudio de danza. Lo usa solo el personal del estudio, administradores y recepción. Los alumnos no entran al sistema. Reemplaza una aplicación de escritorio en Java Swing.

Monorepo con pnpm: `apps/api` (Fastify + TypeScript), `apps/web` (React + Vite) y `packages/shared` (esquemas Zod compartidos). Base: PostgreSQL con Drizzle.

## Cómo empezar una sesión

1. Leé [docs/features/index.md](docs/features/index.md). Es la fuente de verdad del progreso.
2. Mirá `git log --oneline -15` para ver dónde quedó el trabajo.
3. Corré `pnpm test` para saber si el repositorio está sano. Si está roto, arreglarlo es la tarea, no seguir con lo siguiente.
4. Elegí **una sola feature** del índice: la de estado `pendiente` con el número más bajo cuyas dependencias estén `listas`.
5. Marcala como `en curso` en el índice antes de empezar.

Trabajá una feature a la vez. El índice dice qué falta; el proyecto no se da por terminado.

## Cómo trabajar una feature

El archivo de la feature (`docs/features/<nombre>.md`) tiene tareas, y cada tarea tiene pasos con checkbox. Se hace en orden, de arriba hacia abajo.

Por cada paso:

1. Escribí el test primero.
2. Corré el test y verificá que falla, por el motivo correcto.
3. Escribí la implementación mínima.
4. Corré el test y verificá que pasa.
5. Marcá el checkbox del paso en el archivo de la feature.

Al terminar todos los pasos de la tarea, un solo commit con el código y los checkboxes.

Reglas:

- Un checkbox se marca solo después de correr el comando y ver que pasa.
- Con un test en rojo, la tarea siguiente espera.
- Si el plan de la feature está mal o no compila, corregí el archivo de la feature y dejá escrito por qué. El plan no es sagrado; los tests sí.
- Las features se ejecutan siempre con un subagente por tarea y una revisión después de cada una, para no llenar el contexto de la sesión principal (pedido del estudio, 2026-11-11).
- El commit va en español con el modo `tipo(alcance): descripción`, por ejemplo `feat(pagos): registrar la compra de un pack`.

## Cómo cerrar una feature

1. Corré la verificación completa que está al final del archivo de la feature.
2. Corré `pnpm test` y `pnpm typecheck` en todo el repositorio.
3. Pasá la feature a `lista` en el índice.
4. Agregá una línea a la bitácora del índice: fecha, feature y qué pasó, incluido lo que quedó afuera o cualquier sorpresa.
5. Si aprendiste algo que sirve para las próximas sesiones (un comando que falla siempre, un patrón del repositorio), agregalo al archivo de `docs/entorno/` de ese tema. Si ya hay una nota sobre lo mismo, reemplazala. Un tema nuevo es un archivo nuevo, con su línea en "Antes de tocar".

## Dónde va la documentación

- **Features**: `docs/features/<nombre-de-la-feature>.md`. El nombre describe la feature, sin fecha ni número: `pagos.md`, `asistencias.md`. Cada archivo contiene el objetivo, la arquitectura, las restricciones, las tareas con sus pasos y la verificación final.
- **Progreso**: `docs/features/index.md`. Estados, dependencias, bitácora y decisiones.
- **Diseño**: `docs/arquitectura general.md`, `docs/arquitectura backend.md`, `docs/arquitectura frontend.md`, `docs/estructura de base de datos.md`.
- **Trampas del entorno**: `docs/entorno/<tema>.md`.

Todo plan o spec de una feature va en `docs/features/`.

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

- Código, commits y documentación en español, con nombres de dominio en español (`alumno`, `pago`, `asistencia`).
- TypeScript `strict`, ESM, Node 22.
- Capas en el backend: `routes` → `service` → `repository` → `db`. Las rutas no tienen reglas de negocio ni SQL. Los services no conocen HTTP.
- Un módulo usa el **service** de otro módulo, nunca su repository.
- Las operaciones que escriben en más de una tabla van en una transacción abierta en el service.
- Los errores de negocio se lanzan con las clases de `lib/errores.ts`. No se devuelve `null` para indicar una falla.
- La validación de entrada usa los esquemas Zod de `packages/shared`, los mismos que usa el frontend.
- Nada de secretos en el repositorio. `.env` está ignorado; se versiona `.env.example`.
- En la web, los colores salen de las variables de `apps/web/src/index.css` (`bg-panel`, `text-tenue`, `border-borde`). La paleta de Tailwind se usa solo para estados: verde, rojo y ámbar.
- Cada pantalla usa `Pagina` de `components/ui`, y los botones de una fila van en `CeldaDeAcciones`. Un `<td>` con `display: flex` descuadra los bordes de la tabla.
- Un ícono nuevo se agrega copiando su trazo de Tabler en `components/ui/Icono.tsx`. No se instala `@tabler/icons-react`: su índice importa miles de archivos y vuelve lentos los tests.

## Tests

Antes de escribir tests nuevos, mirá estos. Son el modelo a seguir; si un test viejo no se parece, ganan estos.

| Tipo | Archivo | Qué muestra |
|---|---|---|
| Integración HTTP | `apps/api/src/modules/auth/test/auth.test.ts` | App completa con `crearAppDeTest()`, reloj fijo, login con `loguear()`, aserciones sobre la respuesta completa |
| Service con base real | `apps/api/src/modules/usuarios/test/usuarios.service.test.ts` | Llamar al service directo y verificar lo persistido |
| Unitario puro | `apps/api/src/lib/test/dinero.test.ts` | Funciones sin dependencias |

- La mayoría de los tests son de integración, con `app.inject()` contra un Postgres real con Testcontainers. Nunca se mockea la base de datos. Necesitan Docker corriendo.
- Los tests no van al lado del código: cada carpeta con tests tiene su carpeta `test/`. Ejemplos: `modules/pagos/test/pagos.test.ts`, `features/agenda/test/agenda.test.tsx`, `lib/test/dinero.test.ts`. Los tests de `app.ts`, `tareas.ts` y `web.ts` van en `apps/api/src/test/`. No hay que confundirla con `apps/api/test/` ni con `apps/web/test/`, que tienen los ayudantes compartidos.
- Para el tiempo, la app se crea con `reloj: relojFijo(...)` (ver `apps/api/test/app.ts`). Nunca `new Date()` en un test.
- Cada test tiene una razón escrita en la tabla de tests de su feature: qué cambio de código lo rompería.
- Aserciones completas con valores escritos a mano, no chequeos de un campo suelto.

## Comandos

Los scripts están en el `package.json` de la raíz y de cada paquete. Estos tienen una trampa:

- `pnpm dev` levanta Postgres (puerto 5433), la API (3000) y el frontend (5173), pero no aplica migraciones: en la base de desarrollo corré `pnpm --filter @studio/api db:migrate`.
- `pnpm e2e` borra y recrea la base `studio_manager_e2e`, compila el frontend y no corre dentro de `pnpm test`.
- `pnpm --filter @studio/api asistente:probar [n]` corre las frases de prueba contra Gemini real y gasta cuota.
- `pnpm start` sirve también el frontend si `WEB_DIST=../web/dist`.

## Antes de tocar

Leé el archivo que corresponde. Cada uno junta las trampas ya resueltas de su tema.

- Una terminal de Windows (Git Bash, PowerShell, `localhost`, procesos o puertos colgados, worktrees): [docs/entorno/windows.md](docs/entorno/windows.md)
- Un test de la API (base, reloj, datos de prueba, tareas programadas): [docs/entorno/tests-api.md](docs/entorno/tests-api.md)
- El frontend o un test web (MSW, grilla, agenda, ficha del alumno, `Ventana`): [docs/entorno/web.md](docs/entorno/web.md)
- `schema.ts`, una migración o una consulta de Drizzle: [docs/entorno/base-de-datos.md](docs/entorno/base-de-datos.md)
- `pnpm e2e`, capturas o mirar la app en Chromium: [docs/entorno/e2e.md](docs/entorno/e2e.md)
- El asistente o Gemini (modelo falso, cuota, conversación): [docs/entorno/asistente.md](docs/entorno/asistente.md)

Si los tests de la API fallan con `Could not find a working container runtime strategy`, Docker Desktop está apagado: abrilo y esperá a que `docker info` responda.
