# Autenticación y roles

**Estado:** en curso  
**Depende de:** esquema-base-de-datos, utilidades-de-dominio  
**Listo cuando:** `pnpm test` pasa, un usuario puede loguearse y desloguearse, y las rutas de admin responden 403 a recepción y 401 sin sesión.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez, de arriba hacia abajo, y marcá cada checkbox recién cuando su comando de verificación pasa.

**Objetivo:** que solo el personal del estudio pueda usar la API, con dos roles: `admin` y `recepcion`.

**Arquitectura:** sesión en cookie firmada y `httpOnly`. La cookie guarda solo el id de una fila de `sesion_usuario`. Un plugin carga el usuario de la sesión en `request.usuario` en cada request, y cada ruta declara el rol mínimo con `requerirRol()`. Un plugin de errores traduce los errores de dominio y de validación a HTTP.

**Stack:** `@fastify/cookie`, `node:crypto` (`scrypt` para contraseñas, `randomBytes` para ids de sesión), Zod.

**Spec:** [Arquitectura del backend](../arquitectura%20backend.md), secciones "Errores" y "Autenticación y roles"; [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tablas `usuario` y `sesion_usuario`.

## Restricciones globales

- TypeScript `strict`, ESM, Node 22.
- Capas: `routes` → `service` → `repository`. Las rutas no tienen reglas de negocio ni SQL. Los services no conocen HTTP.
- La entrada se valida con esquemas Zod de `packages/shared`.
- Los tests de integración usan `app.inject()` con la app completa y el Postgres de test. No se mockea la base.
- Los tests nunca usan el reloj real: la app recibe `reloj: () => Date` en `buildApp()`.
- La respuesta nunca incluye `password_hash`.
- Mismo mensaje de error para "email inexistente" y "contraseña incorrecta", para no revelar qué emails existen.

## Decisiones

- **Contraseñas con `scrypt` de `node:crypto`** en lugar de argon2. `scrypt` está recomendado por OWASP y viene con Node, así no hace falta compilar un módulo nativo (pnpm 12 bloquea esos scripts por defecto). Formato guardado: `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>`, para poder subir el costo más adelante sin romper los hashes viejos.
- **Duración de la sesión:** 7 días desde el login. No se renueva sola.
- **`admin` incluye a `recepcion`:** una ruta que pide `recepcion` también la puede usar `admin`.
- **Desactivar un usuario o cambiarle la contraseña borra sus sesiones.** Si no, seguiría logueado hasta que venza la cookie.
- **Email en minúsculas y sin espacios**, tanto al crear como al loguear.

## API

| Método y ruta | Rol | Cuerpo | Respuesta |
|---|---|---|---|
| `POST /api/auth/login` | público | `{ email, password }` | `200` usuario + cookie `sid`; `401` credenciales inválidas |
| `POST /api/auth/logout` | cualquiera logueado | — | `204`, borra la sesión y la cookie |
| `GET /api/auth/yo` | cualquiera logueado | — | `200` usuario; `401` sin sesión |
| `GET /api/usuarios` | admin | — | `200 { items: Usuario[] }` |
| `POST /api/usuarios` | admin | `{ nombre, email, password, rol }` | `201` usuario; `422` email repetido |
| `PATCH /api/usuarios/:id` | admin | `{ nombre?, rol?, activo?, password? }` | `200` usuario; `404` no existe |

Forma del usuario en las respuestas: `{ id, nombre, email, rol, activo }`.

Errores: cuerpo `{ error: string }`. Los de validación agregan `detalles: { campo, mensaje }[]`.

| Situación | HTTP |
|---|---|
| Datos inválidos (Zod) | 400 |
| Sin sesión o sesión vencida | 401 |
| Rol insuficiente | 403 |
| Recurso inexistente | 404 |
| Regla de negocio (email repetido) | 422 |
| Error inesperado | 500, mensaje genérico, detalle solo en el log |

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Error inesperado responde 500 sin exponer el mensaje | Integración | Si el plugin de errores devuelve `error.message` para errores que no son de dominio, se filtran detalles internos |
| Datos inválidos responden 400 con los campos | Integración | Si el plugin deja de reconocer `ZodError`, toda validación se vuelve un 500 |
| Crear usuario guarda la contraseña hasheada y verificable | Integración (service) | Si `crearUsuario` guarda la contraseña en claro o con otro formato, el login deja de funcionar o se expone la contraseña |
| Crear usuario con email repetido lanza regla de negocio | Integración (service) | Si se deja de traducir la violación de `usuario_email_unique`, el cliente recibe un 500 |
| Login correcto devuelve el usuario y una cookie que sirve para `/yo` | Integración | Si la sesión no se guarda o la cookie no se firma igual que se lee, nadie puede usar la app |
| Login falla igual con email inexistente y con contraseña incorrecta (tabla) | Integración | Si alguien diferencia los dos casos, se pueden adivinar emails del personal |
| Usuario desactivado no puede loguearse | Integración | Si el login no mira `activo`, un empleado dado de baja sigue entrando |
| Logout invalida la sesión en el servidor | Integración | Si el logout solo borra la cookie, una cookie copiada sigue sirviendo |
| Sesión vencida responde 401 | Integración | Si la búsqueda de sesión no compara `expira_en` con el reloj, las sesiones no vencen |
| Recepción recibe 403 en una ruta de admin y sin sesión 401 | Integración | Si `requerirRol` deja pasar a cualquier usuario logueado, recepción puede crear usuarios |
| Admin crea un usuario que después puede loguearse | Integración | Si la ruta y el service no quedan conectados, o la respuesta incluye `password_hash` |
| Desactivar un usuario cierra sus sesiones | Integración | Si `actualizarUsuario` cambia `activo` sin borrar sesiones, el usuario sigue logueado. El test reactiva al usuario y prueba la cookie vieja, porque la búsqueda de sesión ya ignora usuarios inactivos |
| Cambiar la contraseña cierra las sesiones | Integración | Si alguien quita el cierre de sesiones al cambiar la contraseña, una contraseña filtrada sigue dando acceso después del cambio |

**No se testea:** que `scrypt` sea seguro ni que `@fastify/cookie` firme bien (son librerías); getters y el mapeo de filas a objetos (lo cubren los tests de arriba).

---

### Tarea 1: Plugin de errores y reloj de la app

**Archivos:**
- Modificar: `apps/api/src/lib/errores.ts` — agregar `NoAutenticadoError` (401).
- Crear: `apps/api/src/plugins/errores.ts`
- Modificar: `apps/api/src/app.ts` — `buildApp(opciones?: { reloj?: () => Date })`, decora `app.reloj`, registra el plugin de errores y un 404 en JSON.
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produce: `buildApp(opciones?: OpcionesApp): FastifyInstance`, con `app.reloj(): Date`. `NoAutenticadoError`. Todo error de dominio responde `{ error }` con su código; `ZodError` responde 400 con `detalles`.

- [x] **Paso 1:** escribir en `app.test.ts` los tests "error inesperado responde 500 sin exponer el mensaje" y "datos inválidos responden 400 con los campos". Cada test registra una ruta propia antes de `inject`.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test src/app.test.ts` y verificar que fallan (hoy Fastify devuelve el mensaje del error y un 500 para Zod).
- [x] **Paso 3:** implementar el plugin de errores, `NoAutenticadoError` y la opción `reloj`.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(api): plugin de errores y reloj inyectable`.

### Tarea 2: Contraseñas y service de usuarios

**Archivos:**
- Crear: `apps/api/src/lib/contrasenas.ts` — `hashearContrasena(texto): Promise<string>`, `verificarContrasena(texto, hash): Promise<boolean>`.
- Crear: `apps/api/src/lib/postgres.ts` — `esViolacionUnica(error, restriccion): boolean`. Drizzle envuelve el error del driver, así que mira también `error.cause`.
- Modificar: `apps/api/src/db/client.ts` — exportar `type Ejecutor` (la base o una transacción).
- Crear: `apps/api/src/modules/usuarios/usuarios.repository.ts`
- Crear: `apps/api/src/modules/usuarios/usuarios.service.ts`
- Crear: `packages/shared/src/usuarios.ts` — `crearUsuarioSchema`, `actualizarUsuarioSchema`, tipo `UsuarioPublico`.
- Test: `apps/api/src/modules/usuarios/usuarios.service.test.ts`

**Interfaces:**
- Produce: `crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioPublico>`, `listarUsuarios(): Promise<UsuarioPublico[]>`. `actualizarUsuario` se agrega en la tarea 4.
- La búsqueda de usuario para el login vive en el módulo `auth`, no acá: `usuarios` depende de `auth` para cerrar sesiones, y si `auth` dependiera de `usuarios` habría una dependencia circular.

- [x] **Paso 1:** escribir los tests del service: contraseña hasheada y verificable, y email repetido lanza `ReglaDeNegocioError`.
- [x] **Paso 2:** correrlos y verificar que fallan porque el módulo no existe.
- [x] **Paso 3:** implementar esquemas, contraseñas, repository y service.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(usuarios): service de usuarios con contraseñas hasheadas`.

### Tarea 3: Login, logout y sesión

**Archivos:**
- Crear: `packages/shared/src/auth.ts` — `loginSchema`.
- Crear: `apps/api/src/modules/auth/sesiones.repository.ts`
- Crear: `apps/api/src/modules/auth/auth.service.ts` — `iniciarSesion(email, password, ahora)`, `cerrarSesion(id)`, `usuarioDeSesion(id, ahora)`.
- Crear: `apps/api/src/modules/auth/auth.routes.ts`
- Crear: `apps/api/src/plugins/autenticacion.ts` — registra la cookie, carga `request.usuario` y exporta `requerirRol(rol)`.
- Crear: `apps/api/test/app.ts` — helpers: `crearAppDeTest(opciones)`, `crearUsuarioDeTest(datos)`, `loguear(app, email, password): Promise<string>` (devuelve el header `cookie`).
- Test: `apps/api/src/modules/auth/auth.test.ts`

**Interfaces:**
- Produce: `request.usuario: UsuarioPublico | null`; `requerirRol(rol: Rol)` para usar como `preHandler`; la cookie se llama `sid`.

- [x] **Paso 1:** escribir los tests de login correcto, credenciales inválidas (tabla), usuario desactivado, logout y sesión vencida.
- [x] **Paso 2:** correrlos y verificar que fallan con 404 (las rutas no existen).
- [x] **Paso 3:** instalar `@fastify/cookie` e implementar repository, service, plugin y rutas.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(auth): login, logout y sesiones en cookie`.

### Tarea 4: Rutas de usuarios con roles

**Archivos:**
- Crear: `apps/api/src/modules/usuarios/usuarios.routes.ts`
- Test: `apps/api/src/modules/usuarios/usuarios.test.ts`

- [x] **Paso 1:** escribir los tests: recepción recibe 403 y sin sesión 401; admin crea un usuario que después puede loguearse; desactivar un usuario cierra sus sesiones.
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar las rutas y hacer que `actualizarUsuario` borre las sesiones al desactivar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(usuarios): rutas de administración de usuarios`.

### Tarea 5: Script para crear el primer admin

**Archivos:**
- Crear: `apps/api/src/scripts/crear-admin.ts`
- Modificar: `apps/api/package.json` — script `usuario:admin`.
- Modificar: `README.md` — cómo crear el primer admin.

Uso: `ADMIN_PASSWORD='...' pnpm --filter @studio/api usuario:admin <email> "<nombre>"`. La contraseña va por variable de entorno para que no quede en el historial como argumento.

- [ ] **Paso 1:** implementar el script con `crearUsuario`.
- [ ] **Paso 2:** correrlo contra la base local y verificar con `curl` que el login funciona y `/api/auth/yo` devuelve el usuario.
- [ ] **Paso 3:** commit `feat(usuarios): script para crear el primer admin`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] Con la API levantada: login con el admin creado por el script devuelve `200` y `Set-Cookie: sid=...`; `GET /api/auth/yo` con esa cookie devuelve el usuario; `GET /api/usuarios` sin cookie devuelve `401`.
