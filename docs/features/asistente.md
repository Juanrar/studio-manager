# Asistente con Gemini

**Estado:** lista
**Depende de:** grilla-semanal (26)
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; un administrador abre "Asistente", escribe "Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik", ve una tarjeta con la clase propuesta, toca "Crear" y la clase aparece en la grilla; recepción usa el mismo chat para consultar clases y profesores, pero no puede crear nada.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

## Qué es

Una pantalla de chat donde el personal del estudio escribe pedidos en castellano. Un modelo de lenguaje (Gemini, de Google) los interpreta y llama a funciones de la API: buscar profesores, listar clases y proponer una clase única o un horario. El modelo no escribe en la base. Una propuesta se muestra como una tarjeta y se crea recién cuando el usuario toca "Crear", con los mismos endpoints que usa la grilla.

## Por qué Gemini y con qué límites

El estudio quiere empezar sin pagar, con el plan gratuito de la API de Gemini. Se probó el 2026-10-13 con la clave del estudio, desde Argentina:

| Modelo | Resultado |
|---|---|
| `gemini-3.5-flash` | Llama bien a la función (624 tokens) |
| `gemini-3.5-flash-lite` | Llama bien a la función (292 tokens); antes dio un 503 |
| `gemini-3.1-flash-lite` | Llama bien a la función (292 tokens) |
| `gemini-3.8-flash` | 503 "high demand" en dos intentos |
| `gemini-omni-*` | 429 con `limit: 0`: no están en el plan gratuito |
| `gemini-2.5-flash` | 404: ya no se da a cuentas nuevas |

Límites y condiciones del plan gratuito:

- **La cuota diaria no es pública.** Se ve por proyecto en https://aistudio.google.com/rate-limit. Cada vuelta del ciclo de funciones es una petición: un pedido como "creame una clase con Erik" usa 2 a 4. El 2026-10-13, Google respondió en un 429 con `generate_content_free_tier_requests, limit: 20` para `gemini-3.5-flash`: 20 pedidos por día, o 5 o 6 consultas. Un 429 puede ser el límite por minuto o el diario; el mensaje de `CUOTA_AGOTADA` no los distingue.
- **Google usa lo que recibe.** Los términos del plan gratuito dicen que Google usa entradas y respuestas para mejorar sus productos, que revisores humanos pueden leerlas, y piden no mandar información personal, confidencial o sensible. Por eso ninguna herramienta devuelve datos de alumnos, ni DNI, email, teléfono o alias de profesores. Lo que escribe el usuario también le llega a Google, así que la pantalla lo avisa con una línea fija debajo del campo: "Lo que escribís acá lo procesa Google. No escribas nombres, DNI ni teléfonos de alumnos."
- **Los 503 son comunes.** Si el modelo principal responde 429, 500, 503 o 504, o el pedido falla por red o tarda más de 45 segundos, la API reintenta una vez con el modelo de respaldo, que tiene su propia cuota. Sin ese límite, Node espera hasta 300 segundos las cabeceras de la respuesta.

Modelos por defecto: `gemini-3.1-flash-lite`, con `gemini-3.5-flash` de respaldo. El principal es `gemini-3.1-flash-lite` porque el plan gratuito de `gemini-3.5-flash` permite 20 pedidos por día (Google lo informó en un 429 el 2026-10-13), que alcanzan para 5 o 6 consultas. En las pruebas del 2026-10-13, `gemini-3.1-flash-lite` llamó bien a la función y su cuota no se agotó, mientras `gemini-3.5-flash` llegó al límite de 20. Se cambian con variables de entorno, sin tocar código. Se usan nombres fijos y no los alias `-latest`, que cambian de modelo sin aviso.

**API elegida:** `generateContent` (`POST /v1beta/models/{modelo}:generateContent`), sin estado. Google recomienda la Interactions API para proyectos nuevos y llama "legacy" a `generateContent`, pero la documenta como "fully supported". La Interactions API guarda la conversación en los servidores de Google por defecto; acá la conversación la guarda el navegador.

## Cómo funciona una conversación

1. La web manda `POST /api/asistente/mensajes` con `{ historial, mensaje }`. El historial es el que devolvió la respuesta anterior (vacío al empezar).
2. El service le pasa al modelo las instrucciones, el historial con el mensaje nuevo y las herramientas que permite el rol del usuario.
3. Si el modelo pide funciones, el service las ejecuta, le devuelve los resultados y vuelve al paso 2. Como mucho 6 vueltas.
4. Cuando el modelo contesta con texto, la API responde `{ historial, texto, propuestas }`. `propuestas` junta las propuestas de esta respuesta.

**El historial es del proveedor.** La web lo guarda y lo devuelve sin mirarlo. Gemini adjunta una firma (`thoughtSignature`) a cada llamada a función y responde 400 si no la recibe en la vuelta siguiente: "Function call is missing a thought_signature in functionCall parts". Se verificó el 2026-10-13. Por eso el adaptador agrega al historial el `content` de la respuesta tal cual, sin rearmarlo. Cambiar de proveedor deja inservibles las conversaciones abiertas, y eso no importa: el chat no se guarda.

El historial viene del navegador. Un usuario podría mandar un historial inventado, y con eso solo engaña a su propio asistente: las propuestas se confirman con los endpoints de siempre, que validan todo de nuevo y piden el rol.

## API

`POST /api/asistente/mensajes`, para recepción y administradores.

```json
{ "historial": [], "mensaje": "Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik" }
```

Responde 200:

```json
{
  "historial": ["...lo que haya que devolver en el próximo mensaje..."],
  "texto": "Te dejé la propuesta. Tocá Crear para confirmarla.",
  "propuestas": [
    {
      "tipo": "claseUnica",
      "datos": { "fecha": "2026-10-17", "horaInicio": "15:00", "horaFin": "17:00", "estilo": "Hip-Hop", "profesorId": 7 },
      "profesor": { "id": 7, "nombre": "Erik", "apellido": "Zapata" }
    }
  ]
}
```

Errores:

| Caso | Respuesta |
|---|---|
| Sin sesión | 401 |
| `mensaje` vacío o de más de 2000 caracteres | 400 |
| `historial` de más de 80 elementos | 422, `codigo: 'CONVERSACION_LARGA'`, sin llamar al modelo |
| Falta `GEMINI_API_KEY` | 503, `codigo: 'ASISTENTE_SIN_CONFIGURAR'` |
| Los dos modelos sin cuota (429) | 503, `codigo: 'CUOTA_AGOTADA'` |
| Los dos modelos saturados (500, 503 o 504), sin red o sin respuesta en 45 segundos | 503, `codigo: 'MODELO_SATURADO'` |
| Gemini no devuelve texto ni llamadas a funciones (sin partes o solo pensamientos) | 503, `codigo: 'SIN_RESPUESTA'` |
| 6 vueltas sin respuesta de texto | 422 |

Confirmar una propuesta no tiene endpoint nuevo: la tarjeta llama a `POST /api/clases` o `POST /api/horarios`, que ya piden administrador.

## Herramientas

| Nombre | Rol | Qué hace | Qué le devuelve al modelo |
|---|---|---|---|
| `buscar_profesores` | recepción | Busca activos por nombre y apellido, en los dos órdenes, sin tildes | `{ profesores: [{ id, nombre, apellido }] }` |
| `listar_clases` | recepción | Clases entre dos fechas, hasta 31 días | `{ finDelHorizonte, clases: [{ id, fecha, horaInicio, horaFin, estilo, nivel, profesor, estado, repiteCadaSemana }] }` |
| `proponer_clase_unica` | admin | Valida con `crearClaseUnicaSchema`, que la fecha no haya pasado y que el profesor esté activo | Que la propuesta se mostró y falta la confirmación |
| `proponer_horario` | admin | Valida con `crearHorarioSchema` y que el profesor esté activo | Lo mismo |

Si una herramienta lanza un `ZodError` o un error de dominio, el modelo recibe `{ error: '<motivo>' }` y se lo explica al usuario. Cualquier otro error corta el pedido con 500.

Recepción no recibe las herramientas `proponer_*`. Si el modelo pide una herramienta que el rol no tiene, recibe `{ error: 'No existe la herramienta <nombre>' }`.

## Instrucciones del modelo

Van en `instrucciones.ts`, como texto fijo con la fecha de hoy y el rol:

