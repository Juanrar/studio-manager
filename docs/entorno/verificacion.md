# Verificación: hooks, `REVIEW.md`, CI y skill `verify`

Trampas de lo que obliga a verificar un cambio. El plan está en `docs/features/verificacion-de-agentes.md`.

## `REVIEW.md`

- El revisor lo lee con `git show origin/main:REVIEW.md`, porque la rama puede haber cambiado sus propios controles. Mientras `REVIEW.md` no esté en `origin/main`, ese comando falla: el revisor lo lee del disco y lo dice en el informe.
- Cada disparador se decide mirando el diff: una ruta (`git diff --name-only`) o un texto en las líneas agregadas o quitadas. Un control nuevo cuyo disparador pide leer el código para saber si corre ("una función que escribe en dos tablas") se reescribe con una ruta o un patrón.
- Un patrón corto da falsos positivos: `it(` coincide con `split(`, `test(` con `regex.test(`, `Date.now(` con medir una duración y `password:` con un tipo. Se acota por el tipo de archivo, el principio de la línea o un literal.
- Al revisor se le pasa el rango exacto (`git diff <desde>..<hasta>`). Sin rango, mira el árbol de trabajo y no el cambio.
- Un archivo de `docs/` no dispara los controles de código. Las líneas `//` de un bloque de código dentro de un `.md` no son comentarios del código.

## `.claude/` en git

Se versionan `.claude/settings.json`, `.claude/verificacion.json`, `.claude/hooks/` y `.claude/skills/verify/`. El resto de `.claude/` sigue ignorado: los otros skills, `worktrees/`, `settings.local.json` y `verificacion/`. Para ver si un archivo entra: `git check-ignore -v <ruta>`.

## Skill `verify`

Vive en `.claude/skills/verify/SKILL.md` y usa `pnpm mirar`. Las trampas de `pnpm mirar` están en `e2e.md`.

## Línea `Verificado:`

Va en cada commit, después de una línea en blanco: `Verificado: pnpm test, pnpm typecheck, pnpm mirar` o `Verificado: ninguno (motivo)`. Un mensaje de varias líneas se commitea desde Git Bash con `git commit -F -` y un heredoc (ver `windows.md`).

## Hooks

Están en `.claude/settings.json` y `.claude/hooks/`. El modo del control de commit está en `.claude/verificacion.json` (`apagado`, `observar` o `bloquear`); sin ese archivo, o con un valor desconocido, el control observa. El estado por sesión y `registro.jsonl` van en `.claude/verificacion/`, que git ignora. Los tests corren con `pnpm test:hooks`, que es parte de `pnpm test`.

Cómo se activan:

- En Windows, Claude Code corre el `command` de cada hook con Git Bash. `node "$CLAUDE_PROJECT_DIR/.claude/hooks/x.mjs"` funciona así.
- El 2026-11-21 los hooks se cargaron en vivo: se escribió `settings.json` en medio de la sesión y la llamada siguiente ya corrió el hook, sin reiniciar. La documentación dice que el watcher de archivos levanta los cambios. Si un hook no corre, se mira en `/hooks` o se reinicia Claude Code.
- Para probar un hook a mano: `echo '{"session_id":"x","hook_event_name":"Stop","stop_hook_active":false}' | CLAUDE_PROJECT_DIR="$PWD" node .claude/hooks/al-terminar.mjs; echo $?`. Sin `CLAUDE_PROJECT_DIR`, el hook usa el `cwd` de la entrada.

Qué registra y qué cuenta:

- Solo `pnpm test` y `pnpm typecheck` de la raíz cuentan para el control. `pnpm --filter @studio/api test` o `pnpm -r test` quedan guardados con su filtro (`test --filter @studio/api`), pero no reemplazan a `pnpm test`: el de la raíz también corre `test:hooks`, y un paquete solo no muestra si se rompió otro. Lo mismo con `pnpm mirar` y `pnpm e2e` para la regla de `apps/web/`: cuenta el de la raíz, no `pnpm --filter @studio/e2e mirar`.
- Un comando se reconoce dentro de una cadena con `&&`, `||`, `;` o `|`, con variables delante (`MSYS_NO_PATHCONV=1 pnpm mirar /x`) y con `pnpm run test`. No cuentan `pnpm test:watch`, `pnpm test:hooks` ni un `echo "pnpm test"`. El cuerpo de un heredoc no se lee como comandos.
- Un Bash que sale con código distinto de 0 dispara `PostToolUseFailure`, no `PostToolUse`, así que un `pnpm test` en rojo no se guarda. Pero `pnpm test | tail -20` sale con el código de `tail`, y `pnpm test > x.txt; echo $?` con el de `echo`: se guardan aunque los tests fallen.
- El último cambio de código sale de `Edit`, `Write`, `MultiEdit` y `NotebookEdit` sobre `apps/`, `packages/` o `e2e/`. Un archivo cambiado con `sed -i`, `cat >` o un script desde Bash no cuenta como cambio. Se vio en la prueba del 2026-11-21: tres `sed -i` sobre `dinero.ts` no movieron la hora.
- `cd apps/api && pnpm test` cuenta como el `pnpm test` de la raíz: el hook no sigue los `cd`.
- Un Bash con `run_in_background: true` dispara `PostToolUse` cuando arranca, no cuando termina, así que el hook no guarda sus comandos: el resultado todavía no se conoce. Para que cuente, `pnpm test` va en primer plano. Si se corrió en segundo plano, se vuelve a correr en primer plano o el commit lleva `Verificado: ninguno (motivo)`.

