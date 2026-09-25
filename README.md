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

La primera vez, además:

```bash
pnpm --filter @studio/api db:migrate
pnpm --filter @studio/api db:seed
ADMIN_PASSWORD='una-clave-larga' pnpm --filter @studio/api usuario:admin admin@tuestudio.com "Nombre del admin"
```

`db:seed` carga los packs iniciales. `usuario:admin` crea el primer usuario admin; la contraseña va por variable de entorno para que no quede en el historial de la terminal.

## Producción

La API sirve el frontend compilado, así la app corre en un solo proceso:

```bash
pnpm build
WEB_DIST=../web/dist pnpm start
```

`WEB_DIST` es relativa a `apps/api`. La app queda en `http://localhost:3000`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm test` | Corre los tests de todos los paquetes |
| `pnpm typecheck` | Verifica los tipos |
| `pnpm db:up` | Levanta Postgres en el puerto 5433 |
| `pnpm db:down` | Apaga Postgres |
| `pnpm dev:web` | Levanta el frontend en el puerto 5173 |
| `pnpm build` | Compila el frontend en `apps/web/dist` |
| `pnpm start` | Levanta la API (con `WEB_DIST`, también sirve el frontend) |

## Documentación

- [Arquitectura general](docs/arquitectura%20general.md)
- [Arquitectura del backend](docs/arquitectura%20backend.md)
- [Estructura de base de datos](docs/estructura%20de%20base%20de%20datos.md)
- [Features](docs/features/index.md)