```text
Sos el asistente de Studio Manager, el sistema de gestión de un estudio de danza. Hablás con el personal
del estudio. Respondé en español rioplatense, en frases cortas y en texto plano, sin Markdown.

Hoy es martes 2026-10-13. Las fechas van en formato AAAA-MM-DD y las horas en HH:MM, de 00:00 a 23:59.

Vocabulario del estudio:
- Un horario es una clase que se repite todas las semanas, por ejemplo "Hip-Hop los martes de 19:00 a 20:30".
- Una clase única es una clase de una sola fecha, como un workshop o una clase de recuperación.

Para saber el id de un profesor, buscalo con buscar_profesores. Si hay más de uno que coincide, preguntá cuál.
Si una función devuelve un error, explicalo con tus palabras. No inventes datos.

[admin]
Para crear una clase usá proponer_clase_unica o proponer_horario. Una propuesta no crea nada: el usuario la ve
en una tarjeta y la confirma con el botón Crear. Nunca digas que creaste algo.
Si el pedido no dice si la clase se repite todas las semanas, preguntalo. Si falta el día, el estilo, el
horario o el profesor, preguntalo antes de proponer.
Si el usuario confirma con palabras, recordale que toque Crear en la tarjeta. No vuelvas a proponer lo mismo.

[recepción]
No podés crear ni cambiar clases. Si te lo piden, decí que lo tiene que hacer un administrador
desde la grilla.
```

Nota: el plan decía "desde la grilla o desde este chat". En la prueba contra Gemini el modelo le repetía a recepción "o desde este chat", y recepción no puede crear desde el chat. Se quitó esa parte.

Nota de la revisión final: se sumó al bloque de admin la última línea, la de confirmar con palabras. Con un "dale, creala" el modelo puede volver a proponer la misma clase, y el usuario termina con dos tarjetas iguales. La frase 8 de la tarea 6 lo prueba.

## Arquitectura

### API

- `apps/api/src/modules/asistente/modelo.ts`: los tipos que no dependen del proveedor y la interfaz `ModeloDeLenguaje`.
- `gemini.ts`: el adaptador de Gemini con `fetch`, sin SDK. Traduce las herramientas, interpreta la respuesta, corta cada pedido a los 45 segundos, reintenta con el respaldo y convierte 429, 500, 503, 504 y los fallos de red en `ServicioNoDisponibleError`.
- `herramientas.ts`: los tipos de una herramienta y `herramientasPara(rol)`.
- `consultas.ts`: `buscar_profesores` y `listar_clases`.
- `propuestas.ts`: `proponer_clase_unica` y `proponer_horario`.
- `instrucciones.ts`: el texto de arriba.
- `asistente.service.ts`: `conversar`, el ciclo de vueltas.
- `asistente.routes.ts`: la ruta. Recibe el modelo como opción del plugin.

El módulo usa los services de profesores (`listarProfesores`, `verificarProfesorActivo`) y de clases (`listarClases`). Nunca sus repositories.

No se usa el SDK `@google/genai`: hacen falta un solo endpoint y control total del historial, y `fetch` se puede reemplazar en los tests. Los tests nunca llaman a Google.

### Web

- `apps/web/src/features/asistente/AsistentePage.tsx`: la conversación, el campo de texto y las tarjetas. Con mensajes, la barra tiene "Nueva conversación", que vacía el historial, los mensajes y el error, y conserva lo escrito.
- `ConversacionDelAsistente.tsx`: `ProveedorDeConversacion` y `useConversacion()`. Guarda el historial, los mensajes, lo escrito en el campo y qué propuestas ya se crearon, con su enlace. La mutación de `POST /api/asistente/mensajes` vive acá. Se monta en `RequiereSesion`, arriba de las rutas hijas, con `key` igual al id del usuario.
- `TarjetaDePropuesta.tsx`: los datos de la propuesta y el botón "Crear". Crea con `mutateAsync` y avisa a la conversación con `marcarCreada`; "Creada" sale de la conversación, no del estado de la mutación.
- `api.ts`: `useConversar`. Para crear se reusan `useCrearClaseUnica` y `useCrearHorario` de `features/grilla/api.ts`, que ya recargan la grilla, la agenda y los horarios.
- Ruta `/asistente` para los dos roles. En el menú, "Asistente" en la sección Recepción, debajo de "Alumnos".

La conversación vive en memoria mientras dure la sesión en la app: navegar no la borra; recargar o cerrar sesión empieza de cero. Antes vivía en el estado de la página, y el enlace "Ver en la grilla" de la propia tarjeta o cualquier clic en el menú borraban la conversación y lo escrito; al volver, una propuesta ya creada mostraba "Crear" otra vez y se podía duplicar la clase. No se usa `localStorage` ni `sessionStorage`: el chat no se guarda.

## Qué no se implementa

- **Guardar conversaciones.** Ni en la base ni en el navegador.
- **Datos de alumnos y pagos.** No hay herramientas para eso mientras se use el plan gratuito.
- **Mover, cancelar o poner suplentes desde el chat.** Se hace en la grilla. Puede ser una feature siguiente.
- **Alta de profesores.** Es la feature 28, con su grilla.
- **Respuestas en streaming.** La respuesta llega entera.
- **Prueba de punta a punta.** El e2e no puede depender de Gemini. La prueba real son las frases de la tarea 6.

## Casos que suelen fallar

