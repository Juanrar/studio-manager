# Baja automática por no comprar

**Estado:** lista  
**Depende de:** clases-anotadas-en-la-actividad  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; la API da de baja sola a los alumnos que pasaron 2 meses sin comprar un pack, y las bajas y reactivaciones, a mano o automáticas, aparecen en la actividad de la ficha.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## La regla

Se pidió que un alumno pase a baja solo cuando no compra un pack durante 2 meses. Después se pidió que comprar (pack o clase suelta) lo reactive y se sacó el botón manual: el estado es solo para las métricas del administrador y nunca impide comprar ni anotarse. Los detalles son decisiones tomadas por defecto (anotadas en el índice):

- **Se cuenta desde la última compra**: el día, en la zona del estudio, del último pago no anulado. Cualquier pago cuenta, también una clase suelta cobrada en el acto. Un pago anulado no cuenta.
- **Si nunca compró, desde el alta.** Si se lo reactivó después de su última compra, desde la reactivación: si no, la baja automática volvería a darlo de baja apenas recepción lo reactiva.
- **2 meses de calendario**: quien compró el 29 de julio pasa a baja el 29 de septiembre. Del 31 de diciembre se pasa al 28 de febrero.
- **No se da de baja a quien tiene un pago sin vencer**, por ejemplo uno que el admin extendió.
- **Corre al arrancar la API y cada una hora.** La regla depende solo del día, así que correrla varias veces no cambia nada.

## Arquitectura

- **Tabla nueva `cambio_estado_alumno`**: cada baja y cada reactivación, con quién la hizo y cuándo. `registrado_por` es `null` cuando la hizo el sistema. `alumno.activo` sigue siendo el estado actual; los dos se escriben en la misma transacción.
- **`actualizarAlumno` recibe el usuario y `ahora`**: si el pedido cambia `activo`, registra el cambio. Editar otros datos, o mandar el mismo `activo`, no registra nada.
- **La regla es una función pura** en `alumnos/baja-automatica.ts`. `alumnos/baja-automatica.service.ts` junta los datos y da de baja; usa `pagos.service`, que ya usa `alumnos.service`, por eso vive aparte.
- **`pagos.service` expone `comprasDeAlumnos(alumnoIds, hoy)`**: el día del último pago no anulado de cada alumno y si le queda alguno sin vencer. Una consulta para todos.
- **`programarTareas(app)` en `src/tareas.ts`** corre la baja automática al arrancar y cada hora. La llama solo `server.ts`: los tests usan `buildApp` y no quedan tareas corriendo.
- **La actividad suma `baja` (con `automatica`) y `reactivacion`.** En un mismo día van primero las clases y después el resto por hora exacta: con la baja y la reactivación, un orden fijo por tipo ya no alcanza.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| A los 2 meses de la última compra corresponde la baja; un día antes, no | Unitario | Si se cuenta desde el vencimiento o con `<` en lugar de `<=`, la baja llega un mes o un día tarde |
| Si nunca compró se cuenta desde el alta, y una reactivación posterior vuelve a contar desde ella | Unitario | Si se ignora la reactivación, el sistema da de baja a quien recepción acaba de reactivar |
| Con un pago sin vencer no corresponde la baja | Unitario | Si se mira solo la fecha de compra, se da de baja a alguien con un pack extendido que sigue viniendo |
| `sumarMeses` suma meses y ajusta el fin de mes | Unitario | Si del 31 de diciembre salta a marzo, la baja llega días tarde |
| La baja automática da de baja a quien corresponde, ignora pagos anulados y a los ya dados de baja, registra la baja como automática y no repite nada si corre otra vez | Service con base real | Si se registra dos veces o toca a un alumno ya dado de baja, la actividad muestra bajas que no pasaron |
| Las bajas y reactivaciones, a mano o automáticas, aparecen en la actividad | Integración HTTP | Si `PATCH` no registra el cambio, la reactivación no cuenta para la regla y la ficha no explica por qué alguien está de baja |
| Al arrancar, las tareas dan de baja a quien corresponde | Integración | Si nadie llama a la baja automática, la regla existe pero nunca se aplica |
| La actividad muestra la baja automática, la baja a mano y la reactivación | Web | Si una baja automática se ve igual que una a mano, recepción no sabe por qué el alumno quedó de baja |

---

### Tarea 1: Regla de la baja automática

