# Arquitectura del frontend

Ubicación: `apps/web`. Panel interno para el personal del estudio, detrás de un login.

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Build | Vite | No hace falta Next.js: no hay SEO, páginas públicas ni render en servidor |
| UI | React + TypeScript | |
| Rutas | React Router | Suficiente para unas diez pantallas. TanStack Router da más tipado pero necesita un plugin de generación de código |
| Datos del servidor | TanStack Query | Caché, recarga después de guardar, estados de carga y error |
| Formularios | React Hook Form + Zod | Usa los esquemas de `packages/shared`, los mismos que valida la API |
| Estilos | Tailwind CSS 4 | Con componentes propios chicos en `components/ui`. No se usa shadcn/ui: su CLI es interactivo y la app es casi toda tablas, formularios y diálogos |
| Tests | Vitest + Testing Library + MSW | MSW simula la API a nivel de red. Una prueba de punta a punta con Playwright recorre el flujo real contra la API |

## Estructura de carpetas

```
apps/web/
├── src/
│   ├── features/              # misma división que los módulos del backend
│   │   ├── auth/
│   │   ├── alumnos/
│   │   │   ├── api.ts         # hooks de TanStack Query para este módulo
│   │   │   ├── AlumnosPage.tsx
│   │   │   └── AlumnoForm.tsx
│   │   └── ...
│   ├── components/ui/         # componentes genéricos sin lógica de negocio
│   ├── lib/
│   │   ├── api.ts             # cliente HTTP y ErrorDeApi
│   │   └── formato.ts         # pesos, fechas y porcentajes
│   ├── rutas.tsx              # árbol de rutas
│   ├── App.tsx
│   └── main.tsx
├── test/                      # servidor MSW y helpers de render
└── package.json
```

## Reglas

- **Toda llamada a la API pasa por `lib/api.ts`.** Los componentes no hacen `fetch` directo. Cada feature expone sus hooks en su `api.ts`.
- **Los errores de la API llegan como `ErrorDeApi`** con `status`, `mensaje` y `detalles`. Los formularios muestran `detalles` en cada campo y el resto como aviso.
- **`components/ui` no importa nada de `features/`.**
- **Las reglas de negocio viven en el backend.** El frontend valida formato con los esquemas compartidos, no reglas como "el pack está vencido": esas llegan como 422 y se muestran.
- **Montos, fechas y porcentajes se muestran solo con `lib/formato.ts`.** El dinero es entero y se muestra como `$9.600`; los porcentajes vienen en puntos básicos y se muestran como `52,5%`.
- **La sesión viaja en la cookie.** El frontend no guarda tokens. Quién está logueado sale de `GET /api/auth/yo`.
- **En desarrollo, Vite hace de proxy de `/api` a la API** en el puerto 3000, así la cookie es del mismo origen.

## Tests

- Cada pantalla tiene tests de integración con Testing Library: se renderiza la app con el router en una ruta, MSW responde como la API y el test interactúa como un usuario (escribe, hace clic, lee lo que aparece).
- Los handlers de MSW devuelven la misma forma que la API real, tipada con los tipos de `packages/shared`.
- No se testean componentes de `components/ui` por separado: los cubren las pantallas.