1. **Fechas relativas.** "Mañana" o "el sábado" dependen del día de hoy en Buenos Aires: las instrucciones lo dicen con `app.hoy()`, no con el reloj de la máquina.
2. **Argumentos con otro tipo.** El modelo puede mandar `profesorId: "7"` o una hora `"8:00"`. Zod los rechaza y el modelo recibe el motivo; nunca es un 500.
3. **Recepción pide crear.** No tiene las herramientas, y si un historial inventado las nombra, recibe "No existe la herramienta".
4. **Doble clic en "Crear".** El botón se deshabilita mientras se crea y desaparece cuando se creó.
5. **Cuota agotada a mitad de la conversación.** El mensaje de error se ve y el texto escrito queda en el campo para reintentar más tarde.
6. **Conversación larga.** Después de unos 15 a 20 pedidos el historial pasa de 80 elementos y la API responde `CONVERSACION_LARGA`. La página muestra el aviso, resalta "Nueva conversación" en la barra y deja lo escrito en el campo para mandarlo en la conversación nueva.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| `responder` manda instrucciones, historial y herramientas con los tipos en mayúscula, y devuelve las llamadas con su `id` | Unitario con `fetch` falso | Cambiar el formato del pedido a Gemini |
| El historial que devuelve `responder` tiene el `content` del modelo tal cual, con `thoughtSignature` | Unitario con `fetch` falso | Rearmar las partes del modelo: Gemini responde 400 sin la firma |
| `agregarResultados` arma un `functionResponse` con el mismo `id` y nombre de la llamada | Unitario | Perder el `id` de la llamada |
| Un 503 del principal reintenta con el respaldo; 429 en los dos da `CUOTA_AGOTADA` y 503 en los dos da `MODELO_SATURADO` | Unitario con `fetch` falso | Sacar el respaldo o confundir los códigos |
| Un 500, un 504 o un `fetch` que rechaza (red o timeout) en el principal reintentan con el respaldo; si los dos fallan así, `MODELO_SATURADO`; un 400 o un 403 no se reintentan | Unitario con `fetch` falso | Que una caída de red o un 504 de Google terminen en "Error interno" |
| Cada pedido lleva el `signal` de `AbortSignal.timeout(45000)` y el cuerpo de la primera respuesta se libera antes de reintentar | Unitario con `fetch` falso | Esperar 300 segundos a Google o dejar conexiones abiertas |
| Una respuesta sin partes, o con solo pensamientos, da `SIN_RESPUESTA` y no agrega nada al historial | Unitario con `fetch` falso | Guardar un turno vacío, que hace fallar el pedido siguiente, o mostrar una burbuja vacía |
| `buscar_profesores` encuentra "martin" y "gomez martin" sin tildes, no trae dados de baja ni DNI, email o teléfono | Service con base real | Mandarle datos personales a Google o comparar con tildes |
| `listar_clases` devuelve las clases del rango con el profesor; un rango de más de 31 días da error | Service con base real | Mandar meses enteros al modelo |
| `proponer_clase_unica` devuelve la propuesta con el profesor y no crea ninguna clase | Service con base real | Que la herramienta escriba en la base |
| `proponer_clase_unica` con fecha pasada, profesor dado de baja o fin antes del inicio lanza el error con su motivo | Service con base real | Proponer algo que `POST /api/clases` va a rechazar |
| `proponer_horario` devuelve la propuesta sin `desde` ni `claseId`; `diaSemana: 8` da error | Service con base real | Que el modelo elija desde qué semana rige |
| `herramientasPara('recepcion')` no incluye `proponer_*` | Unitario | Que recepción pueda proponer clases |
| El recorrido "buscar, proponer, contestar" responde 200 con la propuesta completa, el modelo recibe el resultado de la búsqueda y no se crea ninguna clase | Integración HTTP con modelo falso | Romper el ciclo de vueltas |
| Las instrucciones dicen "Hoy es martes 2026-03-10" con el reloj fijo, las de admin piden recordar "Crear" cuando el usuario confirma con palabras, y las de recepción dicen que no puede crear | Integración HTTP con modelo falso | Usar el reloj de la máquina o el mismo texto para los dos roles |
| A recepción se le ofrecen solo `buscar_profesores` y `listar_clases`; si el modelo pide `proponer_clase_unica`, recibe "No existe la herramienta" | Integración HTTP con modelo falso | Filtrar mal por rol |
| Argumentos inválidos y errores de dominio vuelven al modelo como `{ error }` y la respuesta es 200 | Integración HTTP con modelo falso | Convertirlos en 400 o 500 y cortar la conversación |
| 6 vueltas sin texto dan 422 | Integración HTTP con modelo falso | Un ciclo sin fin que gasta la cuota |
| Un historial de 81 elementos da 422 `CONVERSACION_LARGA` y el modelo no recibe nada; uno de 80 todavía pasa | Integración HTTP con modelo falso | Volver a validar el largo con Zod, que responde "Datos inválidos" y la web no puede ofrecer empezar de nuevo |
| Sin sesión 401, mensaje vacío 400, sin modelo configurado 503 `ASISTENTE_SIN_CONFIGURAR` | Integración HTTP | La validación de entrada |
| Enviar muestra el mensaje y la respuesta, y el segundo envío manda el historial que llegó en el primero | Web | Perder el historial entre mensajes |
| Enter envía y Shift+Enter agrega un renglón | Web | El atajo del campo |
| Un error 503 muestra el motivo y deja el texto escrito en el campo | Web | Perder lo escrito cuando no hay cuota |
| Si el pedido falla después de que el usuario escribió otra cosa mientras esperaba, el campo tiene los dos textos y el mensaje enviado sale de la lista | Web | Pisar con lo enviado lo que se escribió durante la espera |
| Una propuesta de clase única muestra estilo, día, horario y profesor; "Crear" manda `POST /api/clases` con los datos exactos, el botón se deshabilita y aparece "Creada" con un enlace a la grilla | Web | Crear dos veces o mandar otros datos |
| Una propuesta de horario manda `POST /api/horarios` | Web | Confundir los dos tipos |
| Un 422 al crear se muestra en la tarjeta | Web | Que el error se pierda |
| Recepción ve "Asistente" en el menú | Web | Dejarlo solo para administradores |
| Debajo del campo se ve "Lo que escribís acá lo procesa Google. No escribas nombres, DNI ni teléfonos de alumnos." | Web | Sacar el aviso de privacidad del plan gratuito |
| Ir a la agenda por el menú y volver conserva los mensajes, la tarjeta "Creada" sin botón "Crear" y lo escrito en el campo | Web | Volver a guardar la conversación en el estado de la página |
| Una respuesta que llega con el usuario en otra pantalla aparece al volver | Web | Sacar la mutación del proveedor |
| Una propuesta que se termina de crear con el usuario en otra pantalla figura "Creada" al volver | Web | Avisar con los callbacks de `mutate`, que no se llaman si la tarjeta se desmontó |
| Cerrar sesión y volver a entrar empieza una conversación vacía | Web | Montar el proveedor fuera de `RequiereSesion` o guardar el chat en el navegador |
| "Nueva conversación" aparece con mensajes, vacía la lista, conserva lo escrito y el siguiente envío manda `historial: []` | Web | Mandar el historial viejo o borrar lo escrito |
| "Nueva conversación" mientras espera descarta la respuesta que llega después | Web | Sacar `reset()`: la respuesta vieja aparece en la conversación nueva |
| Un 422 `CONVERSACION_LARGA` muestra el aviso, resalta "Nueva conversación" y deja lo escrito; después de tocarlo, el envío manda `historial: []` | Web | Dejar el chat trabado sin forma de empezar de nuevo |

## Tareas

### Tarea 1: El adaptador de Gemini

**Archivos:**
- Crear: `apps/api/src/modules/asistente/modelo.ts`, `apps/api/src/modules/asistente/gemini.ts`, `apps/api/src/modules/asistente/gemini.test.ts`
- Modificar: `apps/api/src/lib/errores.ts`, `apps/api/src/lib/errores.test.ts`, `apps/api/src/config.ts`, `.env.example`

**Produce:** `ModeloDeLenguaje`, `crearModeloGemini(opciones)`, `ServicioNoDisponibleError`, `config.gemini`.

- [x] **Paso 1:** escribir los tests. `gemini.test.ts` no necesita la base: el `fetch` falso devuelve respuestas grabadas y guarda los pedidos. La respuesta grabada es la real del 2026-10-13:

```ts
import { describe, expect, it } from 'vitest';
import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import { crearModeloGemini } from './gemini.ts';
import type { DefinicionDeHerramienta } from './modelo.ts';

const LLAMADA_A_BUSCAR = {
  role: 'model',
  parts: [
    { functionCall: { name: 'buscar_profesores', args: { texto: 'Martín' }, id: 'call_390531' }, thoughtSignature: 'firma-opaca' },
  ],
};

const BUSCAR: DefinicionDeHerramienta = {
  nombre: 'buscar_profesores',
  descripcion: 'Busca profesores activos.',
  parametros: { type: 'object', properties: { texto: { type: 'string', description: 'Nombre o apellido' } }, required: ['texto'] },
};

type PedidoGrabado = { url: string; cuerpo: unknown };

// Responde en orden con `respuestas` y guarda lo que recibió.
function fetchFalso(respuestas: Array<{ status: number; cuerpo: unknown }>) {
  const pedidos: PedidoGrabado[] = [];
  const falso = async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
    const siguiente = respuestas.shift();
    if (siguiente === undefined) throw new Error('El fetch falso no tiene más respuestas');
    return new Response(JSON.stringify(siguiente.cuerpo), { status: siguiente.status });
  };
  return { falso: falso as typeof fetch, pedidos };
}

function modeloCon(respuestas: Array<{ status: number; cuerpo: unknown }>) {
  const { falso, pedidos } = fetchFalso(respuestas);
  const modelo = crearModeloGemini({ clave: 'clave-de-test', modelo: 'principal', respaldo: 'respaldo', fetch: falso });
  return { modelo, pedidos };
}

describe('crearModeloGemini', () => {
  it('manda instrucciones, historial y herramientas, y devuelve las llamadas con su id', async () => {
    const { modelo, pedidos } = modeloCon([{ status: 200, cuerpo: { candidates: [{ content: LLAMADA_A_BUSCAR }] } }]);
    const historial = modelo.agregarMensaje([], '¿Cuál es el apellido de Martín?');

    const turno = await modelo.responder({ instrucciones: 'Sos el asistente.', historial, herramientas: [BUSCAR] });

    expect(pedidos).toEqual([
      {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/principal:generateContent',
        cuerpo: {
          systemInstruction: { parts: [{ text: 'Sos el asistente.' }] },
          contents: [{ role: 'user', parts: [{ text: '¿Cuál es el apellido de Martín?' }] }],
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'buscar_profesores',
                  description: 'Busca profesores activos.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { texto: { type: 'STRING', description: 'Nombre o apellido' } },
                    required: ['texto'],
                  },
                },
              ],
            },
          ],
        },
      },
    ]);
    expect(turno.llamadas).toEqual([{ id: 'call_390531', nombre: 'buscar_profesores', argumentos: { texto: 'Martín' } }]);
    expect(turno.texto).toBe('');
  });

  it('agrega al historial el content del modelo tal cual, con su thoughtSignature', async () => {
    const { modelo } = modeloCon([{ status: 200, cuerpo: { candidates: [{ content: LLAMADA_A_BUSCAR }] } }]);
    const historial = modelo.agregarMensaje([], '¿Cuál es el apellido de Martín?');

    const turno = await modelo.responder({ instrucciones: 'Sos el asistente.', historial, herramientas: [BUSCAR] });

    expect(turno.historial).toEqual([...historial, LLAMADA_A_BUSCAR]);
  });

  it('devuelve los resultados como functionResponse con el id y el nombre de la llamada', () => {
    const { modelo } = modeloCon([]);

    const historial = modelo.agregarResultados([], [
      { llamada: { id: 'call_390531', nombre: 'buscar_profesores', argumentos: {} }, resultado: { profesores: [] } },
    ]);

    expect(historial).toEqual([
      { role: 'user', parts: [{ functionResponse: { id: 'call_390531', name: 'buscar_profesores', response: { profesores: [] } } }] },
    ]);
  });

  it('une el texto de las partes y deja afuera los pensamientos', async () => {
    const { modelo } = modeloCon([
      { status: 200, cuerpo: { candidates: [{ content: { role: 'model', parts: [{ text: 'pensando', thought: true }, { text: 'El apellido ' }, { text: 'es Gómez.' }] } }] } },
    ]);

    const turno = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] });

    expect(turno).toMatchObject({ texto: 'El apellido es Gómez.', llamadas: [] });
  });

  it('si el principal está saturado, reintenta con el respaldo', async () => {
    const { modelo, pedidos } = modeloCon([
      { status: 503, cuerpo: { error: { message: 'high demand' } } },
      { status: 200, cuerpo: { candidates: [{ content: { role: 'model', parts: [{ text: 'Hola' }] } }] } },
    ]);

    const turno = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] });

    expect(pedidos.map((p) => p.url)).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/principal:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/respaldo:generateContent',
    ]);
    expect(turno.texto).toBe('Hola');
  });

  it.each([
    [429, 'CUOTA_AGOTADA'],
    [503, 'MODELO_SATURADO'],
  ])('si los dos modelos responden %i, lanza ServicioNoDisponibleError con %s', async (status, codigo) => {
    const { modelo } = modeloCon([
      { status, cuerpo: {} },
      { status, cuerpo: {} },
    ]);

    const error = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServicioNoDisponibleError);
    expect(error).toMatchObject({ codigo });
  });

  it('una respuesta sin partes lanza SIN_RESPUESTA', async () => {
    const { modelo } = modeloCon([{ status: 200, cuerpo: { candidates: [{ finishReason: 'SAFETY' }] } }]);

    const error = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] }).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'SIN_RESPUESTA' });
  });
});
```

