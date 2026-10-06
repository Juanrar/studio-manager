# Ficha del profesor con sus clases

**Estado:** lista
**Depende de:** ficha-del-alumno (20), frontend-administracion (15)
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; el listado de profesores se ve como el de alumnos, cada nombre abre la ficha del profesor en `/profesores/:id`, y ahí se ven las clases de la semana agrupadas por día, se editan en la misma fila y se agregan nuevas con el botón de cada día.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

**Diseño elegido:** con quien administra el estudio se eligió una ficha de página entera; cada clase es una fila de lectura que el lápiz vuelve editable en su lugar, y la hora se elige de un selector con una lista simple de franjas de 15 minutos. Las maquetas con las que se eligió eran locales y no se versionaron.

## Qué devuelve la API

### `GET /api/clases?profesorId=N`

El listado de clases acepta un filtro nuevo por profesor. Sin el parámetro responde lo mismo que hoy. `incluirInactivos=true` sigue sumando las clases dadas de baja. El orden no cambia: día, hora de inicio, id.

### `GET /api/profesores`

Cada profesor del listado suma dos campos calculados a partir de sus clases **activas**:

- `clasesPorSemana`: cuántas clases activas tiene en el horario semanal.
- `diasConClase`: los días ISO en los que da clase, de 1 (lunes) a 7 (domingo), ordenados y sin repetir.

Un profesor sin clases responde `clasesPorSemana: 0` y `diasConClase: []`. Las clases dadas de baja no cuentan nunca, aunque el listado pida `incluirInactivos=true`: ese parámetro es sobre los profesores, no sobre sus clases.

`GET /api/profesores/:id` no cambia: la ficha pide el profesor por un lado y sus clases por el otro.

## Arquitectura

- **`clases.repository.listar` recibe el filtro de profesor.** El filtro se arma en el repository con `and(...)`, como ya lo hace `listarDelDia`.
- **`profesores/listado.service.ts` es nuevo.** `clases.service` importa `profesores.service` (usa `verificarProfesorActivo`), así que `profesores.service` no puede importar `clases.service`: sería un ciclo. El listado con las clases vive aparte y usa los dos services, igual que `alumnos/listado.service.ts`. La ruta `GET /api/profesores` pasa a llamarlo a él.
- **`ProfesorEnListado` es `Profesor` más los dos campos.** `Profesor` queda igual, porque lo usan el selector de profesor de las clases y las suplencias de la agenda.
- **`SelectorDeHora` va en `components/ui`.** Es un campo de texto con un botón de reloj que abre la lista de horarios. No depende de profesores ni de clases: lo puede usar después la pantalla de clases.
- **La ficha es una página entera, no un panel lateral.** El alumno usa panel porque recepción vuelve todo el tiempo a la lista; el horario de un profesor es una pantalla de trabajo y necesita el ancho. La ruta `/profesores/:id` es hermana de `/profesores`, no hija.

## La grilla de 15 minutos

**Es una ayuda de la pantalla, no una regla del sistema.** La API sigue aceptando cualquier `HH:MM` y no se agrega ninguna validación nueva. Motivos: hay clases cargadas fuera de la grilla, una validación nueva las volvería imposibles de editar, y el estudio puede querer una clase a las 18:20 sin pedir un cambio de código.

En consecuencia:

- La lista del selector ofrece de 08:00 a 23:45 cada 15 minutos.
- Si la clase que se está editando tiene un horario fuera de la grilla, ese horario se agrega a la lista para no perderlo al abrirla.
- Siempre se puede tipear la hora a mano en el campo.

## Pantalla

### Listado de profesores (`/profesores`)

Se parece al de alumnos:

- Columnas con ícono en el encabezado: Profesor, Porcentaje, Clases por semana, Días, Teléfono, Alias o CBU, Estado.
- El nombre es un enlace con avatar a `/profesores/:id`, con el mismo estilo que el del alumno.
- **Días** muestra los días abreviados separados por coma ("Lun, Mié, Vie") y "—" si no tiene clases.
- La fila ya no tiene botones: Porcentajes, Editar y Dar de baja se mudan a la ficha.
- En la barra: un buscador por nombre, apellido o DNI y la casilla "Mostrar dados de baja" que ya existe.
- Al pie: "N profesores · M activos".

