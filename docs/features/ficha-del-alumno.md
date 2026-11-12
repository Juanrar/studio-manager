# Ficha del alumno con actividad

**Estado:** lista  
**Depende de:** estado-del-pack-en-alumnos  
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; la ficha del alumno muestra en el encabezado el estado de su pack y el pack que está usando, y tiene tres pestañas: Actividad (asistencias, pagos y alta agrupados por mes), Datos y Pagos.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Referencia:** el panel del alumno de la maqueta estilo Twenty (variante A).

## Qué devuelve la API

`GET /api/alumnos/:id` pasa a devolver la ficha: el alumno y además

- `alta`: el día en que se lo cargó, en la zona del estudio.
- `estadoPack` y `pagoActual`, con las mismas reglas que el listado.

`GET /api/alumnos/:id/actividad` (nuevo) devuelve `{ items }`, del hecho más nuevo al más viejo:

- `{ tipo: 'asistencia', fecha, clase, profesor }`: `fecha` es el día de la clase, `clase` su estilo y `profesor` quien la dio (el suplente, si hubo).
- `{ tipo: 'pago', fecha, pack, monto, medio, anulado }`: `fecha` es el día del cobro en la zona del estudio.
- `{ tipo: 'alta', fecha }`.

Reglas:

- Las asistencias anotadas para más adelante no aparecen hasta ese día, igual que la última clase del listado. (Cambió en [Clases anotadas en la actividad](clases-anotadas-en-la-actividad.md): ahora aparecen como anotadas).
- Los pagos anulados aparecen, marcados: la anulación es parte de la historia del alumno.
- En un mismo día va primero la asistencia, después el pago y al final el alta. Es el orden inverso al que ocurren cuando alguien se anota, paga y toma su primera clase el mismo día.

## Arquitectura

- **`crearAlumno` recibe `ahora`**, como los pagos y las asistencias: el alta toma el reloj de la app y no el `now()` de la base. Así un test fija el día del alta.
- **`alumnos/ficha.service.ts` arma la ficha y la actividad.** Usa `pagos.service` y `asistencias.service`, que ya importan `alumnos.service`; por eso vive aparte, igual que `listado.service.ts`.
- **`asistencias.service` expone `asistenciasDeAlumno(alumnoId, hasta)`**: día, estilo de la clase y profesor de la sesión.
- **`ResumenDelPack` pasa a `packages/shared`**: lo usan el listado y la ficha.

## Pantalla

- **Encabezado:** inicial, nombre, estado del pack (o "Dado de baja") y el pack que está usando.
- **"Registrar pago" va en la barra del panel**, como en la maqueta: se cobra desde cualquier pestaña.
- **Actividad**, la pestaña que se abre primero: los hechos agrupados por mes, con un ícono por tipo y el día a la derecha.
- **Datos** (rediseñada después, ver la bitácora del índice): en dos columnas. A la izquierda, Contacto con el botón "Editar": el teléfono con un botón "WhatsApp" (enlace `wa.me`, que abre la app o WhatsApp Web; `lib/whatsapp.ts` lo arma con el código de país argentino 54 9 y si el número no tiene 10 dígitos el botón queda desactivado, con el aviso "Falta el código de área en el teléfono") y el email con un botón "Copiar" que lo manda al portapapeles. Abajo, Identidad (DNI, nacimiento con la edad, alta). A la derecha, el contacto de emergencia en un recuadro ámbar y las notas. El pack, las clases restantes y el vencimiento ya no están: se ven en el encabezado y en el Resumen. No hay botón de llamar. Un ícono nuevo, `copiar` y `whatsapp`, se copió de Tabler a `Icono.tsx`.
- **Pagos:** la tabla de pagos con "Anular", con íconos en los encabezados.
- **Registrar o anular un pago recarga también las consultas de alumnos:** cambian el estado del pack en la ficha y en la lista de atrás.

## Qué no se implementa de la maqueta