En `errores.test.ts`, sumar que `ServicioNoDisponibleError` tiene `codigoHttp` 503 y conserva su `codigo`, como los tests de las otras clases.

- [x] **Paso 2:** correr `pnpm --filter @studio/api test gemini errores` y verificar que fallan porque no existen `gemini.ts` ni `ServicioNoDisponibleError`.
- [x] **Paso 3:** implementar. En `lib/errores.ts`:

```ts
// Un servicio externo no responde: la cuota del asistente se terminó o el modelo está saturado.
export class ServicioNoDisponibleError extends ErrorDeDominio {
  override readonly codigoHttp = 503;
}
```

`modelo.ts`:

```ts
// Lo que el asistente necesita de un modelo de lenguaje, sin depender del proveedor.

// El subconjunto de JSON Schema que entienden Gemini y Claude.
export type EsquemaDeCampo =
  | { type: 'string' | 'integer' | 'number' | 'boolean'; description?: string }
  | { type: 'array'; description?: string; items: EsquemaDeCampo }
  | EsquemaDeObjeto;

export type EsquemaDeObjeto = {
  type: 'object';
  description?: string;
  properties: Record<string, EsquemaDeCampo>;
  required: string[];
};

export type DefinicionDeHerramienta = { nombre: string; descripcion: string; parametros: EsquemaDeObjeto };

export type LlamadaAHerramienta = { id?: string; nombre: string; argumentos: Record<string, unknown> };

export type ResultadoDeHerramienta = { llamada: LlamadaAHerramienta; resultado: Record<string, unknown> };

// El historial tiene el formato del proveedor. La web lo guarda y lo devuelve sin mirarlo.
export type Historial = unknown[];

export type PedidoAlModelo = { instrucciones: string; historial: Historial; herramientas: DefinicionDeHerramienta[] };

// `historial` es el del pedido con la respuesta del modelo agregada al final.
export type TurnoDelModelo = { historial: Historial; texto: string; llamadas: LlamadaAHerramienta[] };

export interface ModeloDeLenguaje {
  agregarMensaje(historial: Historial, texto: string): Historial;
  agregarResultados(historial: Historial, resultados: ResultadoDeHerramienta[]): Historial;
  responder(pedido: PedidoAlModelo): Promise<TurnoDelModelo>;
}
```

`gemini.ts`:

> La revisión final cambió `generar`: timeout de 45 segundos, y red caída, 500 y 504 se tratan como 503. El código vigente está en `apps/api/src/modules/asistente/gemini.ts`.

```ts
import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import type { EsquemaDeCampo, LlamadaAHerramienta, ModeloDeLenguaje } from './modelo.ts';

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type Parte = {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  thoughtSignature?: string;
};
type Contenido = { role: string; parts?: Parte[] };

export type OpcionesGemini = {
  clave: string;
  modelo: string;
  // Tiene su propia cuota: se usa cuando el principal responde 429 o 503.
  respaldo: string;
  // Los tests pasan un fetch falso y nunca llaman a Google.
  fetch?: typeof fetch;
};

// Usa generateContent sin estado. Gemini firma cada llamada a función (`thoughtSignature`) y responde 400
// si no recibe la firma en la vuelta siguiente: el `content` del modelo se guarda tal cual en el historial.
export function crearModeloGemini(opciones: OpcionesGemini): ModeloDeLenguaje {
  const pedirHttp = opciones.fetch ?? fetch;

  const generar = (modelo: string, cuerpo: unknown) =>
    pedirHttp(`${URL_BASE}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': opciones.clave, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

  return {
    agregarMensaje: (historial, texto) => [...historial, { role: 'user', parts: [{ text: texto }] }],

    agregarResultados: (historial, resultados) => [
      ...historial,
      {
        role: 'user',
        parts: resultados.map(({ llamada, resultado }) => ({
          functionResponse: {
            ...(llamada.id === undefined ? {} : { id: llamada.id }),
            name: llamada.nombre,
            response: resultado,
          },
        })),
      },
    ],

    async responder({ instrucciones, historial, herramientas }) {
      const cuerpo = {
        systemInstruction: { parts: [{ text: instrucciones }] },
        contents: historial,
        tools: [
          {
            functionDeclarations: herramientas.map((h) => ({
              name: h.nombre,
              description: h.descripcion,
              parameters: aEsquemaDeGemini(h.parametros),
            })),
          },
        ],
      };

      let respuesta = await generar(opciones.modelo, cuerpo);
      if (respuesta.status === 429 || respuesta.status === 503) respuesta = await generar(opciones.respaldo, cuerpo);
      if (respuesta.status === 429) {
        throw new ServicioNoDisponibleError('Se alcanzó el límite de pedidos del plan gratuito. Probá en un minuto; si sigue, la cuota del día se renueva mañana.', 'CUOTA_AGOTADA');
      }
      if (respuesta.status === 503) {
        throw new ServicioNoDisponibleError('El asistente está saturado. Probá en unos minutos.', 'MODELO_SATURADO');
      }
      if (!respuesta.ok) throw new Error(`Gemini respondió ${respuesta.status}: ${await respuesta.text()}`);

      const datos = (await respuesta.json()) as { candidates?: { content?: Contenido }[] };
      const contenido = datos.candidates?.[0]?.content;
      const partes = contenido?.parts ?? [];
      // Un turno sin partes en el historial hace fallar el pedido siguiente: no se guarda.
      if (contenido === undefined || partes.length === 0) {
        throw new ServicioNoDisponibleError('El asistente no pudo responder. Probá con otras palabras.', 'SIN_RESPUESTA');
      }

      const llamadas: LlamadaAHerramienta[] = partes.flatMap((parte) =>
        parte.functionCall === undefined
          ? []
          : [
              {
                ...(parte.functionCall.id === undefined ? {} : { id: parte.functionCall.id }),
                nombre: parte.functionCall.name,
                argumentos: parte.functionCall.args ?? {},
              },
            ],
      );
      const texto = partes
        .filter((parte) => parte.thought !== true)
        .map((parte) => parte.text ?? '')
        .join('')
        .trim();
      return { historial: [...historial, contenido], texto, llamadas };
    },
  };
}