**El buscador filtra en el navegador.** `GET /api/profesores` devuelve todos los profesores sin paginar y un estudio tiene decenas, no miles. Compara sin distinguir mayúsculas ni tildes contra el nombre completo en los dos órdenes ("erik zapata" y "zapata erik" encuentran lo mismo, como en el buscador de alumnos) y contra el DNI. No se toca la API.

### Ficha del profesor (`/profesores/:id`)

- **Barra superior:** "Profesores / Nombre Apellido", donde "Profesores" vuelve al listado.
- **Encabezado:** avatar grande, nombre y las insignias de estado ("Activo" o "Dado de baja"), porcentaje vigente y cantidad de clases por semana.
- **Pestañas:** Clases (la que se abre primero), Datos y Porcentajes.
- **Clases:** las siete filas de la semana, de lunes a domingo, siempre las siete aunque estén vacías. Cada fila tiene el nombre del día a la izquierda, sus clases en el medio y un botón "+" a la derecha para agregar una clase a ese día. Un día sin clases dice "Sin clases".
- **Datos:** los datos personales con su ícono, como la pestaña Datos del alumno, y los botones "Editar" y "Dar de baja" / "Reactivar".
- **Porcentajes:** el historial y el formulario para agregar uno nuevo, lo mismo que hoy muestra el diálogo.
- En la barra de la pestaña Clases: la casilla "Mostrar clases dadas de baja".

### La fila de una clase

En lectura: `18:00 – 19:30`, la duración en gris, el estilo en negrita, el nivel como insignia violeta. Al pasar el mouse aparecen a la derecha el lápiz y el tacho. En una pantalla táctil se ven siempre: no hay mouse que las muestre, y escondidas igual recibirían el toque.

Una clase dada de baja, cuando la casilla la muestra, lleva la insignia "Dada de baja" y "Reactivar" en lugar del tacho.

En edición, la fila se convierte en campos en su lugar: hora de inicio, "–", hora de fin, estilo, nivel, y a la derecha "Cancelar" y "Guardar". Las columnas miden lo mismo en los dos estados para que nada se corra al entrar a editar.

- Solo una fila se edita a la vez.
- El "+" de un día agrega una fila nueva ya en edición, con 18:00 a 19:30 y los textos vacíos. Si ese día ya tiene una fila nueva abierta, el "+" la conserva con lo escrito.
- "Cancelar" en una fila nueva la descarta; en una existente deja todo como estaba.
- "Dar de baja" es `PATCH /api/clases/:id` con `activa: false`, y "Reactivar", con `activa: true`. Nada se borra, como en todo el sistema.
- Marcar o desmarcar la casilla no vacía la semana: mientras llegan las clases se siguen viendo las de antes, y la fila en edición conserva lo escrito.
- El error de la API se muestra debajo de la fila que se está editando, en rojo.

### El selector de hora

- Campo de texto angosto con la hora y un botón de reloj al lado.
- El reloj abre una lista de 08:00 a 23:45 cada 15 minutos, ya posicionada en el horario que tiene la clase.
- Al entrar al campo, la hora queda seleccionada entera: lo que se tipea la reemplaza.
- Lo que se tipea filtra la lista: escribir "19" deja las cuatro franjas de las 19, y "9" las de las 09.
- Flecha abajo y flecha arriba se mueven por la lista sin dar la vuelta, Enter elige, Escape cierra. Un clic afuera también cierra.
- La lista va en el body, por encima de todo. Se abre hacia arriba si no entra abajo, y se cierra si se desplaza lo que contiene al campo o cambia el tamaño de la ventana.

## Qué no se implementa

