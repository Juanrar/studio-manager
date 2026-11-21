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

## Hooks y CI

Todavía no existen: son las tareas 3 y 6 de la feature. Sus trampas van acá.
