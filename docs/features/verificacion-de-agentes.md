# Verificación de los agentes

**Estado:** en curso  
**Depende de:** e2e-y-produccion  
**Listo cuando:** un agente puede levantar la app con datos y mirar una pantalla con un solo comando; un commit sin verificar queda registrado (y bloqueado cuando el modo es `bloquear`); `REVIEW.md` tiene la lista de controles por diff; hay tests de propiedades para dinero, fechas y estado del pack; hay más flujos E2E; GitHub Actions corre `pnpm typecheck`, `pnpm test` y `pnpm e2e` en cada PR a `main`.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md), [el índice de features](index.md), [docs/entorno/windows.md](../entorno/windows.md) y [docs/entorno/e2e.md](../entorno/e2e.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Para qué

Sale de comparar el repositorio con el artículo "How the Claude Code team thinks about verification" (Addy Osmani, claude.dev, 2026-11-16). El repositorio ya tiene tests contra Postgres real, reloj fijo, un E2E con Playwright y notas de entorno. Le falta lo que obliga a verificar:

- La forma de levantar la app y mirarla está en prosa en `docs/entorno/e2e.md` y los scripts de capturas viven fuera del repositorio. Cada agente los rearma.
- No hay hooks, ni CI, ni registro de cómo se verificó un commit. Los checkboxes los marca el mismo agente que escribió el código.
- El cambio puede modificar sus propios checks: el archivo de la feature, los tests y la verificación final están en la misma rama.
- No hay tests de propiedades, y el dominio tiene invariantes justas para eso.
- Hay un solo flujo E2E.
- No hay tope de intentos ni regla para tests intermitentes. La bitácora del 2026-11-18 registra un test de la grilla que "falló una vez suelto y pasó al repetir".

## Qué se decidió

Decisiones tomadas con el estudio el 2026-11-21. No se vuelven a discutir en la ejecución.

1. **Skill `verify` en `.claude/skills/verify/`**, versionado. Usa un script del repositorio, `e2e/mirar.ts`, que se corre con `pnpm mirar`.
2. **`.claude/` deja de estar ignorada por completo.** Se versionan `.claude/settings.json`, `.claude/hooks/` y `.claude/skills/verify/`. El resto sigue ignorado: los otros skills son herramientas locales, y `worktrees/` y `settings.local.json` son de cada máquina.
3. **Hooks del proyecto en Node (`.mjs`)**, sin dependencias, para que arranquen rápido. Sus tests corren con `node --test` y entran en `pnpm test`.
4. **El control de commit arranca en modo `observar`.** Registra lo que habría bloqueado. Se pasa a `bloquear` a mano en `.claude/verificacion.json` cuando el registro muestre que no hay falsos positivos.
5. **Cada commit lleva una línea `Verificado:`** que dice qué se corrió, o `Verificado: ninguno (motivo)`.
6. **Después de tres intentos fallidos sobre el mismo problema, el agente para y avisa.** Un test intermitente no se reintenta ni se le agregan esperas.
7. **`REVIEW.md` en la raíz**, con controles que se disparan según lo que toca el diff. El subagente revisor lo lee desde `origin/main`, no desde la rama.
8. **Tests de propiedades con `fast-check`.**
9. **GitHub Actions** con los límites que se acordaron: solo `ubuntu-latest`, en `pull_request` y `push` a `main`, `concurrency` con `cancel-in-progress` y `timeout-minutes`. El repositorio es público, así que los minutos no se cobran.
10. **Queda afuera** el test diferencial contra la app de Java Swing (decisión del estudio).
11. **El E2E sigue con el reloj real.** La API no tiene forma de fijar la hora fuera de los tests, y agregarla al servidor de producción no vale el riesgo. La falla posible es una corrida que cruza la medianoche de Buenos Aires; queda escrita en `docs/entorno/e2e.md`.

## Cómo queda

- `e2e/mirar.ts`: prepara la base `studio_manager_e2e`, carga datos de ejemplo por la API, levanta la API en el puerto 3101 sirviendo el frontend compilado, entra con Chromium como admin o recepción, recorre las rutas pedidas y guarda una captura por ruta en `e2e/capturas/` (ignorada por git). Junta errores de consola, errores de página y respuestas de la API con estado 400 o más. Imprime un resumen y sale con código 1 si hubo errores. Siempre cierra la API, también si falla.
- `e2e/datos-de-ejemplo.ts`: carga por la API un profesor, dos horarios, alumnos con y sin pack, un pago y asistencias. Lo usa `mirar.ts`.
- `e2e/preparar.ts`: la preparación de la base pasa a una función que usan `pnpm e2e` y `pnpm mirar`.
- `docs/mapa-de-pantallas.md`: cada ruta de `apps/web/src/rutas.tsx` con el rol que la ve, qué tiene que mostrar con los datos de ejemplo y qué features la tocan. El skill lo usa para elegir qué mirar.
- `.claude/skills/verify/SKILL.md`: cuándo verificar, cómo correr `pnpm mirar`, cómo leer las capturas con `Read`, qué buscar y cuándo parar.
- `.claude/settings.json`: los hooks del proyecto.
- `.claude/hooks/`: `registrar-verificacion.mjs`, `control-de-commit.mjs`, `al-terminar.mjs`, la lógica compartida y sus tests en `.claude/hooks/test/`.
- `.claude/verificacion.json`: `{ "modo": "observar" }`. Valores posibles: `apagado`, `observar`, `bloquear`.
- `.claude/verificacion/`: estado por sesión y `registro.jsonl`. Ignorada por git.
- `REVIEW.md`: los controles por diff.
- `CLAUDE.md`: reglas de intentos, tests intermitentes, línea `Verificado:` y la línea nueva en "Antes de tocar".
- `docs/entorno/verificacion.md`: trampas de los hooks, del skill y del CI.
- Tests de propiedades en `apps/api/src/lib/test/`, `packages/shared/src/test/` y `apps/api/src/modules/pagos/test/`.
- Flujos E2E nuevos en `e2e/`.
- `.github/workflows/verificacion.yml`.

### Cómo funcionan los hooks

- **`registrar-verificacion.mjs`** corre en `PostToolUse`. Con `Edit` o `Write` sobre un archivo de `apps/`, `packages/` o `e2e/`, guarda la hora del último cambio de código. Con `Bash`, si el comando corrió `pnpm test`, `pnpm typecheck`, `pnpm e2e` o `pnpm mirar`, guarda la hora de cada uno. `PostToolUse` solo corre cuando la herramienta terminó bien. El estado va en `.claude/verificacion/<session_id>.json`.
- **`control-de-commit.mjs`** corre en `PreToolUse` con `Bash`. Si el comando tiene `git commit`, revisa:
  1. que el mensaje tenga una línea `Verificado:`;
  2. que `pnpm test` y `pnpm typecheck` hayan corrido después del último cambio de código;
  3. si hay archivos de `apps/web/` en stage, que `pnpm mirar` o `pnpm e2e` hayan corrido después del último cambio.

  Un commit con `Verificado: ninguno (motivo)` pasa siempre y queda en el registro. Un commit sin archivos de `apps/`, `packages/` ni `e2e/` solo necesita la línea `Verificado:`. En modo `observar`, lo que falla se escribe en `registro.jsonl` y el commit pasa. En modo `bloquear`, el hook sale con código 2 y explica qué falta. Después de dos bloqueos en la misma sesión, el tercer commit pasa y queda registrado como liberado.
- **`al-terminar.mjs`** corre en `Stop`. Si `stop_hook_active` es `true`, o si `git status` no muestra cambios en `apps/`, `packages/` ni `e2e/`, sale enseguida. Si no, corre `pnpm typecheck`. Si falla, sale con código 2 y las últimas 40 líneas de la salida, para que el agente lo arregle antes de terminar. No corre la suite: la de la API necesita Docker y tarda demasiado para cada vuelta.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| `registrar-verificacion` guarda la hora de `pnpm test` y de `pnpm --filter @studio/api test`, pero no la de `pnpm test:watch` ni la de un `echo pnpm test` | Unitario de hook, `node --test` | Reconocer el comando con un `includes` suelto |
| `registrar-verificacion` guarda el último cambio de código para `apps/web/src/x.tsx` y lo ignora para `docs/x.md` | Unitario de hook | Contar cambios de documentación como código y pedir tests de más |
| El control deja pasar un commit con `Verificado:` y tests y typecheck posteriores al último cambio | Unitario de hook | Bloquear un commit verificado |
| El control marca un commit cuyo `pnpm test` es anterior al último cambio de código | Unitario de hook | Comparar contra la hora del primer cambio o no comparar |
| El control marca un commit sin línea `Verificado:` | Unitario de hook | Dejar de exigir la línea |
| El control deja pasar `Verificado: ninguno (motivo)` y lo registra | Unitario de hook | Bloquear la salida que el agente tiene para explicar |
| Con archivos de `apps/web/` en stage, el control pide `pnpm mirar` o `pnpm e2e` | Unitario de hook | Dejar pasar cambios de pantalla sin mirarlos |
| En modo `observar` el control sale con 0 y escribe en `registro.jsonl`; en `bloquear` sale con 2; en `apagado` no escribe nada | Unitario de hook | Confundir los modos |
| En modo `bloquear`, el tercer commit de la sesión después de dos bloqueos pasa y queda registrado como liberado | Unitario de hook | Perder la válvula y dejar al agente trabado |
| `al-terminar` sale con 0 sin correr nada si `stop_hook_active` es `true` | Unitario de hook | Un ciclo infinito de `Stop` |
| `aplicarPorcentaje(m, bp)` da entre 0 y `m`, da `m` con 10000, crece con `bp`, y `aplicarPorcentaje(m, bp) + aplicarPorcentaje(m, 10000 - bp)` se aleja de `m` en 1 como mucho | Propiedad, `fast-check` | Cambiar el redondeo, o dividir por 100 en lugar de 10000 |
| `dividirEnPartes(t, n) * n` se aleja de `t` en `n / 2` como mucho | Propiedad | Truncar en lugar de redondear |
| `sumarDias(sumarDias(f, n), -n)` es `f`, y el resultado siempre es una fecha válida | Propiedad | Un error de fin de mes o de año bisiesto |
| `lunesDe(f)` es lunes, no es posterior a `f` y está a menos de 7 días | Propiedad | Tomar el domingo como inicio de semana |
| `sumarMeses(f, n)` es una fecha válida, en el mes que corresponde, y su día no supera al de `f` | Propiedad | No recortar al último día del mes |
| `estadoDelPack`: con pagos que usaron como mucho las clases del pack, las clases restantes del pago actual están entre 0 y las del pack; sin pagos, el estado es `sin_pack` | Propiedad | Restar al revés o guardar un contador |
| Los flujos E2E nuevos (ver tarea 5) | E2E | Lo que cada uno describe en su `test.step` |

Los tests de propiedades se prueban rompiendo el código a propósito: se cambia un `Math.round` por `Math.ceil` (o la función que corresponda), se ve que el test falla con un contraejemplo y se vuelve atrás.

---

### Tarea 1: Skill `verify` y `pnpm mirar`

**Archivos:**
- Crear: `e2e/mirar.ts`, `e2e/datos-de-ejemplo.ts`, `docs/mapa-de-pantallas.md`, `.claude/skills/verify/SKILL.md`
- Modificar: `e2e/preparar.ts`, `e2e/package.json`, `package.json`, `.gitignore`, `docs/entorno/e2e.md`

- [x] **Paso 1:** cambiar `.gitignore` para versionar `.claude/settings.json`, `.claude/verificacion.json`, `.claude/hooks/` y `.claude/skills/verify/`, e ignorar `.claude/verificacion/` y `e2e/capturas/`. Verificar con `git check-ignore -v` que los otros skills, `worktrees/` y `settings.local.json` siguen ignorados.
- [x] **Paso 2:** pasar la preparación de la base de `preparar.ts` a una función exportada, con una opción para no compilar el frontend. `pnpm e2e` sigue igual.
- [x] **Paso 3:** escribir `datos-de-ejemplo.ts` y `mirar.ts`. Argumentos: una o más rutas, `--rol admin|recepcion` (por defecto admin), `--sin-preparar` (usa la base y el `dist` que ya están) y `--ancho <px>` para pantallas angostas. Antes de la captura hace scroll de los `.overflow-auto` (ver `docs/entorno/e2e.md`). En Windows cierra la API con `taskkill /pid <pid> /T /F`. Agregar `"mirar"` a `e2e/package.json` y a la raíz.
- [x] **Paso 4:** correr `pnpm mirar /alumnos /liquidaciones /grilla` y abrir las capturas con `Read`. Tienen que mostrar los datos de ejemplo. Verificar con `netstat -ano` que el puerto 3101 quedó libre.
- [x] **Paso 5:** romper a propósito una pantalla (por ejemplo, un `throw` en un componente), correr `pnpm mirar` sobre esa ruta y verificar que sale con código 1 y nombra el error. Volver atrás.
- [x] **Paso 6:** correr `pnpm mirar --sin-preparar` tres veces seguidas sobre las mismas rutas. Las tres pasan; anotar el tiempo de cada una en `docs/entorno/e2e.md`.
- [x] **Paso 7:** escribir `docs/mapa-de-pantallas.md` y `.claude/skills/verify/SKILL.md`. El skill dice: usarlo antes de cerrar una tarea que toca `apps/web/` o una respuesta de la API que una pantalla muestra; elegir las rutas con el mapa; leer cada captura con `Read`; comparar con lo que pide la feature; tres intentos fallidos y se avisa. Reemplazar en `docs/entorno/e2e.md` las notas de "scripts fuera del repo" por `pnpm mirar`.
- [x] **Paso 8:** correr `pnpm typecheck` y `pnpm test`, y verificar que pasan.
- [x] **Paso 9:** commit `feat(verificacion): skill verify y pnpm mirar para ver la app con datos`.

Correcciones al plan hechas en la tarea 1 (2026-11-21):

- `e2e/tsconfig.json` también cambia: suma `dom` a `lib`, porque `mirar.ts` usa `document` dentro de `page.evaluate`.
- El script no hace scroll antes de la única captura: bajar hasta el final esconde la parte de arriba. Saca la captura de arriba y, si algún `.overflow-auto` tiene scroll, una segunda captura `-abajo`. En la grilla de 800 px de alto, las clases de la tarde solo se ven en esa.
- Los ids de los datos de ejemplo dependen de lo que ya tenía la base, y `/liquidaciones` sin `periodo` abre el mes anterior, vacío con los datos de ejemplo. Por eso las rutas aceptan las marcas `:alumno`, `:alumno-sin-pack`, `:profesor`, `:clase` y `:periodo`, y el resumen imprime los ids.
- `--rol recepcion` necesita un usuario de recepción: los datos de ejemplo crean `recepcion@estudio.test`. Sus credenciales están en `datos-de-ejemplo.ts`, no en `entorno.ts`, porque `pnpm e2e` no las usa.
- Con `--sin-preparar`, el script busca los datos de ejemplo por nombre y los carga si faltan, por ejemplo después de `pnpm e2e`. Cargarlos dos veces duplicaría los alumnos y la asistencia fallaría.
- Git Bash convierte `/alumnos` en `C:/Program Files/Git/alumnos` antes de que llegue a `pnpm`. El script reconoce una ruta de Windows y sale con código 2 pidiendo `MSYS_NO_PATHCONV=1`.
- El paso 5 deja el `dist` compilado con el `throw`. Antes de las corridas con `--sin-preparar` del paso 6 hace falta una corrida completa para recompilar.
- Para la tarea 5: con recepción, `/liquidaciones` no redirige. `SoloAdmin` muestra "No tenés permiso para ver esta pantalla.". El paso 1 de la tarea 5 queda corregido.

### Tarea 2: Reglas de verificación y `REVIEW.md`

**Archivos:**
- Crear: `REVIEW.md`, `docs/entorno/verificacion.md`
- Modificar: `CLAUDE.md`

- [ ] **Paso 1:** escribir `REVIEW.md`. Cada control tiene un disparador que se lee en el diff, qué revisar y de dónde sale (regla de `CLAUDE.md`, documento de `docs/` o línea de la bitácora). Como mínimo, uno por cada regla del dominio y del código de `CLAUDE.md`: `schema.ts` sin migración o sin la tabla en `TABLAS`; cuentas con dinero fuera de `dinero.ts`; porcentajes que no están en puntos básicos; borrado de filas con historial; `pago.monto`, `asistencia.valor_clase` o `asistencia.porcentaje_bp` que no se copian al registrar; contador de clases guardado; asistencia que apunta al horario; cuentas con días fuera de `fechas.ts`; escritura en más de una tabla sin transacción; SQL o reglas de negocio en una ruta; un módulo que usa el repository de otro; `null` para indicar una falla; validación de entrada sin los esquemas de `shared`; `new Date()` en un test; comentarios en el código; colores de la paleta de Tailwind fuera de los estados; `<td>` con `display: flex`; `@tabler/icons-react`. Al principio, una línea: el revisor corre solo los controles cuyo disparador aparece en el diff, y marca cada hallazgo como importante, menor o previo al cambio.
- [ ] **Paso 2:** sumar a `CLAUDE.md`, en "Cómo trabajar una feature": la línea `Verificado:` en cada commit, con su formato; el tope de tres intentos sobre el mismo problema antes de avisar; la regla de tests intermitentes (no se reintenta, no se agregan esperas; se busca la causa, o se borra el test y se escribe por qué en `docs/entorno/`); que el subagente revisor lee `REVIEW.md` con `git show origin/main:REVIEW.md` y no la copia de la rama; y que una tarea que toca pantallas se cierra con el skill `verify`.
- [ ] **Paso 3:** crear `docs/entorno/verificacion.md` con lo que se sepa hasta acá y sumar su línea en "Antes de tocar" de `CLAUDE.md`.
- [ ] **Paso 4:** correr el subagente revisor sobre el diff de la tarea 1 con `REVIEW.md` y verificar que corre solo los controles que corresponden. Si un control no se puede decidir mirando el diff, reescribir su disparador.
- [ ] **Paso 5:** commit `docs(verificacion): REVIEW.md y reglas de verificación`.

### Tarea 3: Hooks de verificación

**Archivos:**
- Crear: `.claude/settings.json`, `.claude/verificacion.json`, `.claude/hooks/registrar-verificacion.mjs`, `.claude/hooks/control-de-commit.mjs`, `.claude/hooks/al-terminar.mjs`, `.claude/hooks/estado.mjs`, `.claude/hooks/test/*.test.mjs`
- Modificar: `package.json`, `docs/entorno/verificacion.md`

- [ ] **Paso 1:** escribir los tests de hooks de la tabla en `.claude/hooks/test/`. Cada test llama a la función con la entrada JSON que manda Claude Code y una carpeta de estado temporal; no lanza procesos de Claude.
- [ ] **Paso 2:** agregar `"test:hooks": "node --test \".claude/hooks/test/*.test.mjs\""` y sumarlo al `test` de la raíz. Correrlo y verificar que falla porque los hooks no existen.
- [ ] **Paso 3:** escribir los hooks. La lógica va en funciones exportadas; el archivo que llama Claude Code solo lee la entrada de `stdin`, llama a la función y sale con el código que devuelve. Sin comentarios en el código.
- [ ] **Paso 4:** correr `pnpm test:hooks` y verificar que pasa.
- [ ] **Paso 5:** escribir `.claude/settings.json` con los tres hooks, usando `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<archivo>.mjs"`, y `.claude/verificacion.json` en `observar`.
- [ ] **Paso 6:** probarlos de verdad en una rama descartable: editar un archivo de `apps/`, intentar un commit sin `Verificado:` y ver la línea en `registro.jsonl`; pasar a `bloquear`, ver el bloqueo y la explicación, y ver que el tercer intento pasa. Verificar si un subagente comparte el `session_id` de la sesión principal y escribirlo en `docs/entorno/verificacion.md`. Volver a `observar` y borrar la rama.
- [ ] **Paso 7:** correr `pnpm typecheck` y `pnpm test`, y verificar que pasan.
- [ ] **Paso 8:** commit `feat(verificacion): hooks que registran y controlan la verificación`.

### Tarea 4: Tests de propiedades

**Archivos:**
- Crear: `apps/api/src/lib/test/dinero.propiedades.test.ts`, `packages/shared/src/test/fechas.propiedades.test.ts`, `apps/api/src/modules/pagos/test/estado-del-pack.propiedades.test.ts`
- Modificar: `apps/api/package.json`, `packages/shared/package.json`

- [ ] **Paso 1:** agregar `fast-check` como dependencia de desarrollo en `apps/api` y `packages/shared`.
- [ ] **Paso 2:** escribir los tests de propiedades de la tabla. Las fechas se generan como días entre 1900 y 2200 y se pasan a `FechaDia`; nada usa `new Date()` sin argumento. Cada propiedad corre con la semilla que elige `fast-check` y, si falla, el mensaje muestra la semilla y el contraejemplo.
- [ ] **Paso 3:** correrlos y verificar que pasan.
- [ ] **Paso 4:** por cada archivo, romper la función a propósito y verificar que el test falla con un contraejemplo. Volver atrás. Anotar en la tabla de tests qué se rompió.
- [ ] **Paso 5:** si una propiedad encuentra un error real en el código, escribir el contraejemplo como test de ejemplo común en el archivo de tests que ya existe, arreglarlo y dejarlo escrito en la bitácora.
- [ ] **Paso 6:** correr `pnpm typecheck` y `pnpm test`, y verificar que pasan.
- [ ] **Paso 7:** commit `test(dominio): propiedades de dinero, fechas y estado del pack`.

### Tarea 5: Más flujos de punta a punta

**Archivos:**
- Crear: `e2e/recepcion.spec.ts`, `e2e/pagos.spec.ts`
- Modificar: `docs/entorno/e2e.md`, `docs/mapa-de-pantallas.md` si hace falta

- [ ] **Paso 1:** `recepcion.spec.ts`: un usuario de recepción entra, ve solo su menú, abre la grilla, entra a una clase de hoy desde la grilla y anota a un alumno con pack. Un intento de ir a `/liquidaciones` muestra "No tenés permiso para ver esta pantalla." y no muestra datos de liquidaciones.
- [ ] **Paso 2:** `pagos.spec.ts`: se registra un pack a un alumno, se anula con motivo y el listado de alumnos deja de mostrarlo vigente.
- [ ] **Paso 3:** los datos que necesita cada spec los crea el mismo spec por la API o la pantalla. Ningún spec depende de lo que dejó otro.
- [ ] **Paso 4:** correr `pnpm e2e` y verificar que pasan los tres specs. Correrlo dos veces más; si uno falla una sola vez, se busca la causa antes de seguir (regla de tests intermitentes).
- [ ] **Paso 5:** sumar a `docs/entorno/e2e.md` la nota de la medianoche (decisión 11) y el tiempo total de `pnpm e2e`.
- [ ] **Paso 6:** correr `pnpm typecheck` y `pnpm test`, y verificar que pasan.
- [ ] **Paso 7:** commit `test(e2e): flujos de recepción y de anulación de un pago`.

### Tarea 6: GitHub Actions

**Archivos:**
- Crear: `.github/workflows/verificacion.yml`
- Modificar: `docs/entorno/verificacion.md`, `package.json` si hace falta fijar `packageManager`

- [ ] **Paso 1:** escribir el workflow: `on` con `pull_request` y `push` a `main`; `concurrency` por rama con `cancel-in-progress: true`; un job en `ubuntu-latest` con `timeout-minutes: 25`. Pasos: checkout, pnpm, Node 22 con caché de pnpm, `pnpm install --frozen-lockfile`, copiar `.env.example` a `apps/api/.env`, `pnpm typecheck`, `pnpm test`, `docker compose up -d --wait`, `pnpm e2e`, y subir `e2e/test-results/` como artefacto solo si falla, con `retention-days: 7`. Las acciones van con versión fija.
- [ ] **Paso 2:** validar el archivo con `actionlint` (por ejemplo, `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`). Verificar que pasa.
- [ ] **Paso 3:** escribir en `docs/entorno/verificacion.md` cómo pedir el check en la protección de `main` (Settings → Branches) y que el CI lee el workflow de la rama del PR: un PR puede cambiarlo, y la revisión humana del PR tiene que mirar ese archivo.
- [ ] **Paso 4:** correr `pnpm typecheck` y `pnpm test`, y verificar que pasan.
- [ ] **Paso 5:** commit `ci: typecheck, tests y e2e en cada PR a main`. El push lo decide el estudio.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] `pnpm e2e` pasa.
- [ ] `pnpm mirar /agenda /alumnos /liquidaciones` pasa y las capturas muestran datos.
- [ ] `registro.jsonl` tiene las entradas de los commits de esta feature, y ninguna es un falso positivo. Si hay alguno, se corrige el hook antes de cerrar.
- [ ] Bitácora del índice y notas en `docs/entorno/verificacion.md` y `docs/entorno/e2e.md`.
