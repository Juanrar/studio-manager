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
