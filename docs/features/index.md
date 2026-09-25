# Índice de features

Estado de cada feature de Studio Manager. Este archivo es la fuente de verdad del progreso: un agente que empieza una sesión lo lee primero y elige acá qué hacer.

**Estados:** `pendiente` (sin empezar), `en curso` (alguien la está haciendo), `lista` (todas sus tareas pasan y quedó commiteada), `bloqueada` (falta una decisión o una dependencia).

## Backend

| # | Feature | Estado | Depende de |
|---|---|---|---|
| 1 | [Monorepo y esqueleto de la API](monorepo-y-api.md) | lista | — |
| 2 | [Esquema de base de datos y migraciones](esquema-base-de-datos.md) | lista | 1 |
| 3 | [Utilidades de dinero, fechas y errores](utilidades-de-dominio.md) | lista | 1 |
| 4 | [Autenticación y roles](autenticacion.md) | lista | 2, 3 |
| 5 | [Alumnos](alumnos.md) | lista | 4 |
| 6 | [Packs](packs.md) | en curso | 4 |
| 7 | [Profesores y porcentajes](profesores.md) | pendiente | 4 |
| 8 | Clases y sesiones | por escribir | 7 |
| 9 | Pagos | por escribir | 5, 6 |
| 10 | Asistencias | por escribir | 8, 9 |
| 11 | Liquidaciones y reportes | por escribir | 10 |

## Frontend

| # | Feature | Estado | Depende de |
|---|---|---|---|
| 12 | Base del frontend y login | por escribir | 4 |
| 13+ | Pantallas por módulo | por escribir | 12 |

## Bitácora

Una línea por sesión, la más reciente arriba. Sirve para retomar el trabajo sin releer todo el repositorio.

| Fecha | Feature | Qué pasó |
|---|---|---|
| 2026-09-24 | 5. Alumnos | Lista. ABM con baja lógica, búsqueda sin tildes (`unaccent`) por nombre completo y DNI, paginación. Suite 56/56. Esquemas comunes en `packages/shared/src/comun.ts` (campos opcionales que convierten `''` en `null`, `precioSchema`, `listadoQuerySchema`) |
| 2026-09-24 | 4. Autenticación y roles | Lista. Login, logout, sesión en cookie firmada de 7 días, roles `admin` y `recepcion`, ABM de usuarios y script `usuario:admin`. Suite 49/49. Cambios al plan: `scrypt` de Node en vez de argon2 (sin módulo nativo); `auth` es dueño de las sesiones para evitar una dependencia circular con `usuarios`; cambiar la contraseña también cierra sesiones. Pendientes menores: sin límite de intentos de login; un admin puede desactivarse a sí mismo |
| 2026-09-24 | 3. Utilidades de dominio | Lista. `lib/dinero.ts`, `lib/fechas.ts` y `lib/errores.ts`; suite completa 35/35. Cambio al plan: `override` en `codigoHttp` porque el tsconfig usa `noImplicitOverride` |
| 2026-09-24 | 2. Esquema de base de datos | Lista. 11 tablas migradas, tests 7/7. Cambios al plan: PK con identity (como la spec), `casing: 'snake_case'` también en el cliente, un solo Postgres por corrida de tests, seed que no duplica packs. En Windows hace falta `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1` (lo pone `global-setup.ts`). Se agregó `.gitattributes`. Pendiente menor: los tests unitarios también levantan el contenedor |
| 2026-09-24 | 1. Monorepo y API | Lista. `pnpm test` 2/2, typecheck ok, `/api/health` responde. Cambios al plan: `tsx` en lugar de `node` para correr `.ts` (Node 22.12 no lo hace sin flag) y se permitió el postinstall de esbuild que pide pnpm 12. Pendientes menores: agregar `.gitattributes`, mover `engine-strict` a `pnpm-workspace.yaml`, fijar `packageManager` |
| 2026-09-24 | — | Se reorganizó la documentación: las features viven en `docs/features/` y el progreso se sigue en este índice |

## Decisiones tomadas

Las decisiones de negocio y de diseño viven en los documentos de `docs/`. Estas son las que más afectan al código y conviene tener a mano:

- El dinero son pesos enteros. No hay centavos en ninguna parte del sistema.
- Los porcentajes son enteros en puntos básicos: 10000 es el 100%.
- Las clases restantes de un pago se calculan contando asistencias. No hay contador guardado.
- Un pago vence 1 mes después de la compra, y el admin puede extender la fecha.
- Las sesiones se crean cuando recepción abre la clase del día, no por adelantado.
- No existe la deuda: `asistencia.pago_id` es `not null`.

## Decisiones pendientes

No bloquean las features 1 a 3. Hay que resolverlas antes de escribir las features 9 y 10.

1. Cambio de pack a mitad de camino: cómo se cobra la diferencia y qué pasa con las clases ya usadas.
2. Cupo por clase: si alguna clase tiene un máximo de alumnos.
3. Egresos que no son sueldos (alquiler, servicios), para calcular la ganancia del mes.
