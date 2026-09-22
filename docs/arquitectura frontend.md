# Arquitectura del frontend

Ubicación: `apps/web`. Panel interno para el personal del estudio, detrás de un login.

Estado: borrador. Se define en detalle después del backend.

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Build | Vite | No hace falta Next.js: no hay SEO, páginas públicas ni render en servidor |
| UI | React + TypeScript | |
| Datos del servidor | TanStack Query | Caché, recarga después de guardar, estados de carga y error |
| Rutas | TanStack Router o React Router | Pendiente de decidir |
| Formularios | React Hook Form + Zod | Usa los esquemas de `packages/shared` |
| Componentes | shadcn/ui | Tablas, formularios y diálogos, que son casi toda la app |

## Estructura de carpetas

```
apps/web/
├── src/
│   ├── features/              # misma división que los módulos del backend
│   │   ├── alumnos/
│   │   │   ├── api.ts         # llamadas a la API y hooks de TanStack Query
│   │   │   ├── AlumnosPage.tsx
│   │   │   └── AlumnoForm.tsx
│   │   ├── pagos/
│   │   ├── asistencias/
│   │   └── ...
│   ├── components/ui/         # componentes genéricos sin lógica de negocio
│   ├── lib/                   # cliente HTTP, formato de dinero y fechas
│   ├── routes/
│   └── main.tsx
└── package.json
```

## Reglas

- Cada feature llama a la API solo desde su `api.ts`. Los componentes no hacen `fetch` directo.
- `components/ui` no importa nada de `features/`.
- Las reglas de negocio viven en el backend. El frontend valida formato (campos obligatorios, números), no reglas como "el pack está vencido".
- Los montos y fechas se formatean solo con las funciones de `lib/`, con la zona horaria del estudio.
- La sesión viaja en la cookie. El frontend no guarda tokens.

## Pendiente

- Elegir router.
- Definir las pantallas y el flujo de recepción (tomar asistencia, cobrar clase suelta).