- **"cargada por Recepción" en el alta**: la tabla `alumno` no guarda quién lo cargó.
- **"Estilo" en Datos**: el alumno no tiene un estilo propio, va a distintas clases.
- **Flechas para pasar al alumno anterior o siguiente, "abrir como página" y menú "⋯"**: ya se habían sacado en el rediseño.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| La ficha trae el día del alta en la zona del estudio y el estado del pack | Integración HTTP | Si el alta se toma en UTC, un alumno cargado a la noche figura dado de alta al día siguiente |
| La actividad junta las asistencias hasta hoy con quien dio la clase, los pagos (también los anulados) y el alta, del más nuevo al más viejo | Integración HTTP | Si se muestra al titular en lugar del suplente, o una clase anotada para la semana que viene, la historia cuenta algo que no pasó |
| La ficha y la actividad de un alumno que no existe responden 404 | Integración HTTP | Si la actividad no busca al alumno, responde una lista vacía o un 500 |
| El encabezado muestra el estado y el pack, y la actividad se agrupa por mes con el año | Web | Si se agrupa solo por mes, marzo de este año se mezcla con el del anterior |
| La pestaña Datos muestra DNI, nacimiento con la edad y alta, "Vacío" en lo que falta, y no repite el pack | Web | Si la edad se calcula sin restar el cumpleaños que todavía no llegó, o se esconde un campo vacío, recepción ve un dato falso o no sabe qué falta cargar |
| Datos muestra el teléfono y solo ofrece "Copiar" si hay email | Web | Si el botón aparece sin email, copia "null" al portapapeles |
| "Copiar" manda el email al portapapeles y avisa "Copiado" | Web | Si copia otro dato o no avisa, recepción pega algo equivocado sin saberlo |
| "WhatsApp" abre `wa.me` con el número completo en otra pestaña; con un teléfono que no sirve queda desactivado y dice por qué, y sin teléfono no aparece | Web | Si el enlace queda sin `noopener`, la pestaña de WhatsApp controla la ficha; si aparece con un número corto, abre un chat con un desconocido |
| `enlaceDeWhatsapp` arma 54 9 + 10 dígitos desde formatos como `11 5555-0000`, `(011) 5555-0000` o `+54 11 5555-0000`, y devuelve `null` si no puede | Unitario | Si no saca el 0 inicial o no agrega el 9, WhatsApp no encuentra el número |
| Datos destaca el contacto de emergencia y las notas, y avisa cuando faltan | Web | Si un contacto de emergencia vacío no se avisa, recepción no se entera de que falta en una emergencia |
| "Editar" en Datos abre el formulario con todos los datos | Web | Si el botón se pierde en el rediseño, el alumno no se puede editar |
| Registrar un pago manda pack y medio, y actualiza la ficha y la lista | Web (reemplaza al de registrar) | Si después de cobrar no se recargan las consultas de alumnos, la ficha y la lista siguen diciendo "Sin pack" |
| Los tests de pagos y del panel pasan por las pestañas nuevas | Web (adaptados) | Si la tabla de pagos o el cierre del panel quedan inaccesibles, recepción no puede anular ni volver a la lista |
| Recorrido de punta a punta | E2E (adaptado) | Si el cobro desde la ficha deja de funcionar con las pestañas, recepción no puede cobrar |

---

### Tarea 1: La ficha en la API

**Archivos:**
- Crear: `apps/api/src/modules/alumnos/ficha.service.ts`
- Modificar: `alumnos.service.ts`, `alumnos.repository.ts`, `alumnos.routes.ts`, `apps/api/test/fabricas.ts`, `apps/api/src/modules/pagos/estado-del-pack.ts`, `packages/shared/src/alumnos.ts`, `packages/shared/src/pagos.ts`
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`

- [x] **Paso 1:** escribir el test HTTP de la ficha.
- [x] **Paso 2:** correrlo y verificar que falla porque la respuesta no trae `alta` ni el estado del pack.
- [x] **Paso 3:** implementar `crearAlumno` con `ahora`, la consulta con el alta y `obtenerFicha`.
- [x] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): ficha con el alta y el estado del pack`.

