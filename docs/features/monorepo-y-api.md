# Monorepo y esqueleto de la API

**Estado:** lista  
**Depende de:** Ninguna  
**Listo cuando:** `pnpm test` pasa y `curl http://localhost:3000/api/health` devuelve `{"estado":"ok"}`.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez, de arriba hacia abajo, y marcá cada checkbox recién cuando su comando de verificación pasa.

**Objetivo:** dejar el monorepo con pnpm funcionando, con una API Fastify que responde `/api/health` y un test que lo verifica.

**Arquitectura:** monorepo con `apps/api`, `apps/web` y `packages/shared`. La API se arma en `app.ts` (función `buildApp()` que devuelve la instancia de Fastify, sin escuchar) y se arranca en `server.ts`. Esa separación permite testear con `app.inject()` sin levantar un puerto.

**Stack:** pnpm workspaces, TypeScript, Node 22, Fastify 5, Vitest, Docker Compose con PostgreSQL 16.

**Spec:** [Arquitectura general](../arquitectura%20general.md) y [Arquitectura del backend](../arquitectura%20backend.md)

## Restricciones globales

- Node >= 22, pnpm >= 9.
- TypeScript en modo `strict`, módulos ESM (`"type": "module"`).
- Todo el código, los nombres de archivos, variables y mensajes de commit en español, salvo las palabras reservadas del stack.
- Los nombres de dominio siguen el modelo de datos: `alumno`, `profesor`, `pack`, `pago`, `clase`, `sesion`, `asistencia`, `liquidacion`, `usuario`.
- Ningún secreto en el repositorio. `.env` está en `.gitignore`; se versiona `.env.example`.
- Zona horaria del estudio: `America/Argentina/Buenos_Aires`.

---

### Tarea 1: Workspace de pnpm y TypeScript base

**Archivos:**
- Crear: `pnpm-workspace.yaml`
- Crear: `package.json`
- Crear: `tsconfig.base.json`
- Crear: `.npmrc`

**Interfaces:**
- Consume: nada.
- Produce: workspace con los globs `apps/*` y `packages/*`. `tsconfig.base.json` con `strict: true`, `module: "nodenext"`, `target: "es2023"`, que los tsconfig de cada paquete extienden.

- [x] **Paso 1: Crear el archivo de workspace**

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [x] **Paso 2: Crear el package.json de la raíz**

`package.json`:

```json
{
  "name": "studio-manager",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
  "scripts": {
    "dev:api": "pnpm --filter @studio/api dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [x] **Paso 3: Crear el tsconfig base**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [x] **Paso 4: Crear .npmrc**

`.npmrc`:

```
engine-strict=true
```

- [x] **Paso 5: Instalar y verificar**

Correr: `pnpm install`
Esperado: termina sin error y crea `pnpm-lock.yaml`.

- [x] **Paso 6: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .npmrc pnpm-lock.yaml
git commit -m "chore: inicializar monorepo con pnpm workspaces"
```

---

### Tarea 2: Postgres local con Docker Compose

**Archivos:**
- Crear: `docker-compose.yml`
- Crear: `.env.example`

**Interfaces:**
- Consume: nada.
- Produce: Postgres 16 en `localhost:5433`, base `studio_manager`, usuario `studio`, contraseña `studio`. La cadena de conexión para desarrollo es `postgres://studio:studio@localhost:5433/studio_manager`.

Se usa el puerto 5433 y no el 5432 para no chocar con un Postgres ya instalado en la máquina.

- [x] **Paso 1: Crear docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: studio-manager-db
    environment:
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: studio
      POSTGRES_DB: studio_manager
      TZ: America/Argentina/Buenos_Aires
    ports:
      - '5433:5432'
    volumes:
      - studio-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U studio -d studio_manager']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  studio-db-data:
```

- [x] **Paso 2: Crear .env.example**

```
DATABASE_URL=postgres://studio:studio@localhost:5433/studio_manager
SESSION_SECRET=cambiar-por-un-valor-aleatorio-largo
TZ_ESTUDIO=America/Argentina/Buenos_Aires
PORT=3000
NODE_ENV=development
```

- [x] **Paso 3: Levantar la base y verificar**

Correr: `docker compose up -d && docker compose ps`
Esperado: el servicio `db` aparece como `healthy`.

- [x] **Paso 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: agregar Postgres local con Docker Compose"
```

---

### Tarea 3: Paquete compartido

**Archivos:**
- Crear: `packages/shared/package.json`
- Crear: `packages/shared/tsconfig.json`
- Crear: `packages/shared/src/index.ts`

**Interfaces:**
- Consume: `tsconfig.base.json` de la tarea 1.
- Produce: el paquete `@studio/shared`, que exporta desde `src/index.ts`. Por ahora exporta `MEDIOS_PAGO: readonly ['efectivo', 'transferencia', 'mercado_pago', 'otro']` y el tipo `MedioPago`. Los módulos siguientes agregan sus esquemas Zod acá.

- [x] **Paso 1: Crear el package.json del paquete**

```json
{
  "name": "@studio/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo \"sin tests\" && exit 0"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

- [x] **Paso 2: Crear el tsconfig del paquete**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [x] **Paso 3: Crear el index**

`packages/shared/src/index.ts`:

```ts
export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'mercado_pago', 'otro'] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ROLES = ['admin', 'recepcion'] as const;

export type Rol = (typeof ROLES)[number];
```

- [x] **Paso 4: Instalar y verificar tipos**

Correr: `pnpm install && pnpm --filter @studio/shared typecheck`
Esperado: sin errores.

- [x] **Paso 5: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): crear paquete compartido con tipos base"
```

---

