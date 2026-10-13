# Alta de profesor desde el asistente

**Estado:** en curso
**Depende de:** asistente (27)
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; un administrador escribe "Sumá a Lucía Fernández, 50%, da Contemporáneo los martes y jueves de 19 a 20:30", ve una tarjeta con la semana dibujada como en la grilla, completa el DNI en la tarjeta, toca "Crear profesor" y la profesora queda creada con sus dos horarios y sus clases.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md), [el índice de features](index.md) y [la feature 27](asistente.md), que arma el asistente. Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

## Qué es

Una herramienta nueva del asistente, `proponer_alta_de_profesor`, que propone un profesor con sus horarios. La propuesta no se muestra como texto: la tarjeta dibuja la semana con las clases del profesor nuevo, con el mismo componente que la grilla (`VistaDeSemana`). "Crear profesor" crea al profesor, sus horarios y sus clases en una sola transacción.

El modelo no dibuja nada. Devuelve datos con forma fija y la web elige el componente. No hace falta MCP: el chat es propio y React dibuja lo que necesite.

## Datos personales

La conversación pasa por el plan gratuito de Gemini, que no puede recibir datos personales (ver la feature 27). Por eso:

- La herramienta recibe solo nombre, apellido, porcentaje y horarios.
- DNI, email, teléfono y alias o CBU se completan en la tarjeta. Van directo a la API del estudio y nunca a `/api/asistente/mensajes`.
- Si el usuario escribe el DNI en el chat, llega a Google. La pantalla no lo puede impedir; el texto de ayuda de la tarjeta dice dónde completarlo.

## API

### `POST /api/asistente/altas-de-profesor`

Solo administradores. Crea el profesor, su porcentaje, sus horarios y las clases de cada horario en una transacción. Si algo falla, no queda nada.

```json
{
  "profesor": { "nombre": "Lucía", "apellido": "Fernández", "porcentajeBp": 5000, "dni": "30123456", "email": "", "telefono": "", "aliasCbu": "" },
  "horarios": [
    { "estilo": "Contemporáneo", "diaSemana": 2, "horaInicio": "19:00", "horaFin": "20:30" },
    { "estilo": "Contemporáneo", "diaSemana": 4, "horaInicio": "19:00", "horaFin": "20:30" }
  ]
}
```

Responde 201 con el `Profesor` creado. Errores: 400 por Zod (sin horarios, más de 14, fin antes del inicio, porcentaje fuera de rango), 403 para recepción, 422 por reglas de negocio.

Va en el módulo `asistente` porque usa los services de profesores y de clases. Ponerlo en `profesores` crearía un ciclo: clases ya usa el service de profesores.

### La herramienta `proponer_alta_de_profesor`

| Parámetro | Tipo | Nota |
|---|---|---|
| `nombre`, `apellido` | string | |
| `porcentaje` | integer | De 1 a 100. La herramienta lo pasa a puntos básicos (`* 100`) |
| `horarios` | array de `{ estilo, nivel?, diaSemana, horaInicio, horaFin }` | Al menos uno |

Valida con `altaDeProfesorSchema`. Si ya hay un profesor con el mismo nombre y apellido (sin tildes, activo o no), lanza `ReglaDeNegocioError` con su id, para que el modelo pregunte si es la misma persona. Solo para administradores.

Devuelve al modelo `PROPUESTA_MOSTRADA` y a la web la propuesta `{ tipo: 'altaDeProfesor', datos }`.

## Arquitectura

### API

- `profesores.service.ts`: `crearProfesorEn(ej, datos, hoy)` hace los `insert` sin abrir transacción y devuelve el id. `crearProfesor` la llama dentro de `db.transaction`, como `registrarPago` con `registrarPagoEn`.
- `clases/programacion.service.ts`: `crearHorarioConSusClasesEn(ej, datos, hoy)` con el cuerpo de hoy, y `crearHorarioConSusClases` la llama dentro de `db.transaction`.
- `asistente/alta-de-profesor.service.ts`: `darDeAltaProfesor(datos, hoy)` abre la transacción y llama a las dos.
- `asistente/alta-de-profesor.routes.ts`: la ruta. Se registra en `rutasAsistente` o junto a ella en `app.ts`.
- `asistente/propuestas.ts`: la herramienta nueva, sumada a `TODAS` en `herramientas.ts`.

### Web

