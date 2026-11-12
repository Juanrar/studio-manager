# E2E y ver la app en Chromium

## `pnpm e2e`

- No corre dentro de `pnpm test`. Necesita Docker, compila el frontend y usa la base `studio_manager_e2e`, que se borra y se crea en cada corrida.
- Usa el reloj real: crea la clase para el día de hoy en Buenos Aires.
- Usa el puerto fijo 3100 (`PUERTO_E2E` en `e2e/entorno.ts`). Si otro proceso lo ocupa, Playwright no levanta la API. Cambiá el número para esa corrida y volvé atrás con `git checkout -- e2e/entorno.ts`. No cierres un proceso que no es de este proyecto.

## Mirar la app con datos

La base `studio_manager_e2e` sirve para mirar la app sin tocar la base de desarrollo: levantá la API con esa base en otro puerto y `WEB_DIST=../web/dist`.

Un script de capturas que vive fuera del repo carga Playwright con `createRequire('<repo>/e2e/package.json')`.

## Mirar una pantalla sin base

Un script de Playwright fuera del repo puede simular la API con `page.route('**/api/**', ...)`, respondiendo `/api/auth/yo` con un admin. Sirve para capturas de una pantalla contra `pnpm dev:web`.

Si el puerto 5173 está ocupado, `pnpm dev:web` arranca en 5174 y lo dice en su salida. Un `curl` a `localhost:5173` responde igual, porque contesta el otro proceso: las capturas van al puerto que imprimió Vite.

## Qué se verifica acá y no en jsdom

La posición de una lista flotante, lo que se ve en una pantalla táctil y el arrastre real de la grilla. Ver `web.md`.