### Tarea 4: API Fastify con /api/health

**Archivos:**
- Crear: `apps/api/package.json`
- Crear: `apps/api/tsconfig.json`
- Crear: `apps/api/vitest.config.ts`
- Crear: `apps/api/src/config.ts`
- Crear: `apps/api/src/app.ts`
- Crear: `apps/api/src/server.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consume: `@studio/shared` de la tarea 3, la variable `DATABASE_URL` de la tarea 2.
- Produce:
  - `config: { databaseUrl: string; sessionSecret: string; tzEstudio: string; port: number; nodeEnv: string }` exportado desde `src/config.ts`.
  - `buildApp(): FastifyInstance` exportado desde `src/app.ts`. Devuelve la app armada y sin escuchar. Todos los tests HTTP la usan con `app.inject()`.
  - `GET /api/health` responde `200` con `{ estado: 'ok' }`.

- [x] **Paso 1: Crear el package.json de la API**

> Cambio respecto del plan original: `dev` y `start` usan `tsx` en lugar de `node`. Node 22 antes de la versión 22.18 no ejecuta archivos `.ts` sin el flag `--experimental-strip-types`, y la máquina de desarrollo tenía Node 22.12. `tsx` funciona igual en cualquier Node 22.

```json
{
  "name": "@studio/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "start": "tsx --env-file=.env src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@studio/shared": "workspace:*",
    "fastify": "^5.2.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [x] **Paso 2: Crear el tsconfig y el config de Vitest**

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
```

- [x] **Paso 3: Crear config.ts**

`apps/api/src/config.ts`:

```ts
import { z } from 'zod';

const esquema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  TZ_ESTUDIO: z.string().default('America/Argentina/Buenos_Aires'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parseado = esquema.safeParse(process.env);

if (!parseado.success) {
  const detalle = parseado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variables de entorno inválidas:\n${detalle}`);
}

export const config = {
  databaseUrl: parseado.data.DATABASE_URL,
  sessionSecret: parseado.data.SESSION_SECRET,
  tzEstudio: parseado.data.TZ_ESTUDIO,
  port: parseado.data.PORT,
  nodeEnv: parseado.data.NODE_ENV,
};
```

- [x] **Paso 4: Escribir el test que falla**

`apps/api/src/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('GET /api/health', () => {
  it('responde 200 con estado ok', async () => {
    const app = buildApp();
    const respuesta = await app.inject({ method: 'GET', url: '/api/health' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: 'ok' });

    await app.close();
  });

  it('responde 404 en una ruta que no existe', async () => {
    const app = buildApp();
    const respuesta = await app.inject({ method: 'GET', url: '/api/no-existe' });

    expect(respuesta.statusCode).toBe(404);

    await app.close();
  });
});
```

- [x] **Paso 5: Correr el test y verificar que falla**

Correr: `pnpm --filter @studio/api test`
Esperado: FALLA con un error de importación, porque `src/app.ts` todavía no existe.

- [x] **Paso 6: Implementar app.ts**

`apps/api/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  app.get('/api/health', async () => ({ estado: 'ok' }));

  return app;
}
```

- [x] **Paso 7: Correr el test y verificar que pasa**

Correr: `pnpm --filter @studio/api test`
Esperado: los 2 tests PASAN.

- [x] **Paso 8: Implementar server.ts**

`apps/api/src/server.ts`:

```ts
import { buildApp } from './app.ts';
import { config } from './config.ts';

const app = buildApp();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
```

- [x] **Paso 9: Verificar que el servidor arranca**

Correr: `cp .env.example apps/api/.env` y después `pnpm dev:api`
Esperado: el log muestra que escucha en el puerto 3000. `curl http://localhost:3000/api/health` devuelve `{"estado":"ok"}`. Cortar con Ctrl+C.

Nota: `SESSION_SECRET` del `.env.example` tiene más de 32 caracteres, así que la validación pasa.

- [x] **Paso 10: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): esqueleto de Fastify con /api/health y config validada"
```

---

### Tarea 5: Actualizar el README del repositorio

**Archivos:**
- Crear: `README.md`

**Interfaces:**
- Consume: los scripts definidos en las tareas 1 a 4.
- Produce: instrucciones para levantar el proyecto.

- [x] **Paso 1: Escribir el README**

````markdown
# Studio Manager

Sistema de gestión para un estudio de danza. Lo usa el personal del estudio: administradores y recepción.

## Requisitos

- Node 22 o superior
- pnpm 9 o superior
- Docker

## Cómo levantarlo

```bash
pnpm install
cp .env.example apps/api/.env
pnpm db:up
pnpm dev:api
```

La API queda en `http://localhost:3000`. Para verificar: `curl http://localhost:3000/api/health`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm test` | Corre los tests de todos los paquetes |
| `pnpm typecheck` | Verifica los tipos |
| `pnpm db:up` | Levanta Postgres en el puerto 5433 |
| `pnpm db:down` | Apaga Postgres |

## Documentación

- [Arquitectura general](docs/arquitectura%20general.md)
- [Arquitectura del backend](docs/arquitectura%20backend.md)
- [Estructura de base de datos](docs/estructura%20de%20base%20de%20datos.md)
- [Features](docs/features/index.md)
````

- [x] **Paso 2: Commit**

```bash
git add README.md
git commit -m "docs: agregar README con instrucciones de instalación"
```

---

## Verificación final del plan

- [x] `pnpm install` termina sin error.
- [x] `docker compose ps` muestra `db` como `healthy`.
- [x] `pnpm test` pasa.
- [x] `pnpm typecheck` pasa.
- [x] `curl http://localhost:3000/api/health` devuelve `{"estado":"ok"}`.
