# Prueba de punta a punta y build de producción

**Estado:** en curso  
**Depende de:** frontend-agenda, frontend-liquidaciones  
**Listo cuando:** `pnpm test` pasa, `pnpm build && pnpm start` sirve la app completa desde la API, y `pnpm e2e` recorre el flujo principal en un navegador real contra la API y una base limpia.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Spec:** [Arquitectura general](../arquitectura%20general.md); [Arquitectura del frontend](../arquitectura%20frontend.md), sección "Tests".

## Decisiones

- **En producción la API sirve el frontend** compilado (`apps/web/dist`) con `@fastify/static`. Un solo proceso y un solo origen: la cookie de sesión funciona sin CORS.
- **Fallback de SPA:** cualquier ruta que no empiece con `/api/` y no sea un archivo devuelve `index.html`, así recargar en `/alumnos/10` no da 404. Las rutas `/api/` que no existen siguen respondiendo el 404 en JSON.
- **`WEB_DIST`** indica la carpeta del frontend compilado. Sin esa variable la API no sirve archivos (como en desarrollo, donde lo hace Vite).
- **La prueba de punta a punta** usa Playwright con Chromium, una base propia (`studio_manager_e2e`) que se crea de cero en cada corrida, y la API sirviendo el build. Corre aparte de `pnpm test` porque tarda y necesita el navegador.
- **Un solo recorrido largo** y no muchos cortos: lo que se quiere verificar es que las piezas encajan (login, ABM, pago, asistencia, cobro en el acto, liquidación). El detalle de cada pantalla ya lo cubren los tests de integración.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Con `WEB_DIST`, `/` y una ruta del frontend devuelven `index.html`, y un archivo de `assets/` se sirve tal cual | API | Si falta el fallback, recargar cualquier pantalla que no sea `/` da 404 en producción |
| Con `WEB_DIST`, una ruta `/api/` inexistente sigue respondiendo 404 en JSON | API | Si el fallback atrapa también `/api/`, el frontend recibe HTML donde espera JSON y los errores se vuelven incomprensibles |
| Recorrido completo en el navegador | Punta a punta | Si cualquier pieza no encaja con otra (formato de la API, rutas, cookie, proxy, build), el flujo se corta |

---

### Tarea 1: La API sirve el frontend

**Archivos:**
- Modificar: `apps/api/src/config.ts` — `WEB_DIST` opcional.
- Modificar: `apps/api/src/app.ts`, `apps/api/src/plugins/errores.ts`, `apps/api/src/server.ts`
- Modificar: `package.json` de la raíz — scripts `build` y `start`; `.env.example`; `README.md`.
- Test: `apps/api/src/web.test.ts`

- [ ] **Paso 1:** escribir los 2 tests de la API.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan; probar `pnpm build && pnpm start` a mano.
- [ ] **Paso 5:** commit `feat(api): servir el frontend compilado en producción`.

### Tarea 2: Prueba de punta a punta

**Archivos:**
- Crear: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/preparar.ts`, `e2e/flujo-principal.spec.ts`
- Modificar: `pnpm-workspace.yaml` — incluir `e2e`; `package.json` de la raíz — script `e2e`.

- [ ] **Paso 1:** instalar Playwright y Chromium.
- [ ] **Paso 2:** escribir `preparar.ts` (base limpia, migraciones, packs y un admin) y el recorrido.
- [ ] **Paso 3:** correr `pnpm e2e` y verificar que pasa.
- [ ] **Paso 4:** commit `test(e2e): recorrido principal en el navegador`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] `pnpm e2e` pasa.
