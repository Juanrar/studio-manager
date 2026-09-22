# Arquitectura del backend

Ubicación: `apps/api`. Monolito modular en Node.js + TypeScript sobre PostgreSQL.

El modelo de datos está en [Estructura de base de datos](estructura%20de%20base%20de%20datos.md).

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Framework HTTP | Fastify | Validación de esquemas y tipado integrados. Más liviano que NestJS y más actual que Express |
| Acceso a Postgres | Drizzle | Las queries se escriben parecido a SQL, con tipos. Soporta transacciones y `select ... for update` sin rodeos |
| Migraciones | drizzle-kit | Genera migraciones SQL versionadas desde `db/schema.ts` |
| Validación | Zod | Esquemas compartidos con el frontend desde `packages/shared` |
| Autenticación | Sesión en cookie httpOnly, guardada en Postgres | Sistema interno con un solo cliente web. Cerrar sesión o bloquear un usuario es borrar una fila |
| Contraseñas | argon2 | |
| Logs | pino | Viene integrado con Fastify |
| Tests | Vitest + Testcontainers | Los tests de integración corren contra un Postgres real en Docker |

## Estructura de carpetas

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── usuarios/
│   │   ├── alumnos/
│   │   ├── profesores/
│   │   ├── packs/
│   │   ├── pagos/
│   │   │   ├── pagos.routes.ts
│   │   │   ├── pagos.service.ts
│   │   │   ├── pagos.repository.ts
│   │   │   └── pagos.test.ts
│   │   ├── clases/            # clase y sesion
│   │   ├── asistencias/
│   │   └── liquidaciones/
│   ├── db/
│   │   ├── schema.ts          # definición de tablas con Drizzle
│   │   ├── client.ts          # pool de conexiones
│   │   └── migrations/
│   ├── lib/                   # dinero, fechas, errores
│   ├── plugins/               # auth, manejo de errores, CORS
│   ├── config.ts              # variables de entorno validadas con Zod
│   ├── app.ts                 # crea la app y registra los módulos
│   └── server.ts              # arranca el proceso
├── test/                      # setup de tests de integración
└── package.json
```

El código se organiza por módulo de negocio, no por tipo de archivo. Para cambiar algo de pagos se abre una sola carpeta.

## Capas dentro de cada módulo

| Capa | Responsabilidad | No hace |
|---|---|---|
| `*.routes.ts` | Define rutas, valida la entrada con el esquema de `shared`, verifica el rol, llama al service y arma la respuesta | Reglas de negocio ni SQL |
| `*.service.ts` | Reglas del negocio y transacciones. Ejemplo: elegir el pago que vence primero, impedir anular un pago con asistencias | Conocer HTTP (`request`, `reply`, códigos de estado) |
| `*.repository.ts` | Queries a Postgres | Decidir reglas |

El service no conoce HTTP, así que se prueba llamándolo directo contra la base de test, sin levantar el servidor.

## Reglas de dependencia

- `routes` → `service` → `repository` → `db`. Nunca al revés.
- Un módulo usa el **service** de otro módulo, nunca su repository. Ejemplo: `asistencias.service` llama a `pagosService.buscarPagoValido()`. Cada regla vive en un solo lugar.
- Sin dependencias circulares entre módulos. Si dos módulos se necesitan mutuamente, la lógica compartida va a un tercero o se revisa el límite entre ellos.
- `lib/` no importa nada de `modules/`.

## Transacciones

Una operación de negocio que escribe en más de una tabla abre una transacción en el service y pasa el objeto de transacción al repository.

```ts
// asistencias.service.ts
async function registrar(input: RegistrarAsistenciaInput, usuarioId: number) {
  return db.transaction(async (tx) => {
    const sesion = await sesionesRepo.obtener(tx, input.sesionId);
    if (sesion.estado === 'cancelada') throw new ReglaDeNegocioError('La sesión está cancelada');

    const pago = await pagosService.bloquearPagoValido(tx, input.alumnoId, sesion.fecha);
    // ...
    return asistenciasRepo.crear(tx, { ... });
  });
}
```

Los repositories reciben `tx` como primer parámetro para que la misma función sirva dentro y fuera de una transacción.

Para evitar que dos recepcionistas consuman la última clase de un pack al mismo tiempo, el pago se bloquea con `select ... for update` antes de contar asistencias.

## Errores

Tres tipos de error propios en `lib/errores.ts`, que el plugin de errores traduce a HTTP:

| Error | HTTP | Cuándo |
|---|---|---|
| `NoEncontradoError` | 404 | El recurso no existe |
| `ReglaDeNegocioError` | 422 | La operación viola una regla (pack vencido, sesión cancelada) |
| `SinPermisoError` | 403 | El rol no alcanza |

Errores de validación de Zod → 400. Cualquier otro error → 500, con el detalle en el log y un mensaje genérico en la respuesta.

Los services lanzan errores. No devuelven `null` ni códigos para indicar fallas.

## Autenticación y roles

- Login con email y contraseña. Se crea una fila en una tabla `sesion_usuario` y se devuelve una cookie httpOnly, `Secure`, `SameSite=Lax`.
- Un plugin carga el usuario de la sesión en cada request.
- Cada ruta declara el rol mínimo: `admin` o `recepcion`.
- `recepcion`: alumnos, pagos, asistencias, consulta de clases.
- `admin`: todo lo anterior más packs, precios, profesores, porcentajes, liquidaciones y usuarios.

## Dinero y fechas

**Dinero.** Postgres devuelve `numeric` como string. En el código los montos se manejan en una sola representación y toda conversión pasa por `lib/dinero.ts`. Nunca se hacen cuentas con `number` de punto flotante sobre montos.

Decisión pendiente: centavos como enteros o una librería decimal.

**Fechas.** `pago.vence_el` y `sesion.fecha` son fechas sin hora. La zona horaria del estudio (`America/Argentina/Buenos_Aires`) se define en `config.ts`. Ningún cálculo depende de la zona del servidor. Toda conversión pasa por `lib/fechas.ts`.

## API

- REST con JSON, bajo el prefijo `/api`.
- Nombres de recursos en plural: `/api/alumnos`, `/api/pagos`, `/api/sesiones/:id/asistencias`.
- Campos en camelCase en la API y snake_case en la base. Drizzle hace la conversión.
- Listados paginados con `?pagina=&porPagina=` y búsqueda con `?q=`.

## Configuración

Las variables de entorno se validan con Zod al arrancar. Si falta una, el proceso no arranca.

```
DATABASE_URL=postgres://...
SESSION_SECRET=...
TZ_ESTUDIO=America/Argentina/Buenos_Aires
PORT=3000
```

`.env` no se sube al repositorio. Se sube `.env.example` con las claves y sin valores reales.

## Tests

- **Integración** (la mayoría): services contra un Postgres real levantado con Testcontainers. Cubren las reglas con dinero: registrar asistencia, vencimientos, cálculo de sueldo, anulación de pagos.
- **HTTP**: pocas pruebas por módulo con `app.inject()` de Fastify, para verificar rutas, validación y permisos.
- **Unitarios**: funciones puras de `lib/` (dinero, fechas).

Cada test corre dentro de una transacción que se revierte al terminar, para no depender del orden.

## Lo que no se usa

- Interfaces por cada repository: hay una sola implementación y los tests usan la base real.
- Contenedor de inyección de dependencias: los módulos se importan directo.
- JWT: la sesión en cookie resuelve el caso de un solo cliente web.