- **El botón de copiar las clases de un día a otro** que está en el software de referencia: se descartó al elegir el diseño.
- **La fila de "Indisponible"** del software de referencia: acá un día sin clases dice "Sin clases" y no hay un interruptor por día.
- **"Nueva clase" en la barra de la ficha:** tendría que elegir un día por su cuenta. El "+" de cada día alcanza y no es ambiguo.
- **La pantalla `/clases`:** queda como está. Sigue siendo la vista del horario completo del estudio y el único lugar donde se cambia el profesor titular de una clase.
- **Cambiar el profesor de una clase desde la ficha:** la ficha muestra las clases de ese profesor; mudarlas a otro se hace en `/clases`.
- **Paginación y búsqueda en la API de profesores:** el listado no la tiene y el buscador filtra en el navegador.

## Tests

| Test | Tipo | Por qué vale la pena: qué cambio lo rompe |
|---|---|---|
| `GET /api/clases?profesorId=N` devuelve solo las de ese profesor, ordenadas por día y hora | Integración HTTP | Si el filtro no se combina con el de activas, la ficha muestra clases dadas de baja o de otro profesor |
| Con `incluirInactivos=true` el filtro suma las clases dadas de baja de ese profesor y ninguna de otro | Integración HTTP | Si `incluirInactivos` no llega al filtro, la casilla "Mostrar clases dadas de baja" de la ficha no hace nada; si el filtro de profesor se pierde con ella, la ficha muestra las clases de todos |
| El filtro no valida al profesor: uno dado de baja trae sus clases y uno que no existe, una lista vacía | Integración HTTP | Si el listado verifica al profesor como `crearClase` (`verificarProfesorActivo`), la ficha de un profesor dado de baja responde 422 en vez de mostrar sus clases |
| Sin `profesorId` trae las activas de todos los profesores, y con `incluirInactivos=true` también las dadas de baja | Integración HTTP | Es el camino de la pantalla `/clases`, que la tarea 1 reescribió con `and(...condiciones)`. Si el filtro de activas queda atado al de profesor, `/clases` muestra las clases dadas de baja sin que nadie marque la casilla. Verificado con esa mutación |
| El listado de profesores trae `clasesPorSemana` y `diasConClase` sin repetir y ordenados, y en 0 y `[]` para quien no tiene clases | Integración HTTP | Si se cuentan las clases dadas de baja o se repite un día con dos clases, el listado miente sobre la carga del profesor |
| Las clases dadas de baja no cuentan aunque el listado pida `incluirInactivos=true` | Integración HTTP | Si el parámetro se pasa también a las clases, un profesor dado de baja aparece con clases que ya no da |
| Cada profesor trae su propio porcentaje vigente, en el listado y en `GET /api/profesores/:id` | Integración HTTP | En una consulta de una sola tabla, Drizzle escribe `${profesor.id}` como `"id"`, y dentro de la subconsulta del porcentaje ese `"id"` es el del porcentaje: la subconsulta deja de mirar al profesor y todos muestran el mismo porcentaje en el listado y en la ficha. Encontrado en el recorrido a mano |
| El reloj abre la lista con las 64 franjas de 15 minutos y volver a tocarlo la cierra | Web (unitario de componente) | Si el reloj solo abre, la lista tapa la fila hasta hacer clic afuera. Si las franjas no son de 15 minutos, la grilla no es la que se acordó con el estudio |
| Tocar el reloj enfoca el campo sin desplazar el área | Web (unitario de componente) | Si el reloj enfoca con un `focus()` común, el navegador desplaza el área para mostrar un campo cortado por el borde, ese scroll cierra la lista recién abierta y el reloj parece no hacer nada |
| Con una hora cargada, un clic en el campo y tipear "19" reemplaza la hora y deja las cuatro franjas de las 19 | Web (unitario de componente) | Si el campo no selecciona la hora al recibir el foco, el clic deja el cursor al final y tipear "19" sobre 18:00 da "18:0019", que no es una hora ni filtra la lista |
| Tipear "19" deja las cuatro franjas de las 19 y avisa de cada tecla; "193" y "19:3" dejan 19:30; "21" no trae las 12:15; lo que no coincide deja todas | Web (unitario de componente) | Si la lista no filtra, cargar una clase a las 21:00 obliga a scrollear 52 franjas. Si la comparación no ignora los dos puntos, quien tipea la hora completa no la encuentra. Si busca en cualquier parte del texto, una hora trae franjas de otras horas. Si la lista se vacía, no hay cómo elegir sin borrar el campo |
| Tipear "9", "8", "9:30" o "930" encuentra las franjas de la mañana | Web (unitario de componente) | Si la comparación no le agrega el cero de adelante a una cifra de 3 a 9, "9" no coincide con ninguna franja y la lista queda entera, y "930" no encuentra las 09:30 |
| Un horario fuera de la grilla aparece en la lista al editar esa clase | Web (unitario de componente) | Si no se agrega, abrir el selector de una clase de las 18:20 la cambia sin que nadie lo pida |
| Elegir una franja avisa con `alCambiar`, cierra la lista y deja el foco en el campo | Web (unitario de componente) | Si elegir con el mouse saca el foco del campo, el teclado deja de responder después de elegir |
| Al abrir, el horario actual queda marcado y en el medio de la lista; las flechas lo mantienen a la vista | Web (unitario de componente) | Si la lista abre desde arriba, editar una clase de las 21:00 muestra las 08:00 y obliga a buscar la hora |
| Flecha abajo abre la lista, las flechas marcan, Enter elige y Escape cierra sin cambiar la hora | Web (unitario de componente) | Si Escape elige la franja marcada, cerrar la lista cambia la hora de la clase. Si Enter sin franja marcada elige la primera, tipear "19" y Enter guarda 19:00 sin que nadie lo pida |
| En 08:00 la flecha arriba y en 23:45 la flecha abajo no se mueven | Web (unitario de componente) | Si se saca el tope del índice, la flecha en una punta de la lista desmarca la franja y la siguiente salta a la otra punta |
| El campo apunta a la lista con `aria-controls` y a la franja marcada con `aria-activedescendant`, y los saca al cerrar | Web (unitario de componente) | El foco nunca sale del campo: sin esos atributos, un lector de pantalla no anuncia la franja al moverse con las flechas. Si quedan al cerrar, apuntan a una lista que ya no existe |
| Enter con la lista abierta no envía el formulario | Web (unitario de componente) | Si Enter además envía, la fila de la ficha se guarda con la hora vieja al elegir una franja |
| Un clic fuera o Tab cierran la lista, y ni el reloj ni la lista reciben el foco con Tab | Web (unitario de componente) | Si la lista queda abierta al pasar al campo siguiente, se superponen la de inicio y la de fin. Si Tab para en el reloj o en la lista, llegar al campo de fin cuesta varias pulsaciones |
| La lista se monta en el body y no dentro del campo | Web (unitario de componente) | Si la lista se dibuja dentro del campo, el scroll de `Pagina` y el `overflow-hidden` de la tarjeta la recortan |
| La lista va debajo del campo, con su ancho y a su altura, si entra | Web (unitario de componente) | La lista es `fixed` y está en el body: si no toma la posición y el ancho del campo, aparece en cualquier lugar de la ventana |
| Si no entra debajo del campo pero sí encima, la lista va encima | Web (unitario de componente) | Si siempre abre hacia abajo, en las últimas filas de la semana la lista queda cortada por el borde de la ventana |
| Si no entra ni debajo ni encima, va del lado con más lugar y se achica a lo que hay | Web (unitario de componente) | Si en una ventana baja la lista va igual con su alto completo, se sale de la ventana y las franjas de la punta no se pueden elegir |
| La ubicación cuenta lo que la lista puede llegar a medir según su `max-height`, no el alto de ahora ni uno copiado | Web (unitario de componente) | Si se mide con el alto de ahora, una lista filtrada se ubica en un lado donde después, al borrar el filtro, no entra. Si el alto está copiado en el código, cambiar el `max-h-64` desacomoda la ubicación |
| Si se desplaza el área que contiene al campo o la página, la lista se cierra | Web (unitario de componente) | La lista es `fixed`: si no se cierra, queda flotando lejos de su campo |
| Si se desplaza la lista o algo que no contiene al campo, la lista sigue abierta | Web (unitario de componente) | Si cualquier scroll la cierra, desplazar la lista para buscar una franja la cierra |
| Si cambia el tamaño de la ventana, la lista se cierra | Web (unitario de componente) | Si no se cierra, queda donde se calculó para la ventana anterior, separada del campo |
| Cada reloj se llama con la etiqueta de su campo | Web (unitario de componente) | Si los dos relojes de una fila se llaman igual, un lector de pantalla no distingue el de inicio del de fin y los tests de la ficha no pueden tocar uno |
| El campo se nombra con `etiqueta` y, por `id`, con una `<label>` | Web (unitario de componente) | El nombre accesible lo da `aria-label`: si se pierde, los lectores de pantalla y los tests de la ficha no encuentran la hora por "Empieza". Si el `id` no llega al campo, un clic en la `<label>` no le pasa el foco |
| El listado muestra las clases por semana y los días, y el nombre lleva a la ficha | Web | Si la fila deja de ser un enlace, no hay forma de llegar a la ficha |
| El buscador filtra por apellido y por DNI, sin distinguir mayúsculas ni tildes | Web | Si filtra solo por nombre, no se encuentra a un profesor buscando el apellido. Si no saca las tildes, "NUNEZ" no encuentra a Núñez |
| El buscador encuentra por el nombre solo y por el nombre completo en los dos órdenes: "erik", "erik zapata", "zapata erik", "lucia nunez" | Web | Si compara campo por campo, quien tipea el nombre completo, como en el buscador de alumnos, no encuentra a nadie |
| La ficha muestra las siete filas de la semana con las clases de ese profesor en su día | Web | Si se agrupa con los días que vienen de la API, un día sin clases desaparece y no se le puede agregar una |
| Editar una fila manda `PATCH /api/clases/:id` con las horas y el estilo, y la fila vuelve a lectura | Web | Si manda el día o el profesor cuando no cambiaron, un PATCH puede mudar la clase de día sin querer |
| El "+" de un día agrega una fila en edición y guardarla manda `POST /api/clases` con ese `diaSemana` | Web | Si el día sale de otro lado, la clase nueva cae en el día equivocado |
| "Cancelar" en una fila nueva la descarta y no manda nada | Web | Si la fila queda, el horario muestra una clase que no existe |
| El error de la API aparece debajo de la fila y la fila sigue en edición | Web | Si no se muestra, un rechazo de la API (agregarle una clase a un profesor dado de baja) falla en silencio. Si la fila vuelve a lectura, se pierde lo que se escribió |
| Una hora de fin anterior a la de inicio muestra el error debajo de la fila y no manda nada | Web | Si la fila no valida con `crearClaseSchema` antes de mandar, una clase nueva con la hora de fin anterior llega a la API y la fila solo dice "Datos inválidos", sin decir qué está mal |
| Tocar el tacho manda `PATCH /api/clases/:id` con solo `{ activa: false }` y la clase deja de verse | Web | Si el PATCH lleva otros campos de la fila, dar de baja puede pisar la clase con datos viejos. Si el horario no se recarga, la clase dada de baja sigue en la semana. Verificado con la mutación de mandar también el estilo |
| Con la casilla marcada se piden las dadas de baja (`incluirInactivos=true`), que dicen "Dada de baja", y "Reactivar" manda `PATCH` con solo `{ activa: true }` | Web | Si la casilla no llega a la consulta, una clase dada de baja no se puede ver ni reactivar desde la ficha. Verificado con esa mutación |
| Marcar la casilla con una fila en edición no vacía la semana ni pierde lo escrito | Web | Sin `placeholderData: keepPreviousData` en `useClases`, la clave nueva no tiene datos: la semana pasa a "Cargando…" y la fila en edición vuelve a montarse vacía |
| El "+" del mismo día mientras se guarda conserva la fila, que se cierra al terminar sin mandar la clase dos veces | Web | Si el "+" reemplaza la edición por un objeto nuevo, `terminar` no la reconoce: la fila sigue abierta después de guardar y un segundo "Guardar" crea la clase dos veces |
| Cargar un porcentaje nuevo desde la pestaña Porcentajes manda puntos básicos y la fecha; el historial queda del más nuevo al más viejo, como lo ordena la API | Web (se muda del listado) | Si el historial se pierde al sacar el diálogo de la fila, no hay forma de cambiarle el porcentaje a un profesor |
| Recorrido de punta a punta | E2E (sin cambios) | El e2e crea el profesor desde el diálogo y la clase en `/clases`: las dos cosas siguen igual |