- `VistaDeSemana` suma la prop `incrustada: { inicio: number; fin: number }` (minutos desde las 00:00). Con ella la grilla es de solo lectura: no recibe `interacciones`, las clases no son botones, no hay línea de la hora actual, no tiene márgenes negativos ni scroll propio, y las horas van de `inicio` a `fin`. Sin ella, todo sigue igual: `GrillaPage` no cambia.
- `features/asistente/grillaDeLaPropuesta.ts`: funciones puras. `clasesDeLaPropuesta(alta, hoy)` convierte cada horario en una `Clase` de la semana de `hoy`, y `rangoDeHoras(clases)` va de una hora en punto antes de la primera clase a una hora en punto después de la última, entre 00:00 y 24:00.
- `TarjetaDeAltaDeProfesor.tsx`: nombre, porcentaje, la grilla, los campos opcionales y "Crear profesor".

## Qué no se implementa

- **La grilla en las propuestas de clase única y de horario** de la feature 27. Se puede sumar después con el mismo componente.
- **Las clases de otros profesores en la grilla de la propuesta.** El estudio no carga salas: una clase que se superpone con otra no es un problema.
- **Editar la propuesta en la tarjeta.** Para cambiar un horario se le pide al asistente otra propuesta.

## Casos que suelen fallar

1. **Un horario inválido entre varios.** La transacción deshace al profesor y a los horarios anteriores.
2. **Un profesor con el mismo nombre.** El modelo pregunta antes de proponer otro.
3. **Un horario fuera de 08:00 a 23:00**, como las 07:00. La grilla de la tarjeta se ajusta al rango de las clases; la de la página sigue de 08:00 a 23:00.
4. **El DNI en la tarjeta.** No viaja a `/api/asistente/mensajes`.
5. **Doble clic en "Crear profesor".** El botón se deshabilita mientras espera y desaparece cuando se creó.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| `POST /api/asistente/altas-de-profesor` crea a Lucía con su porcentaje, dos horarios y sus clases de la semana | Integración HTTP | Que falte crear los horarios o sus clases |
| Si el segundo horario viola `horario_horas_validas`, no queda ni la profesora ni el primer horario | Service con base real | Sacar la transacción o abrir una nueva adentro |
| Recepción recibe 403; sin horarios, 400 | Integración HTTP | Los permisos o el mínimo de horarios |
| `crearProfesor` y `crearHorarioConSusClases` siguen funcionando igual | Los tests que ya existen | El cambio a `...En` |
| `proponer_alta_de_profesor` con 50 devuelve `porcentajeBp: 5000` y la propuesta, sin crear nada | Service con base real | Mandar el porcentaje sin pasarlo a puntos básicos |
| Con una profesora "Lucia Fernandez" ya cargada, la herramienta lanza el error con su id | Service con base real | Crear duplicados sin preguntar |
| Recepción no tiene `proponer_alta_de_profesor` | Unitario | Que recepción pueda dar altas |
| `clasesDeLaPropuesta` pone martes y jueves en las fechas de la semana de hoy | Unitario | Ubicar los días mal |
| `rangoDeHoras`: de 19:00 a 20:30 da 18:00 a 22:00; 07:00 da desde las 06:00; 23:30 llega hasta las 24:00 y no más | Unitario | Cortar clases fuera de la grilla de la página |
| `VistaDeSemana` incrustada dibuja la clase de las 19:00 a 64 px del borde con el rango 18:00 a 22:00, sin rol de botón ni hora 08:00 | Web | Seguir usando `INICIO_GRILLA` para ubicar |
| La grilla de la página sigue igual | Los tests que ya existen | Romper `GrillaPage` al cambiar `VistaDeSemana` |
| La tarjeta muestra "Lucía Fernández", "50%" y la clase en "Martes 13" y en "Jueves 15" | Web | Que la tarjeta no dibuje la semana |
| "Crear profesor" manda el cuerpo exacto con el DNI escrito en la tarjeta, y ningún pedido a `/api/asistente/mensajes` lleva el DNI | Web | Mandar datos personales a Gemini |
| Con 201 se ve "Creado" y un enlace a `/profesores/31`; con 422 se ve el motivo | Web | Perder el resultado |

## Tareas

### Tarea 1: Alta en una transacción