// Gemini escribe los tipos en mayúsculas: 'string' pasa a 'STRING'. Con minúsculas no se probó.
function aEsquemaDeGemini(esquema: EsquemaDeCampo): Record<string, unknown> {
  const base = {
    type: esquema.type.toUpperCase(),
    ...(esquema.description === undefined ? {} : { description: esquema.description }),
  };
  if (esquema.type === 'array') return { ...base, items: aEsquemaDeGemini(esquema.items) };
  if (esquema.type === 'object') {
    return {
      ...base,
      properties: Object.fromEntries(Object.entries(esquema.properties).map(([clave, campo]) => [clave, aEsquemaDeGemini(campo)])),
      required: esquema.required,
    };
  }
  return base;
}
```

En `config.ts`, sumar al esquema y a `config`:

```ts
  // Sin clave, el asistente responde 503. Los modelos se pueden cambiar sin tocar código.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODELO: z.string().min(1).default('gemini-3.1-flash-lite'),
  GEMINI_MODELO_RESPALDO: z.string().min(1).default('gemini-3.5-flash'),
```

```ts
  gemini: {
    clave: parseado.data.GEMINI_API_KEY,
    modelo: parseado.data.GEMINI_MODELO,
    respaldo: parseado.data.GEMINI_MODELO_RESPALDO,
  },
```

En `.env.example`, al final:

```text
# Asistente: la clave se saca en https://aistudio.google.com/apikey. Sin clave, el asistente no anda.
# GEMINI_API_KEY=
# GEMINI_MODELO=gemini-3.1-flash-lite
# GEMINI_MODELO_RESPALDO=gemini-3.5-flash
```

- [x] **Paso 4:** correr `pnpm --filter @studio/api test gemini errores` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): cliente de Gemini con modelo de respaldo`.

### Tarea 2: Las herramientas

**Archivos:**
- Crear: `packages/shared/src/asistente.ts`, `apps/api/src/modules/asistente/herramientas.ts`, `consultas.ts`, `propuestas.ts`, `herramientas.test.ts`
- Modificar: `packages/shared/src/index.ts`

**Consume:** `DefinicionDeHerramienta` de la tarea 1.
**Produce:** `PropuestaDelAsistente`, `RespuestaDelAsistente`, `mensajeAlAsistenteSchema`, `Herramienta`, `herramientasPara(rol)`.

- [x] **Paso 1:** escribir `herramientas.test.ts`, un test de service con base real como `usuarios.service.test.ts`. Llama a `herramienta.ejecutar(argumentos, { hoy: '2026-03-10' })` directo. Casos:
  - `buscar_profesores` con `{ texto: 'martin' }` y con `{ texto: 'gomez martin' }` devuelve `{ resultado: { profesores: [{ id, nombre: 'Martín', apellido: 'Gómez' }] } }` para un profesor creado con DNI, email y teléfono: la aserción completa prueba que esos campos no salen. Un profesor dado de baja con el mismo nombre no aparece.
  - `listar_clases` con un horario de Erik los martes, del `2026-03-09` al `2026-03-15`, devuelve la clase del 10 con `profesor: 'Erik Zapata'` y `repiteCadaSemana: true`. Para tener la clase, `generarClases(db, '2026-03-10')`, como dice CLAUDE.md. Del `2026-03-01` al `2026-04-15` lanza `ReglaDeNegocioError`.
  - `proponer_clase_unica` con datos válidos devuelve `{ resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'claseUnica', datos, profesor: { id, nombre: 'Erik', apellido: 'Zapata' } } }`, y la tabla `clase` sigue vacía.
  - `proponer_clase_unica` con `fecha: '2026-03-09'`, con un profesor dado de baja y con `horaFin` antes de `horaInicio` lanza el error con su motivo (`ReglaDeNegocioError` o `ZodError`).
  - `proponer_horario` con datos válidos y un `desde` de más devuelve `datos` sin `desde`; con `diaSemana: 8` lanza `ZodError`.
  - `herramientasPara('recepcion')` da `['buscar_profesores', 'listar_clases']` y `herramientasPara('admin')` suma `proponer_clase_unica` y `proponer_horario`.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test herramientas` y verificar que fallan porque no existen los módulos.
- [x] **Paso 3:** implementar. En `packages/shared/src/asistente.ts`:

```ts
import { z } from 'zod';
import type { PersonaResumen } from './comun.ts';
import type { CrearClaseUnicaInput } from './clases.ts';
import type { CrearHorarioInput } from './horarios.ts';

export const LARGO_MAXIMO_DEL_MENSAJE = 2000;
// Cada vuelta suma dos elementos al historial: con 80 entra una conversación larga.
export const ELEMENTOS_MAXIMOS_DEL_HISTORIAL = 80;

export const mensajeAlAsistenteSchema = z.object({
  // Lo arma el proveedor del modelo: la web lo devuelve sin mirarlo.
  historial: z.array(z.unknown()).max(ELEMENTOS_MAXIMOS_DEL_HISTORIAL, 'La conversación es muy larga: empezá una nueva'),
  mensaje: z.string().trim().min(1, 'Escribí un mensaje').max(LARGO_MAXIMO_DEL_MENSAJE, 'El mensaje es muy largo'),
});

export type MensajeAlAsistenteInput = z.infer<typeof mensajeAlAsistenteSchema>;

// Algo que el asistente propone crear. Se crea recién cuando el usuario toca "Crear".
export type PropuestaDelAsistente =
  | { tipo: 'claseUnica'; datos: CrearClaseUnicaInput; profesor: PersonaResumen }
  | { tipo: 'horario'; datos: Omit<CrearHorarioInput, 'desde' | 'claseId'>; profesor: PersonaResumen };

export type RespuestaDelAsistente = {
  historial: unknown[];
  texto: string;
  propuestas: PropuestaDelAsistente[];
};
```

Nota de la revisión final: el `.max(...)` de `historial` salió del esquema. Zod lo convertía en un 400 "Datos inválidos" y la web nunca mostraba el motivo ni podía ofrecer empezar de nuevo. Ahora lo controla `conversar`, que lanza `ReglaDeNegocioError` con el código `CONVERSACION_LARGA` (constante en `asistente.ts`). Cada pedido suma de 4 a 6 elementos, no 2.

Y `export * from './asistente.ts';` en `index.ts`.

`herramientas.ts`:

```ts
import type { PropuestaDelAsistente, Rol } from '@studio/shared';
import type { FechaDia } from '../../lib/fechas.ts';
import { buscarProfesores, listarClasesDelRango } from './consultas.ts';
import type { DefinicionDeHerramienta } from './modelo.ts';
import { proponerClaseUnica, proponerHorario } from './propuestas.ts';

export type ContextoDeHerramienta = { hoy: FechaDia };

// `resultado` vuelve al modelo. `propuesta` va a la web, que la muestra como tarjeta.
export type SalidaDeHerramienta = { resultado: Record<string, unknown>; propuesta?: PropuestaDelAsistente };

// Una herramienta lanza ZodError o un error de dominio cuando no puede: el service se lo pasa al modelo.
export type Herramienta = DefinicionDeHerramienta & {
  soloAdmin: boolean;
  ejecutar(argumentos: Record<string, unknown>, contexto: ContextoDeHerramienta): Promise<SalidaDeHerramienta>;
};

const TODAS: Herramienta[] = [buscarProfesores, listarClasesDelRango, proponerClaseUnica, proponerHorario];

export function herramientasPara(rol: Rol): Herramienta[] {
  return TODAS.filter((herramienta) => rol === 'admin' || !herramienta.soloAdmin);
}
```

`consultas.ts`:

```ts
import { z } from 'zod';
import { fechaDiaSchema } from '@studio/shared';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { sumarDias } from '../../lib/fechas.ts';
import { listarClases } from '../clases/clases.service.ts';
import { listarProfesores } from '../profesores/profesores.service.ts';
import type { Herramienta } from './herramientas.ts';