---

### Tarea 1: Filtrar las clases por profesor

**Archivos:**
- Modificar: `packages/shared/src/clases.ts`, `apps/api/src/modules/clases/clases.repository.ts`, `clases.service.ts`, `clases.routes.ts`
- Test: `apps/api/src/modules/clases/clases.test.ts`

- [x] **Paso 1:** escribir el test HTTP de `GET /api/clases?profesorId=N`, con dos profesores y una clase dada de baja.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test clases` y verificar que falla porque el filtro no existe y devuelve las clases de los dos.
- [x] **Paso 3:** agregar `clasesQuerySchema` en shared (`profesorId` opcional con `z.coerce.number().int().positive()` más lo que ya trae `listadoQuerySchema`), pasar el filtro por el service hasta el repository y usarlo en la ruta.
- [x] **Paso 4:** correr `pnpm --filter @studio/api test clases` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(clases): filtrar el horario por profesor`.

### Tarea 2: El listado de profesores con sus clases

**Archivos:**
- Crear: `apps/api/src/modules/profesores/listado.service.ts`
- Modificar: `packages/shared/src/profesores.ts`, `apps/api/src/modules/profesores/profesores.routes.ts`
- Test: `apps/api/src/modules/profesores/profesores.test.ts`

- [x] **Paso 1:** escribir el test del listado con `clasesPorSemana` y `diasConClase`: un profesor con dos clases el lunes y una el miércoles, otro sin clases, y una clase dada de baja que no cuenta. Aserciones con los valores escritos a mano.
- [x] **Paso 2:** correr `pnpm --filter @studio/api test profesores` y verificar que falla porque la respuesta no trae los campos.
- [x] **Paso 3:** agregar el tipo `ProfesorEnListado` en shared, crear `listado.service.ts` que llame a `listarProfesores` y a `listarClases` pidiendo solo las activas, agrupe por `profesor.id` y apunte la ruta a ese service. `listarClases` cambió de firma en la tarea 1: usá la que quedó, no inventes otra.
- [x] **Paso 4:** correr los tests de la API completos (`pnpm --filter @studio/api test`) y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(profesores): el listado trae las clases por semana y los días`.

### Tarea 3: El selector de hora

**Archivos:**
- Crear: `apps/web/src/components/ui/SelectorDeHora.tsx`
- Modificar: `apps/web/src/components/ui/index.tsx` (reexportarlo), `apps/web/src/components/ui/Icono.tsx` (ícono `reloj`, trazo de Tabler)
- Test: `apps/web/src/components/ui/selector-de-hora.test.tsx`

El componente recibe `valor`, `alCambiar`, `etiqueta` (para `aria-label`) y opcionalmente `id`. La lista son franjas de 15 minutos de 08:00 a 23:45, más `valor` si no está en la lista.

- [x] **Paso 1:** escribir los tests: abrir con el reloj y ver las opciones, elegir una y que llame a `alCambiar`, tipear "19" y que queden solo las cuatro franjas de las 19, y que un valor fuera de la grilla aparezca en la lista.
- [x] **Paso 2:** correr `pnpm --filter @studio/web test selector-de-hora` y verificar que falla porque el componente no existe.
- [x] **Paso 3:** implementar el componente con la lista, el filtro, el teclado (flechas, Enter, Escape) y el cierre al hacer clic afuera.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(ui): selector de hora con franjas de 15 minutos`.