**Archivos:**
- Crear: `apps/api/src/modules/alumnos/baja-automatica.ts`, `baja-automatica.test.ts`
- Modificar: `apps/api/src/lib/fechas.ts`, `fechas.test.ts`

- [x] **Paso 1:** escribir los tests de `sumarMeses` y de la regla.
- [x] **Paso 2:** correrlos y verificar que fallan porque las funciones no existen.
- [x] **Paso 3:** implementar `sumarMeses` (con `sumarUnMes` encima) y `correspondeBajaAutomatica`.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): regla de la baja automática`.

### Tarea 2: La baja automática y el registro de bajas

**Archivos:**
- Crear: `apps/api/src/modules/alumnos/baja-automatica.service.ts`, `baja-automatica.service.test.ts`, la migración de `cambio_estado_alumno`
- Modificar: `apps/api/src/db/schema.ts`, `apps/api/test/db.ts`, `alumnos.repository.ts`, `alumnos.service.ts`, `alumnos.routes.ts`, `pagos.repository.ts`, `pagos.service.ts`, los tests que llaman a `actualizarAlumno`, `docs/estructura de base de datos.md`

- [x] **Paso 1:** escribir el test del service.
- [x] **Paso 2:** correrlo y verificar que falla porque el service no existe.
- [x] **Paso 3:** agregar la tabla y generar la migración; registrar los cambios en `actualizarAlumno`; implementar `comprasDeAlumnos` y el service.
- [x] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): baja automática de quien no compra un pack en 2 meses`.

Cambio al plan: la migración se generó con nombre (`pnpm --filter @studio/api db:generate --name cambio_estado_alumno`), igual que `0001_unaccent`.

### Tarea 3: Bajas y reactivaciones en la actividad

**Archivos:**
- Modificar: `packages/shared/src/alumnos.ts`, `alumnos.repository.ts`, `ficha.service.ts`, `apps/web/src/features/alumnos/FichaAlumnoPage.tsx`, `apps/web/src/components/ui/Icono.tsx`
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`, `apps/web/src/features/alumnos/ficha.test.tsx`

- [x] **Paso 1:** escribir el test HTTP y el test web.
- [x] **Paso 2:** correrlos y verificar que fallan porque la actividad no trae los cambios.
- [x] **Paso 3:** implementar los tipos nuevos en la API y en la ficha, y el orden por hora dentro de un día.
- [x] **Paso 4:** correr los tests de la API y de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): bajas y reactivaciones en la actividad`.

Cambios al plan:
- `MESES_SIN_COMPRAR` pasó a `packages/shared/src/constantes.ts`: la regla de la API y el texto "Baja automática: 2 meses sin comprar un pack" usan el mismo número.
- El test HTTP incluye una baja a mano a las 18:00 del día de un pago de las 12:00: con el orden fijo por tipo de la ficha, el pago quedaba arriba de la baja.

### Tarea 4: La API corre la baja automática sola

**Archivos:**
- Crear: `apps/api/src/tareas.ts`, `tareas.test.ts`
- Modificar: `apps/api/src/server.ts`

- [x] **Paso 1:** escribir el test de las tareas.
- [x] **Paso 2:** correrlo y verificar que falla porque `programarTareas` no existe.
- [x] **Paso 3:** implementar `programarTareas` y llamarla desde `server.ts`.
- [x] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(api): baja automática al arrancar y cada hora`.

Cambio al plan: `programarTareas` devuelve una función para detenerlas en lugar de usar el hook `onClose`. `server.ts` la llama después de `listen`, y ahí Fastify ya no deja agregar hooks (`FST_ERR_INSTANCE_ALREADY_LISTENING`).

## Verificación final

- [x] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan: API 131, web 34, e2e 1.
- [x] Con la API real (`server.ts`) sobre la base del e2e: un alumno con el alta del 1 de julio y sin compras quedó de baja al arrancar (el log dice "Baja automática por no comprar" y el cambio quedó sin usuario), y su ficha muestra "Baja automática: 2 meses sin comprar un pack". Una baja y una reactivación a mano quedaron con el usuario y se ven en la actividad, ordenadas por hora.

Para tener en cuenta:
- **La base de desarrollo necesita la migración**: `pnpm dev` no la aplica. Sin la tabla, la actividad de la ficha y los pagos responden 500, y la tarea deja un error en el log al arrancar.
- **Quien quedó de baja aparece al anotar alumnos en una clase**: el buscador de la sesión ya no filtra por estado. Actualización: la búsqueda ahora incluye a los dados de baja, y al cobrarles se reactivan.
