# Base del frontend y login

**Estado:** en curso  
**Depende de:** autenticacion  
**Listo cuando:** `pnpm test` pasa; con la API levantada, `pnpm dev:web` abre el login, se puede entrar y salir, y el menú muestra solo lo que corresponde al rol.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** dejar armada la app web: build, estilos, rutas, cliente de la API, sesión y el layout con menú.

**Spec:** [Arquitectura del frontend](../arquitectura%20frontend.md).

## Decisiones

- **Rutas:** `/login` es pública; el resto está dentro de un layout que exige sesión. Sin sesión, redirige a `/login`. Después del login va a `/agenda`.
- **Menú por rol:** recepción ve Agenda y Alumnos. Admin ve además Packs, Profesores, Clases, Usuarios y Liquidaciones. Las rutas de admin también se protegen: recepción que entra por URL ve "No tenés permiso".
- **Sesión:** la consulta `['sesion']` pide `GET /api/auth/yo`. Un 401 significa "sin sesión" y no es un error.
- **Pantallas todavía no hechas** muestran un texto "Próximamente" para que el menú funcione desde el principio.

## Tests

| Test | Por qué vale la pena: qué cambio lo rompe |
|---|---|
| Login correcto lleva a la agenda y muestra el nombre del usuario | Si el login no actualiza la consulta de sesión, el usuario queda en el login aunque la API respondió 200 |
| Login incorrecto muestra el mensaje de la API | Si el cliente no lee `{ error }` de la respuesta, el usuario ve un error genérico o nada |
| Sin sesión, una ruta protegida redirige al login | Si el guard trata el 401 como error en lugar de "sin sesión", se ve una pantalla rota |
| Recepción no ve el menú de administración y admin sí | Si el menú no filtra por rol, recepción ve opciones que la API le va a rechazar |
| Cerrar sesión llama a la API y vuelve al login | Si solo se limpia el estado local, la cookie sigue válida en el servidor |

---

### Tarea 1: App y cliente de la API

**Archivos:**
- Crear: `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`
- Crear: `apps/web/src/lib/api.ts`, `src/lib/formato.ts`
- Crear: `apps/web/src/components/ui/` (Boton, Campo, Aviso, Tabla, Dialogo)
- Crear: `apps/web/test/servidor.ts`, `test/render.tsx`, `test/setup.ts`
- Modificar: `package.json` de la raíz — script `dev:web`.

- [x] **Paso 1:** instalar dependencias y configurar Vite, Tailwind, Vitest y MSW.
- [x] **Paso 2:** implementar el cliente de la API, el formato y los componentes base.
- [x] **Paso 3:** verificar que `pnpm --filter @studio/web typecheck` y `build` pasan.
- [x] **Paso 4:** commit `feat(web): base de la app con Vite, Tailwind y cliente de la API`.

### Tarea 2: Login, sesión y layout

**Archivos:**
- Crear: `apps/web/src/features/auth/` (api.ts, LoginPage.tsx, RequiereSesion.tsx)
- Crear: `apps/web/src/components/Layout.tsx`, `src/rutas.tsx`, `src/App.tsx`
- Test: `apps/web/src/features/auth/auth.test.tsx`

- [ ] **Paso 1:** escribir los 5 tests de la tabla.
- [ ] **Paso 2:** correrlos y verificar que fallan.
- [ ] **Paso 3:** implementar.
- [ ] **Paso 4:** correr los tests y verificar que pasan.
- [ ] **Paso 5:** probar a mano con la API real: `pnpm dev:api` y `pnpm dev:web`, entrar con el admin local.
- [ ] **Paso 6:** commit `feat(web): login, sesión y menú por rol`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