### Tarea 4: El listado de profesores en la web

**Archivos:**
- Crear: `apps/web/src/features/profesores/ProfesorForm.tsx`, `PorcentajesDelProfesor.tsx`
- Modificar: `apps/web/src/features/profesores/ProfesoresPage.tsx`, `profesores/api.ts`, `apps/web/test/datos.ts` (`unProfesorEnListado` y `unaClase`)
- Test: `apps/web/src/features/profesores/profesores.test.tsx`

El formulario de alta y el de edición se sacan de `ProfesoresPage` y pasan a `ProfesorForm.tsx` para que los use también la ficha. "Nuevo profesor" sigue en la barra del listado. El historial de porcentajes sale del diálogo de la fila y pasa a `PorcentajesDelProfesor.tsx`, para la pestaña Porcentajes de la ficha.

La ruta `/profesores/:id` la agrega la tarea 5, junto con la página que la atiende. Hasta entonces el enlace del nombre existe pero no lleva a ninguna parte: el test de esta tarea mira el `href`, no la navegación.

El test que ya existe de cargar un porcentaje nuevo usa el botón "Porcentajes" de la fila, que esta tarea saca. Se borra acá y la tarea 5 lo vuelve a escribir sobre la pestaña Porcentajes de la ficha.

- [x] **Paso 1:** escribir los tests del listado: las columnas nuevas con sus valores, el nombre como enlace a `/profesores/:id` y el buscador filtrando por apellido y por DNI. Adaptar el test de "crear un profesor con 52,5" que ya existe y borrar el de los porcentajes.
- [x] **Paso 2:** correr `pnpm --filter @studio/web test profesores` y verificar que fallan porque la tabla todavía tiene las columnas viejas.
- [x] **Paso 3:** rehacer la tabla con avatar, enlace, columnas con ícono y buscador; mover el porcentaje al tipo `ProfesorEnListado`; sacar los botones de la fila. La ruta `/profesores/:id` no se agregó acá: la agrega la tarea 5 con la página, como dice el encabezado de la tarea.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(profesores): listado al estilo del de alumnos`.

### Tarea 5: La ficha del profesor

**Archivos:**
- Crear: `apps/web/src/features/profesores/FichaProfesorPage.tsx`, `HorarioDelProfesor.tsx`, `FilaDeClase.tsx`
- Modificar: `apps/web/src/features/profesores/api.ts`, `apps/web/src/features/clases/api.ts` (`useClases` acepta `profesorId`), `apps/web/src/rutas.tsx`
- Test: `apps/web/src/features/profesores/ficha-profesor.test.tsx`

`ProfesorForm.tsx` lo crea la tarea 4; acá solo se importa para el diálogo de "Editar" de la pestaña Datos. Esta tarea agrega la ruta `/profesores/:id` a `rutas.tsx`, hermana de `/profesores` y dentro de `SoloAdmin`.

- [x] **Paso 1:** escribir los tests de la ficha: las siete filas de la semana con las clases en su día, editar una fila y ver el `PATCH`, el "+" de un día y el `POST` con ese `diaSemana`, "Cancelar" en una fila nueva, el error de la API debajo de la fila, y el de cargar un porcentaje nuevo desde la pestaña Porcentajes que la tarea 4 sacó del listado.
- [x] **Paso 2:** correr `pnpm --filter @studio/web test ficha-profesor` y verificar que fallan porque la página no existe.
- [x] **Paso 3:** implementar la página con sus tres pestañas, el horario por día y la fila que se edita en su lugar. Se sumó un test que el plan no tenía: la validación con `crearClaseSchema` antes de mandar. La fila del plan sobre el error de la API daba como motivo una hora de fin anterior, pero ese caso no llega a la API porque la fila lo frena antes; ahora son dos filas en la tabla de tests.
- [x] **Paso 4:** correr `pnpm test` y `pnpm typecheck` completos, y verificar que pasan.
- [x] **Paso 5:** commit `feat(profesores): ficha con las clases de la semana`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [x] `pnpm e2e` pasa sin cambios en el recorrido.
- [x] A mano contra la API real: crear un profesor, abrir su ficha, agregarle una clase con el "+" del miércoles, editarle la hora con el selector, darla de baja y verificar que el listado muestra "Clases por semana" y "Días" al día.