**Archivos:**
- Crear: `apps/api/src/modules/asistente/alta-de-profesor.service.ts`, `alta-de-profesor.routes.ts`, `alta-de-profesor.test.ts`
- Modificar: `packages/shared/src/asistente.ts`, `packages/shared/src/horarios.ts` (exportar `diaSemanaSchema`), `apps/api/src/modules/profesores/profesores.service.ts`, `apps/api/src/modules/clases/programacion.service.ts`, `apps/api/src/app.ts`, `apps/web/src/features/asistente/TarjetaDePropuesta.tsx`

**Produce:** `altaDeProfesorSchema`, `AltaDeProfesorInput`, `darDeAltaProfesor(datos, hoy)`, `POST /api/asistente/altas-de-profesor`.

- [x] **Paso 1:** escribir `alta-de-profesor.test.ts`, con la base real y la app de test. Casos:
  - Como admin, el cuerpo de la sección API responde 201 con `{ id, nombre: 'Lucía', apellido: 'Fernández', dni: '30123456', email: null, telefono: null, aliasCbu: null, activo: true, porcentajeVigenteBp: 5000 }`. `GET /api/horarios?profesorId=<id>` trae los dos horarios y `GET /api/clases?desde=2026-03-09&hasta=2026-03-15` trae las clases del martes 10 y del jueves 12.
  - Llamando a `darDeAltaProfesor` directo, sin Zod, con un segundo horario de `21:00` a `20:00`: lanza el error del check y `listarProfesores(true, '2026-03-10')` sigue vacío, igual que la tabla `horario`.
  - Recepción recibe 403. `horarios: []` da 400.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test alta-de-profesor` y verificar que fallan porque la ruta no existe.
- [x] **Paso 3:** implementar. En `packages/shared/src/asistente.ts`:

```ts
const horarioDelAltaSchema = z
  .object({
    estilo: nombreSchema,
    nivel: textoOpcional,
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
  })
  .refine((horario) => horario.horaFin > horario.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export const altaDeProfesorSchema = z.object({
  profesor: crearProfesorSchema,
  horarios: z.array(horarioDelAltaSchema).min(1, 'Tiene que tener al menos un horario').max(14, 'Son 14 horarios como máximo'),
});

export type AltaDeProfesorInput = z.infer<typeof altaDeProfesorSchema>;
```

Y sumar a `PropuestaDelAsistente` el caso `| { tipo: 'altaDeProfesor'; datos: AltaDeProfesorInput }`. El caso nuevo rompe el typecheck de la web, que todavía no sabe mostrarlo: en esta tarea `AsistentePage` no dibuja nada para `altaDeProfesor` (`TarjetaDePropuesta` recibe el tipo sin ese caso, porque un `return null` antes de los hooks rompería su orden), y la tarea 4 lo reemplaza por la tarjeta.

En `profesores.service.ts`, separar la escritura:

```ts
// El porcentaje inicial queda vigente desde el día del alta.
export async function crearProfesor(datos: CrearProfesorInput, hoy: FechaDia): Promise<Profesor> {
  const id = await db.transaction((tx) => crearProfesorEn(tx, datos, hoy));
  return obtenerProfesor(id, hoy);
}

// Recibe el ejecutor para que el asistente cree al profesor y sus horarios en una sola transacción.
export async function crearProfesorEn(ej: Ejecutor, datos: CrearProfesorInput, hoy: FechaDia): Promise<number> {
  const { porcentajeBp, ...personales } = datos;
  const id = await repo.insertar(ej, {
    nombre: personales.nombre,
    apellido: personales.apellido,
    dni: personales.dni ?? null,
    email: personales.email ?? null,
    telefono: personales.telefono ?? null,
    aliasCbu: personales.aliasCbu ?? null,
  });
  await repo.insertarPorcentaje(ej, { profesorId: id, porcentajeBp, vigenteDesde: hoy });
  return id;
}
```

En `programacion.service.ts`, lo mismo: `crearHorarioConSusClases(datos, hoy)` pasa a `db.transaction((tx) => crearHorarioConSusClasesEn(tx, datos, hoy))`, y `crearHorarioConSusClasesEn(ej, datos, hoy)` tiene el cuerpo actual de la transacción con `ej` en lugar de `tx`.

`alta-de-profesor.service.ts`:

```ts
import type { AltaDeProfesorInput, Profesor } from '@studio/shared';
import { db } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { crearHorarioConSusClasesEn } from '../clases/programacion.service.ts';
import { crearProfesorEn, obtenerProfesor } from '../profesores/profesores.service.ts';

// El profesor, su porcentaje, sus horarios y sus clases, todo o nada.
export async function darDeAltaProfesor(datos: AltaDeProfesorInput, hoy: FechaDia): Promise<Profesor> {
  const id = await db.transaction(async (tx) => {
    const profesorId = await crearProfesorEn(tx, datos.profesor, hoy);
    for (const horario of datos.horarios) {
      await crearHorarioConSusClasesEn(tx, { ...horario, profesorId }, hoy);
    }
    return profesorId;
  });
  return obtenerProfesor(id, hoy);
}
```

La ruta: `app.post('/api/asistente/altas-de-profesor', { preHandler: requerirRol('admin') }, ...)` con `altaDeProfesorSchema.parse(request.body)` y `reply.status(201).send(...)`. No necesita el modelo: funciona aunque falte `GEMINI_API_KEY`.

- [x] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan, también los tests de profesores y de horarios que ya existían.
- [x] **Paso 5:** commit `feat(asistente): dar de alta un profesor con sus horarios`.

### Tarea 2: La herramienta del alta

**Archivos:**
- Modificar: `apps/api/src/modules/asistente/propuestas.ts`, `herramientas.ts`, `instrucciones.ts`, `herramientas.test.ts`, `asistente.test.ts`

**Consume:** `altaDeProfesorSchema` (tarea 1), `Herramienta` y `PROPUESTA_MOSTRADA` (feature 27).

- [x] **Paso 1:** sumar los tests:
  - En `herramientas.test.ts`: `proponer_alta_de_profesor` con `{ nombre: 'Lucía', apellido: 'Fernández', porcentaje: 50, horarios: [martes y jueves de 19:00 a 20:30] }` devuelve `{ resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'altaDeProfesor', datos: { profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000 }, horarios: [...] } } }` y no crea ningún profesor. Con `porcentaje: 0`, `150` o `50.5`, y con `horarios: []`, lanza `ZodError`. Con una "Lucia Fernandez" dada de baja ya cargada, lanza `ReglaDeNegocioError` con "Ya existe Lucia Fernandez (id N)".
  - `herramientasPara('recepcion')` sigue sin herramientas `proponer_*` y `herramientasPara('admin')` suma `proponer_alta_de_profesor`.
  - En `asistente.test.ts`, las instrucciones de admin mencionan `proponer_alta_de_profesor` y dicen que DNI, email, teléfono y alias se completan en la tarjeta.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test herramientas asistente` y verificar que fallan.
