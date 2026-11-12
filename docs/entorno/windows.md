# Windows y shell

Trampas de trabajar en Windows 10 con Git Bash y PowerShell 5.1.

## Red

`localhost` resuelve a `::1`. Docker Desktop publica solo en IPv4 y la API escucha en IPv4. Consecuencias:

- **Testcontainers:** `apps/api/test/global-setup.ts` define `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1`.
- **Proxy de Vite:** apunta a `127.0.0.1:3000`, no a `localhost:3000`.
- **Vite escucha solo en `[::1]:5173`.** Un `curl` a `127.0.0.1:5173` queda colgado; usá `localhost:5173`.

## Procesos en segundo plano

Cortar una tarea en segundo plano que levantó `pnpm dev` o la API con `tsx` deja vivos la API, Vite o el `node.exe` del servidor. Antes de volver a levantarlos:

1. Buscá el PID con `netstat -ano` en el puerto (3000, 5173 o el que uses).
2. Cerralo.

Si no, el pedido siguiente habla con el código viejo. Un proceso que no es de este proyecto no se cierra.

## Git Bash

- **Convierte en ruta de Windows** cualquier argumento que empieza con `/` (`/agenda` pasa a `C:/Program Files/Git/agenda`). Se evita con `MSYS_NO_PATHCONV=1`.
- **`curl -d` manda mal las tildes** y la API responde "Request body size did not match Content-Length". Para cargar datos con acentos, usá un script de Node con `fetch`.

## PowerShell 5.1

- **Parte los argumentos con comillas dobles** que van a un programa: `git commit -m` con un mensaje que tiene `"Hoy"` falla con `pathspec ... did not match`. Se commitea desde Bash con `git commit -F -` y un heredoc.
- **`2>&1` con `pnpm`** hace que el resultado salga como error aunque el comando pase.

## Node y pnpm

- **Node 22.12 no ejecuta `.ts` sin flag.** Los scripts usan `tsx`.
- **pnpm 12 bloquea los scripts de instalación** de las dependencias. Se aprueban o rechazan en `allowBuilds` de `pnpm-workspace.yaml`. Hoy: `esbuild` sí; `cpu-features`, `ssh2` y `protobufjs` no (vienen con testcontainers y no hacen falta).

## Repositorio

- **Un worktree nuevo no tiene `apps/api/.env`** (git lo ignora): `pnpm e2e` falla en el seed con `.env: not found`. Se copia el `.env.example` de la raíz.
- **`vitest run --reporter=json`** escribe `.vitest/json/output.json` dentro del paquete, que git no ignora. Pasá `--outputFile` con una ruta fuera del repositorio.
