# Packs

**Estado:** lista  
**Depende de:** autenticacion  
**Listo cuando:** `pnpm test` pasa; admin puede crear y editar packs y recepción puede listarlos.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Objetivo:** catálogo de packs que vende el estudio (clase suelta, x4, x8, x16). Solo admin cambia precios.

**Arquitectura:** módulo `packs` con `routes` → `service` → `repository`. Esquemas en `packages/shared/src/packs.ts`.

**Spec:** [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), tabla `pack` y decisiones 2, 6 y 7.

## Decisiones

- **El precio es en pesos enteros.** La API rechaza un precio con decimales con un 400.
- **No hay borrado.** Un pack que ya no se vende se marca `activo = false`. Los pagos viejos lo siguen referenciando.
- **Cambiar precio o cantidad de clases no afecta pagos ya hechos**, porque el pago copia `monto` y `cantidad_clases` al momento de la compra. Eso se prueba en la feature de pagos, que es donde existen los pagos.
- **La clase suelta es un pack más**, con `cantidadClases = 1`. No hay un id especial.
- **Orden del listado:** por cantidad de clases y nombre.

## API

| Método y ruta | Rol | Cuerpo o query | Respuesta |
|---|---|---|---|
| `GET /api/packs` | recepcion | `?incluirInactivos=true` | `200 { items: Pack[] }` |
| `POST /api/packs` | admin | `{ nombre, cantidadClases, precio }` | `201` pack |
| `PATCH /api/packs/:id` | admin | `{ nombre?, cantidadClases?, precio?, activo? }` | `200` pack; `404` |

Forma del pack: `{ id, nombre, cantidadClases, precio, activo }`.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| Admin crea un pack y recepción no puede | Integración | Si las rutas de escritura quedan con rol `recepcion`, cualquiera en recepción cambia precios |
| Un precio con centavos responde 400 | Integración | Si `precioSchema` pierde el `.int()`, entran montos con decimales y se rompe la regla de pesos enteros |
| El listado muestra solo activos salvo con `incluirInactivos=true` | Integración | Si se pierde el filtro, recepción ofrece packs que ya no se venden |

**No se testea:** que el `PATCH` cambie solo los campos enviados (usa el mismo `sinIndefinidos` que ya prueba alumnos).

---

### Tarea 1: Módulo de packs

**Archivos:**
- Crear: `packages/shared/src/packs.ts` — `crearPackSchema`, `actualizarPackSchema`, `type Pack`.
- Crear: `apps/api/src/modules/packs/packs.repository.ts`, `packs.service.ts`, `packs.routes.ts`
- Modificar: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/packs/packs.test.ts`

**Interfaces:**
- Produce: `obtenerPack(id): Promise<Pack>` (lanza `NoEncontradoError`), que usa la feature de pagos.

- [x] **Paso 1:** escribir los 3 tests de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan con 404.
- [x] **Paso 3:** implementar esquemas, repository, service y rutas.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(packs): catálogo de packs`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan.