const DIAS_MAXIMOS = 31;

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Solo id, nombre y apellido: el plan gratuito de Gemini no puede recibir datos personales.
export const buscarProfesores: Herramienta = {
  nombre: 'buscar_profesores',
  descripcion: 'Busca profesores activos por nombre, apellido o los dos. Devuelve su id, que piden las demás funciones.',
  parametros: {
    type: 'object',
    properties: { texto: { type: 'string', description: 'Nombre, apellido o los dos, por ejemplo "Martín" o "Gómez"' } },
    required: ['texto'],
  },
  soloAdmin: false,
  async ejecutar(argumentos, { hoy }) {
    const buscado = sinTildes(z.object({ texto: z.string().trim().min(1) }).parse(argumentos).texto);
    const profesores = (await listarProfesores(false, hoy))
      .filter(
        (p) => sinTildes(`${p.nombre} ${p.apellido}`).includes(buscado) || sinTildes(`${p.apellido} ${p.nombre}`).includes(buscado),
      )
      .map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));
    return { resultado: { profesores } };
  },
};

export const listarClasesDelRango: Herramienta = {
  nombre: 'listar_clases',
  descripcion: `Lista las clases entre dos fechas, de hasta ${DIAS_MAXIMOS} días, con horario, estilo, profesor y estado.`,
  parametros: {
    type: 'object',
    properties: {
      desde: { type: 'string', description: 'Primer día, AAAA-MM-DD' },
      hasta: { type: 'string', description: 'Último día, AAAA-MM-DD, igual o posterior a desde' },
    },
    required: ['desde', 'hasta'],
  },
  soloAdmin: false,
  async ejecutar(argumentos, { hoy }) {
    const { desde, hasta } = z.object({ desde: fechaDiaSchema, hasta: fechaDiaSchema }).parse(argumentos);
    if (hasta < desde) throw new ReglaDeNegocioError('hasta tiene que ser igual o posterior a desde');
    if (hasta > sumarDias(desde, DIAS_MAXIMOS - 1)) throw new ReglaDeNegocioError(`El rango es de ${DIAS_MAXIMOS} días como máximo`);
    const { items, finDelHorizonte } = await listarClases(desde, hasta, hoy);
    const clases = items.map((clase) => ({
      id: clase.id,
      fecha: clase.fecha,
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      estilo: clase.estilo,
      nivel: clase.nivel,
      profesor: `${clase.profesor.nombre} ${clase.profesor.apellido}`,
      estado: clase.estado,
      repiteCadaSemana: clase.horarioId !== null,
    }));
    return { resultado: { finDelHorizonte, clases } };
  },
};
```

`propuestas.ts`:

```ts
import { crearClaseUnicaSchema, crearHorarioSchema } from '@studio/shared';
import { db } from '../../db/client.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import type { Herramienta } from './herramientas.ts';

export const PROPUESTA_MOSTRADA = {
  estado: 'propuesta mostrada al usuario',
  siguientePaso: 'El usuario la confirma con el botón Crear. Todavía no se creó nada.',
};

const CAMPOS_DE_UNA_CLASE = {
  horaInicio: { type: 'string', description: 'Hora de inicio, HH:MM de 24 horas' },
  horaFin: { type: 'string', description: 'Hora de fin, HH:MM, posterior a horaInicio' },
  estilo: { type: 'string', description: 'Estilo de danza, por ejemplo "Hip-Hop"' },
  nivel: { type: 'string', description: 'Opcional, por ejemplo "Inicial"' },
  profesorId: { type: 'integer', description: 'El id que devuelve buscar_profesores' },
} as const;

export const proponerClaseUnica: Herramienta = {
  nombre: 'proponer_clase_unica',
  descripcion:
    'Propone una clase de una sola fecha, como un workshop o una recuperación. No crea nada: el usuario la ve en una tarjeta y la confirma.',
  parametros: {
    type: 'object',
    properties: { fecha: { type: 'string', description: 'Día de la clase, AAAA-MM-DD, de hoy en adelante' }, ...CAMPOS_DE_UNA_CLASE },
    required: ['fecha', 'horaInicio', 'horaFin', 'estilo', 'profesorId'],
  },
  soloAdmin: true,
  async ejecutar(argumentos, { hoy }) {
    const datos = crearClaseUnicaSchema.parse(argumentos);
    if (datos.fecha < hoy) throw new ReglaDeNegocioError(`El ${datos.fecha} ya pasó: una clase nueva va de hoy en adelante`);
    const profesor = await verificarProfesorActivo(db, datos.profesorId);
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'claseUnica', datos, profesor } };
  },
};

export const proponerHorario: Herramienta = {
  nombre: 'proponer_horario',
  descripcion:
    'Propone una clase que se repite todas las semanas desde esta semana. No crea nada: el usuario la ve en una tarjeta y la confirma.',
  parametros: {
    type: 'object',
    properties: { diaSemana: { type: 'integer', description: 'Día de la semana: 1 es lunes y 7 es domingo' }, ...CAMPOS_DE_UNA_CLASE },
    required: ['diaSemana', 'horaInicio', 'horaFin', 'estilo', 'profesorId'],
  },
  soloAdmin: true,
  async ejecutar(argumentos) {
    // Desde qué semana rige no lo elige el modelo: desde esta.
    const { desde: _desde, claseId: _claseId, ...datos } = crearHorarioSchema.parse(argumentos);
    const profesor = await verificarProfesorActivo(db, datos.profesorId);
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'horario', datos, profesor } };
  },
};
```

Si `as const` en `CAMPOS_DE_UNA_CLASE` choca con el tipo `EsquemaDeCampo`, declararlo como `Record<string, EsquemaDeCampo>`.

- [x] **Paso 4:** correr `pnpm --filter @studio/api test herramientas` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): herramientas para consultar y proponer clases`.

### Tarea 3: La conversación por la API

**Archivos:**
- Crear: `apps/api/src/modules/asistente/instrucciones.ts`, `asistente.service.ts`, `asistente.routes.ts`, `asistente.test.ts`, `apps/api/test/modelo-falso.ts`
- Modificar: `apps/api/src/app.ts`, `apps/api/test/app.ts`

**Consume:** `ModeloDeLenguaje` (tarea 1), `herramientasPara` y `mensajeAlAsistenteSchema` (tarea 2).
**Produce:** `POST /api/asistente/mensajes`, `conversar(modelo, entrada, contexto)`, `crearModeloFalso(guion)`, la opción `modelo` de `buildApp`.

- [x] **Paso 1:** escribir el modelo falso y los tests de integración. `apps/api/test/modelo-falso.ts`:

```ts
import type { LlamadaAHerramienta, ModeloDeLenguaje, PedidoAlModelo } from '../src/modules/asistente/modelo.ts';

export type TurnoGuionado = { texto?: string; llamadas?: Omit<LlamadaAHerramienta, 'id'>[] };

// Responde con los turnos del guion, en orden, y guarda cada pedido para que el test lo mire. Su historial
// es legible ({ rol, ... }), no el de Gemini.
export function crearModeloFalso(guion: TurnoGuionado[]): ModeloDeLenguaje & { pedidos: PedidoAlModelo[] } {
  const pendientes = [...guion];
  const pedidos: PedidoAlModelo[] = [];
  return {
    pedidos,
    agregarMensaje: (historial, texto) => [...historial, { rol: 'usuario', texto }],
    agregarResultados: (historial, resultados) => [
      ...historial,
      { rol: 'resultados', resultados: resultados.map((r) => ({ nombre: r.llamada.nombre, resultado: r.resultado })) },
    ],
    async responder(pedido) {
      pedidos.push(pedido);
      const turno = pendientes.shift();
      if (turno === undefined) throw new Error('El modelo falso se quedó sin guion');
      const llamadas = (turno.llamadas ?? []).map((llamada, i) => ({ id: `llamada-${pedidos.length}-${i}`, ...llamada }));
      const texto = turno.texto ?? '';
      return { historial: [...pedido.historial, { rol: 'modelo', texto, llamadas }], texto, llamadas };
    },
  };
}
```

`asistente.test.ts` sigue a `auth.test.ts`, pero cada test crea su app con `crearAppDeTest({ modelo })`: el guion cambia en cada uno. El recorrido principal:

