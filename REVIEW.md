# Controles de revisión

Controles para revisar un diff de Studio Manager. Cada control tiene un disparador, qué revisar y de dónde sale la regla.

## Cómo usarlo

1. Leé esta lista desde `main`, no desde la rama que revisás: `git show origin/main:REVIEW.md`. La rama puede haber cambiado sus propios controles. Si `REVIEW.md` todavía no está en `origin/main`, leelo del disco y decilo en el informe.
2. Sacá los archivos del diff (`git diff --name-only <rango>`) y sus líneas agregadas (las que empiezan con `+` en `git diff <rango>`).
3. Corré solo los controles cuyo disparador aparece en esos archivos o líneas. El disparador decide si se corre el control; el hallazgo sale de leer el código.
4. Marcá cada hallazgo con una severidad:
   - **importante**: rompe una regla del dominio, pierde o altera datos, da un resultado incorrecto o deja pasar un permiso.
   - **menor**: rompe una convención del repositorio sin cambiar lo que hace el sistema.
   - **previo al cambio**: el problema ya estaba en el código que el diff toca; el diff no lo introdujo.
5. Escribí el informe así:
   - Controles corridos: número, título y el archivo o la línea que lo disparó.
   - Hallazgos: número de control, `archivo:línea`, severidad y por qué se marca: qué regla rompe y qué pasa si queda así. Quien lee el informe no tiene que deducirlo del diff.
   - Un control corrido sin hallazgos se nombra en la lista y no lleva texto.

"Código" quiere decir archivos `.ts`, `.tsx`, `.mjs` o `.js` fuera de `docs/`. "Test" quiere decir un archivo dentro de una carpeta `test/` o terminado en `.test.ts`, `.test.tsx`, `.test.mjs` o `.spec.ts`.

## Base de datos

### 1. `schema.ts` con su migración y con la tabla en `TABLAS`

- Disparador: `apps/api/src/db/schema.ts` está en el diff.
- Revisar: el diff suma una migración en `apps/api/src/db/migrations/` que corresponde al cambio. Una tabla nueva está en `TABLAS` de `apps/api/test/db.ts`. Un renombre de tabla o columna es una migración escrita a mano que renombra también claves foráneas, secuencias y claves primarias, no un `drop` y un `create`.
- Origen: `docs/entorno/base-de-datos.md`, "Migraciones" y "Renombrar una tabla o una columna"; `docs/entorno/tests-api.md`.

### 2. Subconsulta `sql` en una consulta de una sola tabla