- [x] **Paso 3:** implementar en `propuestas.ts`:

```ts
const HORARIO_DEL_ALTA: EsquemaDeObjeto = {
  type: 'object',
  properties: {
    estilo: { type: 'string', description: 'Estilo de danza, por ejemplo "Contemporáneo"' },
    nivel: { type: 'string', description: 'Opcional, por ejemplo "Inicial"' },
    diaSemana: { type: 'integer', description: 'Día de la semana: 1 es lunes y 7 es domingo' },
    horaInicio: { type: 'string', description: 'HH:MM de 24 horas' },
    horaFin: { type: 'string', description: 'HH:MM, posterior a horaInicio' },
  },
  required: ['estilo', 'diaSemana', 'horaInicio', 'horaFin'],
};

const argumentosDelAltaSchema = z.object({
  nombre: z.string(),
  apellido: z.string(),
  porcentaje: z.number().int('El porcentaje va sin decimales').min(1).max(100),
  horarios: z.array(z.unknown()),
});

export const proponerAltaDeProfesor: Herramienta = {
  nombre: 'proponer_alta_de_profesor',
  descripcion:
    'Propone sumar un profesor nuevo con sus clases semanales. No crea nada: el usuario ve la semana en una tarjeta, completa sus datos personales ahí y confirma.',
  parametros: {
    type: 'object',
    properties: {
      nombre: { type: 'string' },
      apellido: { type: 'string' },
      porcentaje: { type: 'integer', description: 'Porcentaje que cobra el profesor de cada clase, de 1 a 100' },
      horarios: { type: 'array', description: 'Las clases que da cada semana', items: HORARIO_DEL_ALTA },
    },
    required: ['nombre', 'apellido', 'porcentaje', 'horarios'],
  },
  soloAdmin: true,
  async ejecutar(argumentos, { hoy }) {
    const { nombre, apellido, porcentaje, horarios } = argumentosDelAltaSchema.parse(argumentos);
    // Los porcentajes se guardan en puntos básicos: 50% es 5000.
    const datos = altaDeProfesorSchema.parse({ profesor: { nombre, apellido, porcentajeBp: porcentaje * 100 }, horarios });
    const buscado = sinTildes(`${datos.profesor.nombre} ${datos.profesor.apellido}`);
    const repetido = (await listarProfesores(true, hoy)).find((p) => sinTildes(`${p.nombre} ${p.apellido}`) === buscado);
    if (repetido !== undefined) {
      throw new ReglaDeNegocioError(
        `Ya existe ${repetido.nombre} ${repetido.apellido} (id ${repetido.id}). Preguntá si es la misma persona.`,
      );
    }
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'altaDeProfesor', datos } };
  },
};
```