```ts
it('busca al profesor, propone la clase única y no la crea', async () => {
  await crearUsuarioDeTest(ADMIN);
  const erik = await crearProfesorDeTest();
  const modelo = crearModeloFalso([
    { llamadas: [{ nombre: 'buscar_profesores', argumentos: { texto: 'Erik' } }] },
    {
      llamadas: [
        {
          nombre: 'proponer_clase_unica',
          argumentos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: erik.id },
        },
      ],
    },
    { texto: 'Te dejé la propuesta. Tocá Crear para confirmarla.' },
  ]);
  app = await crearAppDeTest({ modelo });
  const cookie = await loguear(app, ADMIN.email, ADMIN.password);

  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/asistente/mensajes',
    headers: { cookie },
    payload: { historial: [], mensaje: 'Creame una clase de Hip-Hop mañana de 8 a 9:30 con Erik' },
  });

  expect(respuesta.statusCode).toBe(200);
  expect(respuesta.json()).toEqual({
    historial: expect.any(Array),
    texto: 'Te dejé la propuesta. Tocá Crear para confirmarla.',
    propuestas: [
      {
        tipo: 'claseUnica',
        datos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: erik.id },
        profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      },
    ],
  });
  expect(modelo.pedidos[1]?.historial.at(-1)).toEqual({
    rol: 'resultados',
    resultados: [{ nombre: 'buscar_profesores', resultado: { profesores: [{ id: erik.id, nombre: 'Erik', apellido: 'Zapata' }] } }],
  });
  const clases = await app.inject({ method: 'GET', url: '/api/clases?desde=2026-03-11', headers: { cookie } });
  expect(clases.json().items).toEqual([]);
});
```

Los demás casos, con aserciones completas:
  - Las instrucciones del primer pedido contienen "Hoy es martes 2026-03-10" para admin; para recepción contienen "No podés crear ni cambiar clases".
  - Para recepción, `modelo.pedidos[0].herramientas.map((h) => h.nombre)` es `['buscar_profesores', 'listar_clases']`. Con un guion que pide `proponer_clase_unica`, el resultado que vuelve al modelo es `{ error: 'No existe la herramienta proponer_clase_unica' }` y `propuestas` queda vacío.
  - Con `profesorId: 'siete'`, el modelo recibe `{ error: 'profesorId: Expected number, received string' }`, el mensaje de Zod 3, y la respuesta es 200.
  - Con una fecha pasada, el modelo recibe `{ error: 'El 2026-03-09 ya pasó: una clase nueva va de hoy en adelante' }`.
  - Un guion de 6 turnos que siempre llaman a `buscar_profesores` responde 422 y el modelo recibió 6 pedidos.
  - Sin cookie 401; `mensaje: '  '` 400; con `crearAppDeTest()` sin modelo, 503 con `{ error: 'El asistente no está configurado: falta GEMINI_API_KEY en el .env de la API', codigo: 'ASISTENTE_SIN_CONFIGURAR' }`.
  - Un historial que vuelve en el segundo mensaje llega al modelo con el mensaje nuevo al final.

- [x] **Paso 2:** correr `pnpm --filter @studio/api test asistente` y verificar que fallan porque la ruta no existe (404).
- [x] **Paso 3:** implementar. `instrucciones.ts` arma el texto de la sección "Instrucciones del modelo" con `diaSemanaIso(hoy)` y una lista de nombres de días. `asistente.service.ts`:

```ts
import { ZodError } from 'zod';
import type { MensajeAlAsistenteInput, PropuestaDelAsistente, RespuestaDelAsistente, Rol } from '@studio/shared';
import { esErrorDeDominio, ReglaDeNegocioError } from '../../lib/errores.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { herramientasPara, type ContextoDeHerramienta, type Herramienta, type SalidaDeHerramienta } from './herramientas.ts';
import { instrucciones } from './instrucciones.ts';
import type { LlamadaAHerramienta, ModeloDeLenguaje, ResultadoDeHerramienta } from './modelo.ts';

// Cada vuelta es un pedido al modelo y gasta cuota: un pedido normal usa 2 a 4.
const VUELTAS_MAXIMAS = 6;

export async function conversar(
  modelo: ModeloDeLenguaje,
  entrada: MensajeAlAsistenteInput,
  contexto: { hoy: FechaDia; rol: Rol },
): Promise<RespuestaDelAsistente> {
  const herramientas = herramientasPara(contexto.rol);
  const texto = instrucciones(contexto.hoy, contexto.rol);
  const propuestas: PropuestaDelAsistente[] = [];
  let historial = modelo.agregarMensaje(entrada.historial, entrada.mensaje);

  for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS; vuelta++) {
    const turno = await modelo.responder({ instrucciones: texto, historial, herramientas });
    historial = turno.historial;
    if (turno.llamadas.length === 0) return { historial, texto: turno.texto, propuestas };

    const resultados: ResultadoDeHerramienta[] = [];
    for (const llamada of turno.llamadas) {
      const salida = await ejecutar(herramientas, llamada, { hoy: contexto.hoy });
      if (salida.propuesta !== undefined) propuestas.push(salida.propuesta);
      resultados.push({ llamada, resultado: salida.resultado });
    }
    historial = modelo.agregarResultados(historial, resultados);
  }
  throw new ReglaDeNegocioError('El asistente no llegó a una respuesta. Probá con un pedido más concreto.');
}

// Un error esperable vuelve al modelo para que se lo explique al usuario. Uno inesperado corta el pedido.
async function ejecutar(
  herramientas: Herramienta[],
  llamada: LlamadaAHerramienta,
  contexto: ContextoDeHerramienta,
): Promise<SalidaDeHerramienta> {
  const herramienta = herramientas.find((h) => h.nombre === llamada.nombre);
  if (herramienta === undefined) return { resultado: { error: `No existe la herramienta ${llamada.nombre}` } };
  try {
    return await herramienta.ejecutar(llamada.argumentos, contexto);
  } catch (error) {
    if (error instanceof ZodError) {
      return { resultado: { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } };
    }
    if (esErrorDeDominio(error)) return { resultado: { error: error.message } };
    throw error;
  }
}
```

`asistente.routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { mensajeAlAsistenteSchema } from '@studio/shared';
import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { conversar } from './asistente.service.ts';
import type { ModeloDeLenguaje } from './modelo.ts';

export async function rutasAsistente(app: FastifyInstance, { modelo }: { modelo: ModeloDeLenguaje | null }): Promise<void> {
  app.post('/api/asistente/mensajes', { preHandler: requerirRol('recepcion') }, async (request) => {
    const entrada = mensajeAlAsistenteSchema.parse(request.body);
    if (modelo === null) {
      throw new ServicioNoDisponibleError(
        'El asistente no está configurado: falta GEMINI_API_KEY en el .env de la API',
        'ASISTENTE_SIN_CONFIGURAR',
      );
    }
    const rol = request.usuario?.rol === 'admin' ? 'admin' : 'recepcion';
    return conversar(modelo, entrada, { hoy: app.hoy(), rol });
  });
}
```

En `app.ts`, sumar a `OpcionesApp`:

```ts
  // El modelo del asistente. Sin `modelo`, se arma con la configuración; `null` lo deja apagado.
  modelo?: ModeloDeLenguaje | null;
```

y registrar la ruta:

```ts
  const modelo =
    opciones.modelo !== undefined
      ? opciones.modelo
      : config.gemini.clave === undefined
        ? null
        : crearModeloGemini({ clave: config.gemini.clave, modelo: config.gemini.modelo, respaldo: config.gemini.respaldo });
  app.register(rutasAsistente, { modelo });
```

En `test/app.ts`, `crearAppDeTest` pasa `modelo: null` antes de `...opciones`: un test nunca llama a Google aunque la máquina tenga la clave en el entorno.

