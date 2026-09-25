# Arquitectura general

Sistema web de gestión para un estudio de danza. Lo usa solo el personal del estudio (administradores y recepción). Reemplaza una aplicación de escritorio en Java Swing.

## Documentos

- [Estructura de base de datos](estructura%20de%20base%20de%20datos.md)
- [Arquitectura del backend](arquitectura%20backend.md)
- [Arquitectura del frontend](arquitectura%20frontend.md)
- [Índice de features](features/index.md): qué está hecho y qué falta
- [CLAUDE.md](../CLAUDE.md): cómo trabaja un agente en este repositorio

## Stack

| Parte | Tecnología |
|---|---|
| Lenguaje | TypeScript en todo el repositorio |
| Backend | Node.js + Fastify |
| Base de datos | PostgreSQL + Drizzle |
| Frontend | React + Vite |
| Validación compartida | Zod |
| Monorepo | pnpm workspaces |

## Estructura del repositorio

```
studio-manager/
├── apps/
│   ├── api/          # backend
│   └── web/          # frontend
├── packages/
│   └── shared/       # esquemas Zod y tipos que usan api y web
├── docs/
├── docker-compose.yml   # Postgres local
├── package.json         # scripts de raíz
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Por qué `apps/` y `packages/` en lugar de `frontend/` y `backend/`

- `apps/` agrupa lo que se despliega. Si se agrega un proceso aparte (por ejemplo, uno que genere las sesiones del mes o avise vencimientos), va a `apps/worker` sin mover nada.
- `packages/` agrupa el código que se comparte. Con `frontend/` y `backend/` no hay un lugar para el código común y termina duplicado o importado con rutas relativas entre apps.
- Es la convención de pnpm, Turborepo y Nx.

## `packages/shared`

Contiene el contrato entre el frontend y el backend: los esquemas Zod de lo que entra y sale de la API, y los tipos derivados de ellos.

```ts
// packages/shared/src/pagos.ts
export const crearPagoSchema = z.object({
  alumnoId: z.number().int().positive(),
  packId: z.number().int().positive(),
  medio: z.enum(['efectivo', 'transferencia', 'mercado_pago', 'otro']),
});
export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
```

- El backend valida los requests con el esquema.
- El frontend valida los formularios con el mismo esquema.
- Si cambia un campo, TypeScript marca los dos lados.

Reglas:

- `shared` no importa nada de `apps/api` ni de `apps/web`.
- `shared` no tiene código de base de datos, de Fastify ni de React.

## Orden de trabajo

1. Backend: esquema de base, migraciones, módulos y tests.
2. Frontend: pantallas sobre la API ya definida.

## Lo que queda afuera por ahora

| Qué | Por qué |
|---|---|
| Microservicios | Un solo proceso con módulos separados alcanza para unos pocos usuarios. Los módulos ya marcan dónde cortar si algún día hace falta |
| GraphQL | Hay un solo cliente. REST con esquemas compartidos es más simple |
| Redis y colas | Postgres cubre sesiones y tareas programadas a esta escala |
| Turborepo o Nx | Se agregan cuando el tiempo de build lo justifique. No requieren mover carpetas |