Cómo arma el commit:

- El mensaje sale de `-m` (uno o varios), de `--message=`, del heredoc de `-F -` o del archivo de `-F archivo` (relativo a la raíz del proyecto). Con `-F -` sin heredoc, por ejemplo `echo ... | git commit -F -`, busca la línea en todo el comando. Una línea `Verificado:` vacía cuenta como que falta.
- Los archivos son los de `git diff --cached --name-only`, más las rutas de un `git add` o de un `git commit <rutas>` del mismo comando. Con `git add -A`, `git add .`, `git add -u`, un glob o `git commit -a`, suma todo lo que muestra `git status --porcelain`, también lo que no se va a commitear. Puede pedir verificación de más, nunca de menos.
- Un `git commit` dentro de `bash -c "..."`, de un script o de un alias no se ve.
- El modo se lee cuando el hook corre, antes del comando. Un `printf ... > .claude/verificacion.json && git commit` usa el modo viejo.
- Cada commit deja una línea en `registro.jsonl`, pase o no, con `resultado`: `verificado`, `sin verificar` (`Verificado: ninguno (motivo)`), `observado`, `bloqueado` o `liberado`. Así se revisa al final de la feature si hubo falsos positivos.
- En `bloquear`, el contador de bloqueos vuelve a 0 cuando un commit pasa, también el liberado. Sin eso, después de la primera liberación todo pasaría.

Subagentes:

- En la prueba del 2026-11-21, las llamadas de un subagente llegaron con el `session_id` de la sesión principal y con `agent_id`. El estado y el contador de bloqueos se comparten: un `pnpm test` del subagente cuenta para un commit de la sesión principal. El registro guarda `agente` para distinguirlos. Falta confirmarlo con un hook disparado desde la sesión principal en la misma sesión.
- `Stop` no corre para un subagente (para eso existe `SubagentStop`, que no se usa). `al-terminar.mjs` se probó por stdin.

`al-terminar.mjs`:

- Corre `pnpm typecheck` completo cuando `git status` muestra cambios en `apps/`, `packages/` o `e2e/`. Tardó 7 s en esta máquina. El timeout es de 300 s.
- En Windows `pnpm` es `pnpm.cmd` y `spawnSync` lo necesita con `shell: true`.
- Si `stop_hook_active` es `true`, sale con 0 sin correr nada. Además, Claude Code deja de hacer caso al bloqueo después de ocho seguidos.

## Limitaciones conocidas

- Un paso con el mismo texto en dos tareas se marca de más si el checkbox se marca con un reemplazo global (`replace_all` o `sed` sin contexto). Pasó en la tarea 4 de `verificacion-de-agentes.md`: se marcó también el paso 6 de la tarea 5. Se marca con `Edit` y un `old_string` que incluya texto propio de la tarea.

## CI

El workflow es `.github/workflows/verificacion.yml`. Corre en cada PR a `main` y en cada push a `main`: `pnpm typecheck`, `pnpm test` y `pnpm e2e`, en `ubuntu-latest`. El repositorio es público, así que los minutos de GitHub Actions no se cobran. Se mantiene así: un solo job, nada de `macos` ni `windows`, `timeout-minutes: 25` y `concurrency` con `cancel-in-progress`, que corta la corrida vieja cuando llega otro push a la misma rama.

- `pnpm/action-setup` toma la versión de pnpm de `packageManager` en el `package.json` de la raíz. Al fijarla, pnpm 12 agrega al `pnpm-lock.yaml` un bloque `packageManagerDependencies` con los binarios de pnpm de cada sistema. Es esperable y va en el mismo commit.
- `pnpm test` usa Testcontainers, que en `ubuntu-latest` anda con el Docker del runner. `pnpm e2e` usa el Postgres de `docker compose` en el puerto 5433, el mismo de `.env.example`, que el workflow copia a `apps/api/.env`.
- Si `pnpm e2e` falla, `e2e/test-results/` queda como artefacto de la corrida durante 7 días: capturas y trazas de Playwright.
- Para validar el archivo: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/repo" -w /repo rhysd/actionlint:latest`. Sin `MSYS_NO_PATHCONV`, Git Bash convierte `/repo` en una ruta de Windows. actionlint no chequea que la versión de una acción exista: se mira con `git ls-remote --tags https://github.com/actions/checkout.git`.

Para que el check sea obligatorio, en GitHub: Settings → Branches → regla de protección de `main` (o Settings → Rules → Rulesets) → "Require status checks to pass before merging" → elegir el check `verificacion`. El check aparece en la lista recién después de que el workflow corrió una vez.

El CI lee el workflow de la rama del PR, no el de `main`. Un PR puede cambiar `verificacion.yml` y sacar un paso, y el check sale verde igual. En la revisión humana de un PR se mira si tocó `.github/workflows/`.
