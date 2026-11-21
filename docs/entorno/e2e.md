# E2E y ver la app en Chromium

## `pnpm e2e`

- No corre dentro de `pnpm test`. Necesita Docker, compila el frontend y usa la base `studio_manager_e2e`, que se borra y se crea en cada corrida.
- Usa el Postgres de desarrollo (puerto 5433). Si falla con `ECONNREFUSED 127.0.0.1:5433`, el contenedor está apagado: `docker start studio-manager-db`. Desde un worktree, `docker compose up` falla porque el nombre del contenedor ya existe y deja un volumen vacío con el nombre de la carpeta.
- Usa el reloj real: crea la clase para el día de hoy en Buenos Aires. La API no tiene forma de fijar la hora fuera de los tests (decisión 11 de `verificacion-de-agentes.md`). Una corrida que cruza la medianoche de Buenos Aires puede fallar: el spec calcula "hoy" al empezar y la API ya está en el día siguiente. Si falla cerca de las 00:00, se vuelve a correr después; no es un test intermitente.
- Corre con `workers: 1` (`e2e/playwright.config.ts`): los specs comparten la base. `flujo-principal.spec.ts` lee los ingresos del mes por la API antes de cobrar y espera los previos más $6.700, porque `recepcion.spec.ts` también cobra un pack. Con dos specs a la vez, un cobro del otro entre la lectura y la comprobación rompería la cuenta.
- Cada spec crea sus datos por la API con nombres propios (Erik Zapata y Hip-Hop en `flujo-principal`, Valeria Acosta en `pagos`, Valentina Ruiz, Salsa y `recepcion-flujo@estudio.test` en `recepcion`) y no depende del orden. Un spec nuevo usa nombres que no estén en esa lista: un `getByRole('row', { name: /Zapata/ })` con dos filas falla por modo estricto.
- Un spec no se puede repetir sobre la misma base sin `preparar.ts`: crearía sus datos dos veces. Para correr uno solo, `pnpm --filter @studio/e2e exec tsx preparar.ts` y después `pnpm --filter @studio/e2e exec playwright test <spec>`.
- Tiempos del 2026-11-21 con los tres specs: `pnpm e2e` tardó 21 s, 20 s y 21 s (preparar la base y compilar el frontend, unos 10 s; Playwright, 10 s; cada spec entre 1,4 s y 4,2 s).
- Usa el puerto fijo 3100 (`PUERTO_E2E` en `e2e/entorno.ts`). Si otro proceso lo ocupa, Playwright no levanta la API. Cambiá el número para esa corrida y volvé atrás con `git checkout -- e2e/entorno.ts`. No cierres un proceso que no es de este proyecto.

## `pnpm mirar`

Levanta la app con datos y guarda capturas: ver el skill `verify` (`.claude/skills/verify/SKILL.md`) y `docs/mapa-de-pantallas.md`.

- Usa la base `studio_manager_e2e`, igual que `pnpm e2e`: una corrida de una borra lo que dejó la otra. Con `--sin-preparar` reusa la base y busca los datos de ejemplo por nombre; si no están (por ejemplo, después de `pnpm e2e`), los carga.
- Dos `pnpm mirar` o `pnpm e2e` a la vez, por ejemplo de dos agentes o de dos worktrees, se borran la base entre sí y fallan los dos. Corré uno por vez.
- Los datos de ejemplo quedan con el día en que se cargaron. Con `--sin-preparar` otro día, `/agenda` y la grilla no muestran la clase de hoy: corré una vez sin `--sin-preparar` para cargarlos de nuevo.
- Usa el puerto 3101, para no chocar con el 3100 de `pnpm e2e`. Si el puerto ya responde, sale sin levantar nada.
- En Windows cierra la API con `taskkill /pid <pid> /T /F`: matar solo el `pnpm` deja vivo el `node.exe` de la API.
- Desde Git Bash, `MSYS_NO_PATHCONV=1 pnpm mirar /alumnos`. Sin eso, la ruta llega como `C:/Program Files/Git/alumnos` y el script sale con código 2 y lo explica. Desde PowerShell no hace falta.
- `fullPage: true` no muestra lo que queda abajo: el contenido de `Pagina` scrollea dentro de su contenedor, no la página. Por eso, si algún `.overflow-auto` tiene scroll, el script saca una segunda captura `-abajo` con todos esos contenedores al final. En la grilla, las clases de la tarde están en esa.
- `/liquidaciones` sin `periodo` abre el mes anterior, vacío con los datos de ejemplo. Usá `"/liquidaciones?periodo=:periodo"`.
- Una ruta de admin con `--rol recepcion` no redirige: muestra "No tenés permiso para ver esta pantalla.".
- El título que imprime el resumen es el `innerText` del primer `h1`. Con la ficha del alumno abierta es "Alumnos", porque la ficha es una ventana sobre el listado.

Tiempos del 2026-11-21, medidos por el script, con `/alumnos /liquidaciones /grilla`: la corrida completa tarda 14,3 s (prepara la base y compila el frontend). Con `--sin-preparar`, tres corridas seguidas: 4,5 s, 4,4 s y 4,5 s. `pnpm` suma alrededor de 1 s al arrancar.

## `pnpm dev:web`

Si el puerto 5173 está ocupado, `pnpm dev:web` arranca en 5174 y lo dice en su salida. Un `curl` a `localhost:5173` responde igual, porque contesta el otro proceso: las capturas van al puerto que imprimió Vite.

## Qué se verifica acá y no en jsdom

La posición de una lista flotante, lo que se ve en una pantalla táctil y el arrastre real de la grilla. Ver `web.md`.
