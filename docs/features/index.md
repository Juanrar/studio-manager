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
| 6 | [Packs](packs.md) | lista | 4 |
| 7 | [Profesores y porcentajes](profesores.md) | lista | 4 |
| 8 | [Clases y sesiones](clases-y-sesiones.md) | lista | 7 |
| 9 | [Pagos](pagos.md) | lista | 5, 6 |
| 10 | [Asistencias](asistencias.md) | lista | 8, 9 |
| 11 | [Liquidaciones y reportes](liquidaciones.md) | lista | 10 |

## Frontend

| # | Feature | Estado | Depende de |
|---|---|---|---|
| 12 | [Base del frontend y login](frontend-base.md) | lista | 4 |
| 13 | [Alumnos y pagos](frontend-alumnos.md) | lista | 12 |
| 14 | [Agenda del día y asistencias](frontend-agenda.md) | lista | 13 |
| 15 | [Administración: packs, profesores, clases y usuarios](frontend-administracion.md) | lista | 12 |
| 16 | [Liquidaciones e ingresos](frontend-liquidaciones.md) | lista | 15 |
| 17 | [Prueba de punta a punta y build de producción](e2e-y-produccion.md) | lista | 14, 16 |

## Bitácora

Una línea por sesión, la más reciente arriba. Sirve para retomar el trabajo sin releer todo el repositorio.

| Fecha | Feature | Qué pasó |
|---|---|---|
| 2026-09-25 | 17. Punta a punta y producción | Lista. La API sirve el frontend compilado con fallback de SPA (`WEB_DIST`). `pnpm e2e` crea una base limpia, compila el frontend y recorre con Chromium login, profesor, clase de hoy, pago, asistencia, cobro en el acto y liquidación; pasa en unos 7 segundos. La prueba manual encontró que `@fastify/static` exige ruta absoluta; se agregó el test. Con esto se completan las 17 features de v1. API 108, web 29, e2e 1 |
| 2026-09-25 | 16. Pantalla de liquidaciones e ingresos | Lista. Mes en la URL (por defecto el anterior), ingresos por medio, sueldos con estado, cerrar, marcar pagada y detalle descargable en CSV con `;` y BOM (reemplaza el Excel de la app original). Ya no quedan pantallas "Próximamente". Web 29 tests |
| 2026-09-25 | 15. Pantallas de administración | Lista. Packs, profesores con historial de porcentajes (se escriben en % y se mandan en puntos básicos), horario agrupado por día y usuarios. La pantalla de usuarios no ofrece desactivarse a uno mismo; la API todavía lo permite. Web 25 tests |
| 2026-09-25 | 14. Agenda del día y asistencias | Lista. Agenda por fecha en la URL, apertura de sesión, anotar alumnos con buscador, cobrar clase suelta en el acto (decidido por `codigo: SIN_CLASES_DISPONIBLES`, no por el texto), quitar asistencias, suplencias y cancelar. En la API se agregó `GET /api/sesiones/:id` y el campo `codigo` en los errores de negocio. API 105, web 18 |
| 2026-09-24 | 13. Pantallas de alumnos y pagos | Lista. Listado con búsqueda demorada y paginación, alta y edición con el esquema compartido, ficha con pagos (registrar y anular). 12 tests web |
| 2026-09-24 | 12. Base del frontend | Lista. Vite 8, React 19, React Router 8, TanStack Query, Tailwind 4, Vitest 5 con MSW. Login, sesión, menú por rol y cerrar sesión; 6 tests. TypeScript fijado en 5.9 (se había instalado 7). El proxy de Vite apunta a `127.0.0.1` por el mismo problema de IPv6 de Windows. Probado a mano contra la API real |
| 2026-09-24 | 11. Liquidaciones y reportes | Lista. Resumen y detalle de sueldos por mes, cierre que congela el monto y bloquea cambios de asistencias y suplencias en ese mes, marcar pagada, e ingresos por medio de pago según el día del estudio. El backend de v1 queda completo. Suite 104/104 |
| 2026-09-24 | 10. Asistencias | Lista. Registrar asistencia en una transacción (bloquea sesión y pagos, elige el que vence primero, cobra clase suelta en el acto), borrar, y las reglas de cancelación, suplencia y anulación. El test HTTP de concurrencia detectaba la carrera solo a veces; se agregó uno determinístico con `lock_timeout`. Suite 95/95 |
| 2026-09-24 | 9. Pagos | Lista. Registrar (congela monto y clases), anular con motivo, extender vencimiento (admin), clases restantes calculadas. Se agregó `app.hoy()` para el día del estudio. Aprendido: un test que adelanta el reloj más de 7 días tiene que volver a loguearse. Suite 83/83 |
| 2026-09-24 | 8. Clases y sesiones | Lista. Horario semanal (horas `HH:MM`), agenda del día, apertura idempotente de sesiones y suplencias. `bloquearSesion()` listo para asistencias. Fábricas de test en `apps/api/test/fabricas.ts`. Suite 75/75 |
| 2026-09-24 | 7. Profesores y porcentajes | Lista. ABM de profesores con porcentaje inicial vigente desde el alta, historial de porcentajes y `porcentajeVigente(ej, profesorId, fecha)` para asistencias. Suite 67/67 |
| 2026-09-24 | 6. Packs | Lista. Catálogo con baja lógica; solo admin escribe; precio en pesos enteros validado por `precioSchema`. Suite 59/59 |
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

## Decisiones tomadas por defecto en v1

Se tomaron para poder avanzar. Cualquiera se puede cambiar; conviene revisarlas con quien atiende la recepción del estudio.

1. **Cambio de pack a mitad de camino:** no hay una operación especial. Se anula el pago y se registra otro.
2. **Monto del pago:** siempre el precio del pack. Descuentos, becas y precios especiales quedan fuera de v1.
3. **Cupo por clase:** no hay. El estudio tiene una sola sala y no se limita la cantidad de alumnos.
4. **Egresos que no son sueldos** (alquiler, servicios): fuera de v1. Los reportes muestran ingresos y liquidaciones.