- [x] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): conversar con el asistente por la API`.

### Tarea 4: La pantalla del chat

**Archivos:**
- Crear: `apps/web/src/features/asistente/api.ts`, `AsistentePage.tsx`, `asistente.test.tsx`
- Modificar: `apps/web/src/rutas.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/components/ui/Icono.tsx`

**Consume:** `RespuestaDelAsistente`, `MensajeAlAsistenteInput` y `LARGO_MAXIMO_DEL_MENSAJE` (tarea 2), `POST /api/asistente/mensajes` (tarea 3).
**Produce:** la ruta `/asistente` y el lugar donde la tarea 5 muestra las tarjetas.

- [x] **Paso 1:** escribir `asistente.test.tsx` con MSW, como `clase.test.tsx`. Casos:
  - Escribir "¿Qué clases hay mañana?" en el campo "Mensaje para el asistente" y tocar "Enviar" muestra el mensaje y la respuesta "Mañana hay Hip-Hop a las 19:00.". El cuerpo recibido es `{ historial: [], mensaje: '¿Qué clases hay mañana?' }`.
  - El segundo envío manda el `historial` que devolvió el primero, por ejemplo `[{ rol: 'usuario' }, { rol: 'modelo' }]`.
  - Enter envía; Shift+Enter agrega un renglón y no manda nada.
  - Con un 503 `{ error: 'Se alcanzó el límite de pedidos del plan gratuito. Probá en un minuto; si sigue, la cuota del día se renueva mañana.', codigo: 'CUOTA_AGOTADA' }`, se ve ese texto y el campo conserva lo escrito.
  - Mientras espera, el botón "Enviar" está deshabilitado y se ve "Pensando...".
  - Recepción ve "Asistente" en el menú, en la sección Recepción.
- [x] **Paso 2:** correr `pnpm --filter @studio/web test asistente` y verificar que fallan porque la ruta no existe.
- [x] **Paso 3:** implementar.
  - `api.ts`: `useConversar()`, un `useMutation` que hace `api.post<RespuestaDelAsistente>('/asistente/mensajes', entrada)`.
  - `AsistentePage.tsx` dentro de `Pagina` con título "Asistente". El estado: `historial: unknown[]` y `mensajes: { id: number; autor: 'usuario' | 'asistente'; texto: string; propuestas: PropuestaDelAsistente[] }[]`. Al enviar se agrega el mensaje del usuario; con la respuesta se reemplaza el historial y se agrega el mensaje del asistente. Si falla, se quita el mensaje del usuario, el texto vuelve al campo y el error se muestra con `Aviso` y `mensajeDeError`. El texto del asistente va con `whitespace-pre-wrap`, sin interpretar Markdown. La lista baja sola al último mensaje.
  - El campo es `AreaDeTexto` con `aria-label="Mensaje para el asistente"` y `maxLength={LARGO_MAXIMO_DEL_MENSAJE}`.
  - Sin mensajes, la página muestra ejemplos en `text-tenue`: "¿Qué clases hay el jueves?" y, para administradores, "Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik".
  - Ruta `{ path: 'asistente', element: <AsistentePage /> }` junto a `alumnos`, fuera de `SoloAdmin`. En `Layout.tsx`, `{ ruta: '/asistente', texto: 'Asistente', icono: 'asistente' }` en Recepción, debajo de "Alumnos".
  - Ícono `asistente` en `Icono.tsx`, copiado de Tabler `message-chatbot` (verificar los trazos en tabler.io):

```ts
  asistente: [
    'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z',
    'M9.5 9h.01',
    'M14.5 9h.01',
    'M9.5 13a3.5 3.5 0 0 0 5 0',
  ],
```

- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): pantalla de chat`.

### Tarea 5: Confirmar una propuesta

**Archivos:**
- Crear: `apps/web/src/features/asistente/TarjetaDePropuesta.tsx`
- Modificar: `apps/web/src/features/asistente/AsistentePage.tsx`, `asistente.test.tsx`

**Consume:** `PropuestaDelAsistente` (tarea 2), `useCrearClaseUnica` y `useCrearHorario` de `features/grilla/api.ts`.

- [x] **Paso 1:** sumar a `asistente.test.tsx`:
  - Una respuesta con la propuesta `claseUnica` del ejemplo de la API muestra una tarjeta con "Clase única", "Hip-Hop", la fecha con `formatearFechaLarga` (buscarla con `/sábado,? 17 de octubre/`, porque Intl puede agregar la coma), "15:00 a 17:00" y "Erik Zapata".
  - "Crear" manda `POST /api/clases` con `{ fecha: '2026-10-17', horaInicio: '15:00', horaFin: '17:00', estilo: 'Hip-Hop', profesorId: 7 }`. Mientras espera, el botón está deshabilitado; cuando responde 201, el botón no está más y se ve "Creada" con un enlace "Ver en la grilla" a `/grilla?fecha=2026-10-17`.
  - Una propuesta `horario` muestra "Todas las semanas" y "martes", y "Crear" manda `POST /api/horarios` con sus `datos`.
  - Un 422 al crear muestra el motivo en la tarjeta y el botón vuelve a estar habilitado.
- [x] **Paso 2:** correr `pnpm --filter @studio/web test asistente` y verificar que fallan.
- [x] **Paso 3:** implementar `TarjetaDePropuesta` con un `useCrearClaseUnica` o un `useCrearHorario` según `propuesta.tipo`; cada tarjeta tiene su propia mutación, así crear una no deshabilita las otras. El enlace "Ver en la grilla" va a `/grilla?fecha=<fecha>` para una clase única (`GrillaPage` lee `fecha` y `vista` de la URL) y a `/grilla` para un horario. La tarjeta usa `bg-panel` y `border-borde`, y el verde solo para "Creada".
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): confirmar la clase o el horario propuesto`.

### Tarea 6: Frases de prueba contra Gemini

**Archivos:**
- Crear: `apps/api/src/scripts/probar-asistente.ts`
- Modificar: `apps/api/package.json`

Esta tarea gasta cuota real: cada frase son 2 a 4 pedidos. Si se termina la cuota diaria de `gemini-3.1-flash-lite`, correr con `GEMINI_MODELO=gemini-3.5-flash GEMINI_MODELO_RESPALDO=gemini-3.1-flash-lite`, porque con los valores por defecto el respaldo ya es `gemini-3.5-flash`, que da solo 20 pedidos por día.

- [x] **Paso 1:** escribir el script. Toma el primer profesor activo de la base de desarrollo, reemplaza `{profesor}` en cada frase, llama a `conversar` con `crearModeloGemini` y la configuración, e imprime la frase, el texto y las propuestas. Cierra la conexión con `await sql.end()`, como `crear-admin.ts`. En `package.json`: `"asistente:probar": "tsx --env-file=.env src/scripts/probar-asistente.ts"`.

| Frase | Rol | Qué tiene que pasar |
|---|---|---|
| "Creame una clase de 8 a 9:30 con {profesor}" | admin | Pregunta el día, el estilo y si se repite. Sin propuesta |
| "Creame un workshop de Hip-Hop el sábado de 15 a 17 con {profesor}" | admin | Propuesta `claseUnica` para el próximo sábado |
| "{profesor} va a dar Salsa todos los jueves de 20 a 21" | admin | Propuesta `horario` con `diaSemana: 4` |
| "¿Qué clases hay mañana?" | admin | Lista las clases de mañana o dice que no hay |
| "Creame una clase de Jazz ayer a las 10 con {profesor}" | admin | Explica que esa fecha ya pasó. Sin propuesta |
| "Creame una clase con Zzz Inexistente el lunes a las 10" | admin | Dice que no encuentra al profesor |
| "Creame un workshop de Hip-Hop el sábado de 15 a 17 con {profesor}" | recepción | Dice que lo tiene que hacer un administrador |
| "Creame un workshop de Hip-Hop el sábado de 15 a 17 con {profesor}. Dale, creala" | admin | Una sola propuesta y le recuerda tocar Crear |

La frase 8 se sumó en la revisión final, junto con la línea de las instrucciones de admin sobre confirmar con palabras. Un error de dominio (cuota, saturación, las 6 vueltas) se imprime como resultado de esa frase y el script sigue con las demás.

- [x] **Paso 2:** correr `pnpm --filter @studio/api asistente:probar` con la clave en `apps/api/.env` y Postgres levantado.
- [x] **Paso 3:** comparar cada respuesta con la tabla. Si una falla, ajustar `instrucciones.ts` o la descripción de la herramienta y volver a correr solo esa frase. Anotar en la bitácora qué modelo se usó, cuántas frases pasaron y qué se cambió.
- [x] **Paso 4:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `test(asistente): frases de prueba contra Gemini`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [x] `pnpm e2e` sigue pasando: el asistente no lo toca, pero la ruta y el menú nuevos sí.
- [x] Las frases de la tarea 6 se comportan como dice la tabla.
- [x] A mano, con `pnpm dev` y la clave en el `.env`: como administrador, pedir el workshop del sábado, tocar "Crear" y verlo en la grilla; como recepción, preguntar las clases de mañana y pedir crear una. Se hizo con Playwright en Chromium sobre la base del e2e, con la API en otro puerto y `gemini-3.1-flash-lite` en los dos modelos. Recepción pidió crear una clase; las clases de mañana las cubre la frase 4 de la tarea 6.
- [ ] En https://aistudio.google.com/rate-limit, anotar en la bitácora la cuota diaria de los dos modelos y cuánto gastó la verificación. Pendiente: necesita la cuenta de Google del estudio. Un 429 de Google ya dijo que `gemini-3.5-flash` permite 20 pedidos por día; la de `gemini-3.1-flash-lite` no se conoce.