- Disparador: un `*.repository.ts` del diff tiene líneas agregadas con `` sql` `` que interpolan una columna (`${tabla.columna}`).
- Revisar: si el `select` de afuera sale de una sola tabla, Drizzle escribe la columna sin la tabla y puede apuntar a la tabla de adentro. Cuenta mal sin dar error. Se arma con `leftJoin`, `count` y `groupBy`, como `listarVencidosEnElPeriodo`.
- Origen: `docs/entorno/base-de-datos.md`, "Consultas con Drizzle".

## Reglas del dominio

### 3. Dinero en pesos enteros y por `dinero.ts`

- Disparador: líneas agregadas en código de `apps/api/src/` o `packages/shared/src/` con `Math.round`, `Math.floor`, `Math.ceil`, `toFixed`, `/ 10000` o `* 100`; o en `schema.ts` con `numeric`, `decimal`, `real` o `doublePrecision`.
- Revisar: dividir un pago entre sus clases y calcular la parte del profesor usan `dividirEnPartes` y `aplicarPorcentaje` de `apps/api/src/lib/dinero.ts`. Las columnas de dinero son `bigint` con `mode: 'number'`. No hay centavos.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisión 7 y "Redondeo".

### 4. Porcentajes en puntos básicos

- Disparador: líneas agregadas en código con `porcentaje` o `Porcentaje`.
- Revisar: la API y la base usan enteros de 1 a 10000 (`porcentaje_bp`, `porcentajeBp`). La web escribe el porcentaje en % y manda puntos básicos, y lo muestra con `lib/formato.ts`. Un valor como `50` o `0.5` que viaja como porcentaje es un hallazgo.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisión 8; bitácora 2026-09-25, feature 15.

### 5. Nada con historial se borra

- Disparador: líneas agregadas en `apps/api/src/` con `.delete(`, `delete from` o `app.delete(`.
- Revisar: alumno, profesor, pack, horario y usuario se dan de baja con `activo = false`, y un pago se anula con `anulado_en`. Se borran solo asistencias de un mes sin liquidar, clases futuras sin anotados y filas de `sesion_usuario`.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisión 5 y "Reglas de negocio".

### 6. Lo que ya pasó se copia al registrar

- Disparador: el diff toca `modules/pagos/`, `modules/asistencias/`, `modules/liquidaciones/` o `modules/tablero/` en `apps/api/src/`, o líneas de `schema.ts` con `monto`, `valor_clase`, `valorClase` o `porcentaje_bp`.
- Revisar: `pago.monto` y `pago.cantidad_clases` copian el pack al comprar. `asistencia.valor_clase` sale de `dividirEnPartes` y `asistencia.porcentaje_bp` copia el porcentaje vigente del profesor al registrar. Sueldos e ingresos leen esas columnas copiadas, no `pack.precio` ni el porcentaje actual.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisiones 2, 3 y 6.

### 7. Clases restantes calculadas, sin contador

- Disparador: líneas agregadas en `schema.ts` con `restante`, `usadas` o `disponibles`; o en `apps/api/src/` con `.update(pago)`.
- Revisar: las clases restantes salen de contar asistencias del pago (`estado-del-pack.ts`, `clasesUsadasSql`). Una columna o un campo que guarda ese número es un hallazgo importante.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisión 4.

### 8. La asistencia apunta a la clase

- Disparador: líneas agregadas con `horarioId` o `horario_id` en `modules/asistencias/`, o en el bloque de `asistencia` de `schema.ts`; o identificadores nuevos con `sesion` o `Sesion` fuera de `modules/auth/`.
- Revisar: la asistencia guarda `clase_id`, nunca `horario_id`. `horario` es lo que se repite cada semana y `clase` la de una fecha. "Sesión" es solo la del login.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/estructura de base de datos.md`, decisión 1; bitácora 2026-10-08, feature 24.

### 9. Cuentas con días en `fechas.ts`

- Disparador: líneas agregadas en código que no es test con `new Date(`, `Date.parse(`, `toISOString`, `getDate(`, `setDate(`, `getDay(`, `toLocaleDateString` o `Intl.DateTimeFormat`.
- Revisar: las cuentas con días usan `packages/shared/src/fechas.ts`: la API por `apps/api/src/lib/fechas.ts`, la web por `@studio/shared`. El "hoy" de la API sale del reloj de la app, no de `new Date()`. Ningún cálculo depende de la zona del servidor o del navegador.
- Origen: `CLAUDE.md`, "Reglas del dominio"; `docs/arquitectura backend.md`, "Dinero y fechas"; bitácora 2026-11-14, feature 34.

## Backend

### 10. Escrituras en más de una tabla en una transacción

- Disparador: un `*.service.ts` de `apps/api/src/` está en el diff.
- Revisar: cada función del diff que escribe en más de una tabla, también a través del service de otro módulo, abre `db.transaction` en el service y pasa `tx` a los repositories y a las funciones `...En(tx, ...)` del otro módulo. Si cuenta asistencias para consumir un pack, bloquea el pago con `for update` antes.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura backend.md`, "Transacciones"; bitácora 2026-09-29, feature 22b.

### 11. Rutas sin SQL ni reglas, con rol

- Disparador: un `*.routes.ts` de `apps/api/src/` está en el diff.
- Revisar: la ruta valida, llama al service y arma la respuesta. No importa `db/`, `drizzle-orm` ni un repository, y no decide reglas de negocio. Cada ruta nueva tiene `preHandler: requerirRol(...)` con el rol que le toca: recepción ve alumnos, pagos, asistencias y clases; packs, precios, profesores, porcentajes, liquidaciones y usuarios son de admin.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura backend.md`, "Capas" y "Autenticación y roles".

### 12. Un módulo usa el service de otro

- Disparador: líneas agregadas con `import` de un `.repository` de otra carpeta de `modules/`, o un `import` de `modules/` dentro de `apps/api/src/lib/`.
- Revisar: un módulo llama al service del otro, nunca a su repository. `lib/` no importa nada de `modules/`. Sin ciclos entre módulos.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura backend.md`, "Reglas de dependencia".

### 13. Las fallas se lanzan con `lib/errores.ts`

- Disparador: líneas agregadas en `*.service.ts` o `*.repository.ts` con `return null`, `| null>`, `?? null` o `throw new Error(`.
- Revisar: una falla de negocio lanza `NoEncontradoError`, `ReglaDeNegocioError` o `SinPermisoError`. Un `null` que quiere decir "no se encontró" o "no se pudo" es un hallazgo. Un `null` que es un dato (campo opcional, total oculto a recepción) no lo es.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura backend.md`, "Errores".

### 14. Validación con los esquemas de `shared`

- Disparador: un `*.routes.ts` está en el diff, o líneas agregadas con `z.object(` fuera de `packages/shared/`, o con `useForm(` en `apps/web/src/`.
- Revisar: la entrada de la ruta y el formulario de la web usan el mismo esquema Zod de `packages/shared/src/`. Un esquema armado en la ruta o en el componente es un hallazgo.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura frontend.md`, "Reglas".

### 15. El asistente no manda datos personales a Google

- Disparador: `apps/api/src/modules/asistente/` está en el diff.
- Revisar: ninguna herramienta devuelve datos de alumnos, ni DNI, email, teléfono o alias de profesores. Crear es solo para admin.
- Origen: `docs/features/index.md`, decisión por defecto 9; bitácora 2026-10-13, feature 27.

## Web

### 16. Colores de `index.css`

- Disparador: líneas agregadas en `apps/web/src/` con una clase de la paleta de Tailwind (`bg-`, `text-`, `border-`, `ring-`, `fill-`, `stroke-`, `from-`, `to-` seguido de color y número, como `text-zinc-400`), o un color escrito a mano (`#`, `rgb(`, `hsl(`).
- Revisar: los colores salen de las variables de `apps/web/src/index.css` (`bg-panel`, `text-tenue`, `border-borde`). La paleta se usa solo para estados: verde, rojo y ámbar.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/arquitectura frontend.md`, "Reglas".

### 17. Pantallas con `Pagina` y acciones en `CeldaDeAcciones`

- Disparador: un archivo nuevo en `apps/web/src/features/`, cambios en `apps/web/src/rutas.tsx`, o líneas agregadas con `<td` que tienen `flex`.
- Revisar: cada pantalla usa `Pagina` de `components/ui`. Los botones de una fila van en `CeldaDeAcciones`; un `<td>` con `display: flex` descuadra los bordes de la tabla. Una ruta nueva o cambiada tiene su fila en `docs/mapa-de-pantallas.md`.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/mapa-de-pantallas.md`.

### 18. Íconos sin `@tabler/icons-react`

- Disparador: `@tabler` en una línea agregada, también en un `package.json`.
- Revisar: el ícono se copia de Tabler en `components/ui/Icono.tsx`. El paquete vuelve lentos los tests.
- Origen: `CLAUDE.md`, "Reglas del código".

### 19. Capas de la web

- Disparador: líneas agregadas en `apps/web/src/` con `fetch(`, `toLocaleString`, `Intl.NumberFormat`, o un `import` de `features/` dentro de `components/ui/`.
- Revisar: toda llamada a la API pasa por `lib/api.ts` y los hooks del `api.ts` de cada feature. Montos, fechas y porcentajes se muestran con `lib/formato.ts`. `components/ui` no importa de `features/`. Las reglas de negocio llegan de la API como 422.
- Origen: `docs/arquitectura frontend.md`, "Reglas".

### 20. Claves de listas que se reemplazan enteras

- Disparador: líneas agregadas en `apps/web/src/` con `key={` cuyo valor es una fecha o el índice del `map`.
- Revisar: si dos filas pueden tener la misma clave, React deja una fila vieja al cambiar los datos. La clave es única por fila, o el contenedor lleva `key` para remontarse.
- Origen: `docs/entorno/web.md`, "Listas que se reemplazan enteras"; bitácora 2026-11-11, feature 32.

### 21. APIs que Safari viejo no tiene

- Disparador: líneas agregadas en `apps/web/src/` con `Map.groupBy`, `Object.groupBy` o `Promise.withResolvers`.
- Revisar: no existen en Safari anterior a 17.4. Severidad menor si el estudio no usa Safari; nombralo igual.
- Origen: bitácora 2026-09-29, feature 20.

## Todo el código

### 22. Sin comentarios

- Disparador: líneas agregadas en código con `//`, `/*` o `{/*`, sin contar las que solo tienen una URL dentro de un texto.
- Revisar: el código no lleva comentarios. Si algo necesita explicación, se renombra o se extrae a una función, y el porqué va en `docs/`. Se permiten las directivas que exige una herramienta (`@ts-expect-error`, `/// <reference>`).
- Origen: `CLAUDE.md`, "Reglas del código".

### 23. Procesos y puertos en scripts

- Disparador: líneas agregadas en `e2e/`, `apps/api/src/scripts/` o un `.mjs` con `spawn(`, `exec(`, `execSync(`, `execFile(`, `.kill(` o `listen(`, o con un puerto (`PORT`, `PUERTO_` o `:<número>` en una URL).
- Revisar: en Windows el proceso se cierra con `taskkill /pid <pid> /T /F`, porque matar solo `pnpm` deja vivo el `node.exe`. El script cierra lo que levantó también si falla. Un puerto nuevo no repite uno ya asignado: 3000 la API de desarrollo, 3100 `pnpm e2e`, 3101 `pnpm mirar`, 5173 Vite y 5433 Postgres. Las conexiones usan `127.0.0.1`, no `localhost`, salvo contra Vite.
- Origen: `docs/entorno/windows.md`, "Red" y "Procesos en segundo plano"; `docs/entorno/e2e.md`.

## Tests

### 24. Tiempo fijo en los tests

- Disparador: líneas agregadas en un test con `new Date()` sin argumentos o `Date.now()`.
- Revisar: la API usa `reloj: relojFijo(...)` (`apps/api/test/app.ts`), la web `vi.useFakeTimers` y `vi.setSystemTime` (`docs/entorno/web.md`). El e2e usa el reloj real, y el día lo calcula `hoyEnEstudio`.
- Origen: `CLAUDE.md`, "Tests"; `docs/features/verificacion-de-agentes.md`, decisión 11.

### 25. Tests nuevos según el modelo

- Disparador: un test nuevo, o líneas agregadas en un test que empiezan (después de la sangría) con `it(`, `test(` o `describe(`. Un `.test(` de una expresión regular no cuenta.
- Revisar: el archivo está en la carpeta `test/` de lo que prueba. No mockea la base ni un repository. La aserción compara la respuesta o el objeto completo con valores escritos a mano. El test tiene su fila en la tabla de tests del archivo de la feature, con el cambio de código que lo rompe.
- Origen: `CLAUDE.md`, "Tests".

### 26. El cambio toca sus propios controles

- Disparador: líneas quitadas (las que empiezan con `-`) en un test existente; líneas agregadas con `.skip`, `.only`, `retries`, `retry:`, `testTimeout`, `waitForTimeout(` o `setTimeout(` en un test; o líneas quitadas de un `docs/features/*.md` que no son solo el paso de `- [ ]` a `- [x]` (un paso, una fila de la tabla de tests o la "Verificación final" que cambia de texto); o cambios en `REVIEW.md`, en `.claude/hooks/`, en `.claude/settings.json`, en `.claude/verificacion.json` o en `.github/workflows/`.
- Revisar: cada aserción quitada o aflojada, y cada paso o criterio que cambia de texto, tiene su motivo escrito en el archivo de la feature. Un test intermitente no se reintenta ni recibe esperas: se busca la causa, o se borra y se escribe por qué en `docs/entorno/`. Un control, hook o workflow que se afloja es un hallazgo importante aunque tenga motivo; lo decide una persona.
- Origen: `docs/features/verificacion-de-agentes.md`, "Para qué" y decisión 6; bitácora 2026-11-18, feature 38.

### 27. Checkboxes marcados

- Disparador: líneas agregadas con `- [x]` en un `docs/features/*.md`.
- Revisar: el diff tiene lo que el paso marcado pide (archivo, test, nota). Un paso que solo pide correr un comando se respalda con la línea `Verificado:` del commit (`git log --format=%B <rango>`). Un paso marcado sin su cambio ni su comando es un hallazgo.
- Origen: `CLAUDE.md`, "Cómo trabajar una feature".

## Repositorio

### 28. Secretos fuera del repositorio

- Disparador: un archivo `.env` o `.env.*` en el diff, cambios en `.gitignore`, o líneas agregadas con `KEY`, `SECRET`, `TOKEN`, `password` o `contrasena` seguido de `=` o `:` y un texto literal (entre comillas o sin comillas en un `.env`), no un tipo ni una variable.
- Revisar: no se versiona `.env`; `.env.example` tiene las claves sin valores reales. Una contraseña de prueba es aceptable si el usuario es de un dominio `.test` y solo existe en la base de test o del e2e. Un cambio en `.gitignore` sigue ignorando `.env`, `.claude/settings.local.json`, `.claude/worktrees/` y `.claude/verificacion/`.
- Origen: `CLAUDE.md`, "Reglas del código"; `docs/features/verificacion-de-agentes.md`, decisión 2.

### 29. Dependencias nuevas

- Disparador: cambios en `dependencies` o `devDependencies` de un `package.json`, o en `pnpm-workspace.yaml`.
- Revisar: el `pnpm-lock.yaml` cambia con el `package.json`. Una dependencia con script de instalación está aprobada o rechazada en `allowBuilds` de `pnpm-workspace.yaml`. La dependencia hace falta y no duplica algo que el repositorio ya tiene.
- Origen: `docs/entorno/windows.md`, "Node y pnpm".