### Tarea 2: La actividad en la API

**Archivos:**
- Modificar: `ficha.service.ts`, `alumnos.routes.ts`, `asistencias.repository.ts`, `asistencias.service.ts`, `packages/shared/src/alumnos.ts`
- Test: `apps/api/src/modules/alumnos/alumnos.test.ts`

- [x] **Paso 1:** escribir el test de la actividad y el de 404.
- [x] **Paso 2:** correrlos y verificar que fallan porque la ruta no existe.
- [x] **Paso 3:** implementar la consulta de asistencias, `actividadDelAlumno` y la ruta.
- [x] **Paso 4:** correr los tests de la API y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(alumnos): actividad del alumno`.

Cambio al plan: en la asistencia, `profesor` es `{ id, nombre, apellido }`, igual que en las sesiones y la agenda, y no un texto armado.

### Tarea 3: La ficha en la web

**Archivos:**
- Crear: `apps/web/src/features/alumnos/EstadoDelPack.tsx` (insignia y barra que comparten la lista y la ficha)
- Modificar: `FichaAlumnoPage.tsx`, `AlumnosPage.tsx`, `alumnos/api.ts`, `pagos/PagosDelAlumno.tsx`, `pagos/api.ts`, `components/ui/index.tsx`, `Icono.tsx`, `lib/formato.ts`, `e2e/flujo-principal.spec.ts`
- Test: `apps/web/src/features/alumnos/ficha.test.tsx`, `alumnos.test.tsx`, `apps/web/test/datos.ts`

- [x] **Paso 1:** escribir los tests del encabezado, la actividad y Datos; adaptar los de pagos y el del panel a las pestañas.
- [x] **Paso 2:** correrlos y verificar que fallan porque no hay pestañas.
- [x] **Paso 3:** implementar `Pestanas`, el encabezado, las tres pestañas y "Registrar pago" en la barra del panel. Adaptar el paso de cobro del e2e.
- [x] **Paso 4:** correr los tests web, `pnpm typecheck` y `pnpm e2e`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): ficha del alumno con pestañas y actividad`.

Cambios al plan:
- El encabezado no tiene test propio: lo cubre el de registrar un pago, que ve "Sin pack" antes de cobrar y "Vigente" con el pack después.
- La actividad agrupa los meses con un `Map` armado a mano: `Map.groupBy` no existe en Safari anterior a 17.4, y Vite no agrega funciones que falten.
- En la tabla de pagos, el motivo de una anulación se parte en líneas. Si no, ensancha la columna Estado y "Anular" queda fuera del panel. Se vio en las capturas.
- `Pestanas` va en `components/ui`, con el patrón de ARIA: las flechas pasan de una pestaña a otra y el panel toma el nombre de la elegida.
- `PagosDelAlumno` se separó en la tabla (`PagosDelAlumno`) y el botón con su diálogo (`RegistrarPago`), que va en la barra del panel. `PanelLateral` ignora `false` en `acciones`, igual que `Pagina`.
- Los meses de la actividad salen de una lista propia ("Septiembre 2026"), la misma de la que salen los meses cortos.
- El medio de pago va con la preposición que corresponde: "en efectivo", "por transferencia", "con Mercado Pago". Con "otro" no se nombra.
- Las etiquetas de Datos son las del formulario ("Fecha de nacimiento", "Contacto de emergencia") y no las cortas de la maqueta.
- El e2e, después de cobrar, verifica "Vigente" en el encabezado de la ficha y busca el pago en la pestaña Pagos.

## Verificación final

- [x] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan: API 122, web 33, e2e 1.
- [x] Captura de la ficha con datos reales de la API, comparada con la maqueta, en escritorio y en celular: encabezado con estado y pack; actividad con asistencias (dos con suplente), un pago anulado y el alta de otro año; Datos y Pagos.

Encontrado durante la verificación, sin arreglar: `ClasesPage.tsx` también usa `Map.groupBy`, así que la pantalla de clases no anda en Safari anterior a 17.4.