`sinTildes` pasa de `consultas.ts` a un archivo propio del módulo (`texto.ts`) para usarla en los dos. En `instrucciones.ts`, para admin: "Para sumar un profesor nuevo usá proponer_alta_de_profesor. No pidas DNI, email, teléfono ni alias: se completan en la tarjeta."

- [x] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(asistente): proponer el alta de un profesor`.

### Tarea 3: La semana incrustada

**Archivos:**
- Crear: `apps/web/src/features/asistente/grillaDeLaPropuesta.ts`, `grillaDeLaPropuesta.test.ts`, `apps/web/src/features/grilla/semana-incrustada.test.tsx`
- Modificar: `apps/web/src/features/grilla/VistaDeSemana.tsx`

**Produce:** `VistaDeSemana` con `incrustada`, `clasesDeLaPropuesta(alta, hoy)`, `rangoDeHoras(clases)`, `fechasDeLaSemana(hoy)`.

- [ ] **Paso 1:** escribir los tests.
  - `grillaDeLaPropuesta.test.ts`, sin DOM: con hoy `2026-10-13` (martes) y los horarios de martes y jueves de 19:00 a 20:30, `clasesDeLaPropuesta` devuelve dos clases con `fecha` `2026-10-13` y `2026-10-15`, `id` `-1` y `-2`, `profesor: { id: 0, nombre: 'Lucía', apellido: 'Fernández' }`, `horarioId: null`, `estado: 'programada'`, `tieneCambios: false` y `asistentes: 0`. `rangoDeHoras` da `{ inicio: 1080, fin: 1320 }` para esas clases, `{ inicio: 360, fin: 540 }` para una de 07:00 a 08:00 y `{ inicio: 1320, fin: 1440 }` para una de 23:00 a 23:30. `fechasDeLaSemana('2026-10-13')` da del lunes 12 al domingo 18.
  - `semana-incrustada.test.tsx` renderiza `VistaDeSemana` sola, sin la app, con `incrustada={{ inicio: 1080, fin: 1320 }}`, las fechas de la semana y la clase de las 19:00 del martes. Verifica: la clase está en el grupo "Martes 13" con su `aria-label` (`getByLabelText`), no hay ningún `button`, se ven "18:00" y "22:00", no se ve "08:00", y el estilo de la clase tiene `top: 64px` (60 minutos por 1,05 px, más 1).
- [ ] **Paso 2:** correr `pnpm --filter @studio/web test grillaDeLaPropuesta semana-incrustada` y verificar que fallan.
- [ ] **Paso 3:** implementar.
  - En `VistaDeSemana`, las props pasan a una unión: `{ interacciones: InteraccionesDeLaGrilla; incrustada?: undefined } | { incrustada: { inicio: number; fin: number }; interacciones?: undefined }`. Lo que hoy usa `INICIO_GRILLA` y `FIN_GRILLA` para ubicar (las horas, las líneas, `ClaseEnLaGrilla`, el fantasma) usa el inicio y el fin del rango, que por defecto son esas constantes. `ALTO` y `HORAS` pasan a calcularse con el rango. Incrustada: el contenedor no lleva `-m-4` ni `h-[calc(100%+2rem)]`, el cuerpo no tiene `overflow-auto`, no hay `LineaDeAhora` ni `EtiquetaDeAhora` (y por eso ninguna hora en punto se esconde), y `ClaseEnLaGrilla` recibe `soloLectura`: sin `role="button"`, sin `tabIndex` y sin manejadores de puntero, con el mismo `aria-label`.
  - `grillaDeLaPropuesta.ts` con `lunesDe` y `sumarDias` de `lib/formato.ts`, y `aMinutos` de `features/grilla/minutos.ts`.
- [ ] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan, con los tests de la grilla que ya existían.
- [ ] **Paso 5:** commit `refactor(grilla): semana de solo lectura con rango de horas`.

### Tarea 4: La tarjeta del alta

**Archivos:**
- Crear: `apps/web/src/features/asistente/TarjetaDeAltaDeProfesor.tsx`
- Modificar: `apps/web/src/features/asistente/api.ts`, `TarjetaDePropuesta.tsx` (elige la tarjeta según `tipo`), `asistente.test.tsx`

**Consume:** `VistaDeSemana` incrustada y las funciones de `grillaDeLaPropuesta.ts` (tarea 3), `POST /api/asistente/altas-de-profesor` (tarea 1).

- [ ] **Paso 1:** sumar a `asistente.test.tsx`, con el reloj fijo en `2026-10-13T15:00:00Z` como los tests de la grilla (`vi.useFakeTimers({ toFake: ['Date'] })`, soltarlo en `afterEach`):
  - Una respuesta con la propuesta `altaDeProfesor` muestra "Lucía Fernández", "50%" y la clase "Contemporáneo, 19:00 a 20:30, Lucía Fernández" dentro de los grupos "Martes 13" y "Jueves 15".
  - Escribir `30123456` en "DNI" y tocar "Crear profesor" manda a `/api/asistente/altas-de-profesor` exactamente `{ profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000, dni: '30123456', email: '', telefono: '', aliasCbu: '' }, horarios: [...] }`. Todos los cuerpos que recibió `/api/asistente/mensajes` en el test, guardados en una lista, no contienen `30123456`.
  - Con 201 y `{ id: 31, ... }`, el botón no está más y se ve "Creado" con un enlace "Ver ficha" a `/profesores/31`. Con 422, el motivo se ve en la tarjeta.
- [ ] **Paso 2:** correr `pnpm --filter @studio/web test asistente` y verificar que fallan.
- [ ] **Paso 3:** implementar.
  - `api.ts`: `useDarDeAltaProfesor()`, un `useMutation` con `api.post<Profesor>('/asistente/altas-de-profesor', datos)` que al terminar invalida `profesores`, `horarios`, `grilla`, `agenda` y `clases`, como `useRecargar` de `features/grilla/api.ts`.
  - `TarjetaDeAltaDeProfesor`: encabezado con `Avatar`, nombre y porcentaje (`formatearPorcentaje`); la semana con `VistaDeSemana` incrustada, `fechasDeLaSemana(hoyEnEstudio())` y `clasesDeLaPropuesta`; los campos DNI, Teléfono, Email y Alias o CBU con `Campo` y `Entrada`, con las etiquetas de `ProfesorForm`; el texto "Estos datos no pasan por el asistente." en `text-tenue`; y "Crear profesor".
- [ ] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan. Mirar la tarjeta en Chromium con el script de capturas que describe CLAUDE.md: jsdom no calcula el diseño.
- [ ] **Paso 5:** commit `feat(asistente): el alta del profesor con su grilla`.

### Tarea 5: Frases de prueba

**Archivos:**
- Modificar: `apps/api/src/scripts/probar-asistente.ts`

- [ ] **Paso 1:** sumar las frases:

| Frase | Qué tiene que pasar |
|---|---|
| "Sumá a Lucía Fernández, 50%, da Contemporáneo los martes y jueves de 19 a 20:30" | Propuesta `altaDeProfesor` con dos horarios y `porcentajeBp: 5000` |
| "Sumá a una profesora nueva que da Salsa los lunes" | Pregunta nombre, porcentaje y horario. Sin propuesta |
| "Sumá a {profesor}, 40%, da Jazz los viernes de 18 a 19" | Dice que ya existe y pregunta si es la misma persona |

- [ ] **Paso 2:** correr `pnpm --filter @studio/api asistente:probar`.
- [ ] **Paso 3:** comparar con la tabla y ajustar las instrucciones o la descripción si hace falta. Anotar el resultado en la bitácora.
- [ ] **Paso 4:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `test(asistente): frases del alta de profesor`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [ ] `pnpm e2e` pasa: la grilla de la página cambió por dentro.
- [ ] Las frases de la tarea 5 se comportan como dice la tabla.
- [ ] A mano, con `pnpm dev` y la clave en el `.env`: pedir el alta de Lucía, ver la semana en la tarjeta, completar el DNI, crear, abrir su ficha y ver sus clases en la grilla.
