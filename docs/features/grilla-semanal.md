# Grilla semanal

**Estado:** pendiente
**Depende de:** clases-por-adelantado (25)
**Listo cuando:** `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan; un administrador abre "Grilla", ve las clases de la semana, del día o del mes, arrastra una clase a otro día u horario de la misma semana, la estira o crea una nueva, y el cambio vale solo para esa semana salvo que elija "Aplicar a todas las semanas".

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando corriste el comando y lo viste pasar.

## Cómo trabaja el estudio

Arman la grilla por semana: cada semana puede tener clases y profesores distintos. Hay feriados, suplentes, clases que se corren de día y clases únicas, como un workshop o una clase de recuperación, que se pagan con el pack igual que cualquier otra. Arman, como mucho, hasta el mes siguiente.

## Diseño elegido

Se eligió con quien administra el estudio entre varios prototipos en la app real. Los prototipos quedaron sin versionar, en la rama local `prototipo/grilla`. El elegido sigue el aspecto de DayFlow (dayflow-js/calendar) en oscuro:

- **Barra:** el mes en grande a la izquierda ("Octubre 2026"), "Día / Semana / Mes" al centro y "‹ Hoy ›" con borde a la derecha. Sin la barra secundaria de `Pagina`.
- **Encabezado de días:** "Lun 5" en una línea, en gris; el día de hoy en blanco y negrita. Sin fila de "todo el día".
- **Grilla:** de 08:00 a 23:00, 63 px por hora, líneas finas de hora y de columna. Las horas a la izquierda ("10:00").
- **Clase:** fondo suave del color de su estilo, una barra de 3 px de ese color a la izquierda, y el estilo y el horario escritos en ese color, más claro. Si entra, el profesor debajo. En la vista Día, además, el nivel y el profesor en la misma línea del horario.
- **Superposición:** si dos clases empiezan con menos de 30 minutos de diferencia van lado a lado; si una empieza 30 minutos o más después, se dibuja encima con una sangría de 10 px, como en Google Calendar.
- **Ahora:** una línea roja en el día de hoy y la hora en una etiqueta roja sobre el eje.
- **Cambio de una sola semana:** un punto ámbar arriba a la derecha de la clase.
- **Vista Mes:** cada día lista hasta 4 clases con un punto de color, la hora y el estilo, y "N más". El día de hoy en un círculo rojo. Un clic en un día abre ese día en la vista Día.

**El color sale del nombre del estilo**, con la paleta de `Avatar`: el estilo es texto libre y no tiene un color guardado. Dos horarios de "Salsa" se ven del mismo color. Es un color de dato, como el del avatar, no un color de estado.

## Cómo se edita

- **Arrastrar una clase** la mueve a otro horario o a otro día de la misma semana, en saltos de 15 minutos.
- **Arrastrar el borde de abajo** cambia cuánto dura, con un mínimo de 15 minutos.
- **Arrastrar sobre un hueco** abre el editor de una clase nueva con ese horario; un clic sin arrastrar propone una hora.
- **Un clic en una clase** abre un editor chico junto a la clase: estilo, nivel, profesor, día, empieza y termina, con "Quitar" y "Guardar".
- **Después de cada cambio** aparece un aviso abajo: "Salsa pasa al viernes 21:00, solo esta semana." con "Aplicar a todas las semanas" y "Deshacer". Se va solo a los 8 segundos.
- **Una clase cancelada** se ve apagada y tachada. Un clic ofrece "Volver a dictarla".
- **Los días que ya pasaron** se ven igual pero no se editan: ni arrastrar ni abrir el editor. Las correcciones, como un suplente que no se cargó, se siguen haciendo desde la clase.
- **La flecha ›** se detiene en la última semana del horizonte (feature 25). Más adelante no hay clases creadas.

## API

### Cambios de una sola clase

- **`PATCH /api/clases/:id`** suma `fecha`, `horaInicio`, `horaFin`, `estilo` y `nivel` a lo que ya aceptaba (`profesorId` y `estado`). "Deshacer" es otro `PATCH` con los valores anteriores. "Volver a dictarla" es `estado: 'programada'`.
- **`POST /api/clases`** crea una clase única: `fecha`, `horaInicio`, `horaFin`, `estilo`, `nivel` y `profesorId`. La `semana` sale de la fecha y `horario_id` queda nulo.
- **`DELETE /api/clases/:id`** borra una clase única futura sin asistencias. Una clase de un horario no se borra: se cancela.

Reglas, todas con 422 y el motivo:

- La clase y su fecha nueva tienen que ser de hoy en adelante.
- La fecha nueva tiene que estar en la misma semana (el check de la base ya lo impide; el service da el mensaje).
- Si un alumno anotado tiene un pack que vence antes de la fecha nueva, no se mueve.
- Cancelar con asistencias sigue fallando, como ahora.
- El profesor tiene que estar activo.

Recepción puede seguir poniendo un suplente o cancelar (`profesorId` y `estado`). Mover, cambiar la hora, el estilo o el nivel, crear y borrar son solo para administradores: 403.

### Cambios que valen para todas las semanas

- **`PATCH /api/horarios/:id`** suma `desde` (un lunes). Cambia el horario y sus clases desde esa semana que todavía son iguales al horario viejo. La clase de la semana `desde` recibe el cambio aunque tenga cambios propios: es la que se acaba de editar. Sin `desde`, vale la semana actual, como en la feature 25.
- **Quitar de todas:** `PATCH /api/horarios/:id` con `activo: false` y `desde`. Borra sus clases sin asistencias desde esa semana; las anteriores quedan.
- **`POST /api/horarios`** suma `desde` y un `claseId` opcional. Crea el horario con `vigente_desde = desde`. Si viene `claseId`, esa clase única pasa a tener el `horario_id` nuevo y es la primera de la serie. Después genera las semanas siguientes.

Si alguna clase de la serie no puede cambiar (un anotado con un pack que vence antes), falla todo y nada cambia.

## Arquitectura de la web

- **`features/grilla/`** con la página, sus vistas y su `api.ts`. Ruta `/grilla`, solo administradores, menú "Grilla" en Administración debajo de "Horarios".
- **Funciones puras con su test**, separadas de React:
  - `destinoDelArrastre(caja, puntero, origen, modo)`: día y minutos de destino, saltos de 15, límites de 08:00 a 23:00, largo mínimo de 15 minutos.
  - `acomodarEnCascada(clases)`: carril, cantidad de carriles y sangría de cada clase, por día.
- **`useArrastre`** con eventos de puntero, sin librerías: arrastra con el mouse y con el dedo. El hueco solo crea con mouse, para no impedir el desplazamiento en una pantalla táctil.
- **El editor flotante** es un componente de `components/ui` que se ubica junto a un rectángulo y se corre al otro lado si no entra.
- **Los colores** de la clase usan `color-mix` con el color del estilo y `--color-panel`, para que una clase encima de otra sea opaca.
- La página usa `Pagina` con el mes como título y las acciones a la derecha; el selector de vista va centrado sobre la tarjeta.

## Qué no se implementa

- **Sacar la pantalla Horarios.** Sigue como vista de lista del horario completo; se decide después de usar la grilla.
- **Arrastrar a otra semana.** Una clase se mueve dentro de su semana.
- **Clases únicas con otro precio** (un workshop de $15.000): sería una feature de precios. La clase única se paga con el pack.
- **Fila de "todo el día" y feriados.** Se sacó del diseño. Un feriado es una semana con sus clases canceladas.
- **Salas.** El estudio no las cargó; las clases que se superponen van lado a lado.
- **Safari y Firefox.** Se prueba en Chromium, como el resto de la app.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Mover una clase al viernes 21:00 cambia solo esa clase y responde `tieneCambios: true`; la de la semana siguiente queda igual | Integración HTTP | Que el `PATCH` de la clase toque el horario |
| Moverla a otra semana o a una fecha pasada da 422 | Integración HTTP | Sacar la validación de la semana o la de hoy en adelante |
| Moverla con un anotado cuyo pack vence antes de la fecha nueva da 422 y no cambia nada | Integración HTTP | Que falte esa validación |
| Volverla a mano a su lugar responde `tieneCambios: false` | Integración HTTP | Guardar la marca en lugar de calcularla |
| Recepción puede poner un suplente y cancelar, pero mover o crear da 403 | Integración HTTP | Los permisos por rol |
| Una clase única recibe asistencias y suma en la liquidación del profesor | Integración HTTP | Que la liquidación haga join con `horario` y pierda las clases únicas |
| El generador no crea una clase única en otras semanas | Service con base real | Que el generador lea clases en lugar de horarios |
| Borrar una única sin asistencias funciona; con asistencias, o siendo de un horario, da 422 | Integración HTTP | Borrar clases con historial o de un horario |
| "Aplicar a todas desde el 19/10" cambia las clases del 19 en adelante, deja igual la del 12 y la que tiene suplente, y la del 19 pierde sus cambios propios | Integración HTTP | Que el `update` no respete `desde`, los cambios propios o la clase recién editada |
| Si una clase de la serie no puede moverse, falla todo y nada cambia | Integración HTTP | Que falte la transacción |
| "Quitar de todas desde el 19/10" borra del 19 en adelante y deja la del 12 | Integración HTTP | Que la baja ignore `desde` |
| "Agregar a todas" con `claseId` deja la única como primera de la serie y genera las semanas siguientes, no las anteriores | Integración HTTP | Que no tome el `claseId` o que use la semana actual en lugar de `desde` |
| `destinoDelArrastre`: salta de a 15 minutos, no pasa de 08:00 ni de 23:00, cambia de día y no deja una clase de menos de 15 minutos | Unitario | Cambios en la cuenta del arrastre |
| `acomodarEnCascada`: lado a lado si empiezan juntas, sangría si empiezan 30 minutos después, y dos días distintos no se mezclan | Unitario | Ordenar sin el día: el prototipo tuvo ese error y dos clases de días distintos compartían carril |
| La semana muestra cada clase en su día con su estilo y su horario | Web | Ubicar las clases por índice en lugar de por fecha |
| La flecha › se deshabilita en la última semana del horizonte | Web | Navegar a semanas sin clases creadas |
| Un clic en una clase de un día pasado no abre el editor | Web | Editar lo que ya pasó |
| Guardar en el editor manda el `PATCH` y muestra el aviso; "Aplicar a todas" manda `PATCH /api/horarios/:id` con `desde`; "Deshacer" manda los valores anteriores | Web | Cambios en el flujo del aviso |
| Una clase cancelada se ve tachada y "Volver a dictarla" manda `estado: 'programada'` | Web | Que la cancelada desaparezca y no se pueda recuperar |
| La vista Mes muestra hasta 4 clases y "N más", y un clic en el día abre la vista Día | Web | Cambios en la vista Mes |
| e2e: el administrador arrastra una clase de hoy a una hora más tarde del mismo día, elige "Aplicar a todas las semanas" y recepción la ve en la agenda con la hora nueva | e2e | El arrastre real en Chromium, que jsdom no calcula |

jsdom no calcula posiciones: la cascada, la línea de ahora y el editor flotante se miran en Chromium con un script de capturas fuera del repo, como dice CLAUDE.md.

## Tareas

### Tarea 1: Mover y editar una clase sola

**Archivos:** `packages/shared/src/clases.ts`, `clases.service.ts`, `clases.routes.ts`, sus tests

- [ ] **Paso 1:** escribir los tests de mover, de las reglas y de los permisos.
- [ ] **Paso 2:** correr `pnpm --filter @studio/api test clases` y verificar que fallan.
- [ ] **Paso 3:** ampliar `actualizarClaseSchema` y `actualizarClase` con las reglas.
- [ ] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(clases): mover una clase dentro de su semana`.

### Tarea 2: La clase única

**Archivos:** `clases.service.ts`, `clases.routes.ts`, `clases.repository.ts`, liquidaciones, sus tests

- [ ] **Paso 1:** escribir los tests de crear, borrar, tomar asistencia y liquidar una clase única, y el del generador.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** implementar `POST` y `DELETE`, y revisar las consultas que todavía hagan join con `horario` sin `left join`.
- [ ] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(clases): clases únicas que no salen de un horario`.

### Tarea 3: Aplicar a todas desde una semana

**Archivos:** `packages/shared/src/horarios.ts`, `programacion.service.ts`, `horarios.routes.ts`, sus tests

- [ ] **Paso 1:** escribir los tests de aplicar, quitar y agregar desde una semana.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** sumar `desde` y `claseId`.
- [ ] **Paso 4:** correr `pnpm --filter @studio/api test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(horarios): aplicar un cambio desde una semana`.

### Tarea 4: Las cuentas del arrastre y la cascada

**Archivos:** `apps/web/src/features/grilla/arrastre.ts`, `cascada.ts`, sus tests

- [ ] **Paso 1:** escribir los tests de `destinoDelArrastre` y `acomodarEnCascada`.
- [ ] **Paso 2:** correr `pnpm --filter @studio/web test grilla` y verificar que fallan.
- [ ] **Paso 3:** implementarlas.
- [ ] **Paso 4:** correr el test y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(grilla): cuentas del arrastre y de las clases superpuestas`.

### Tarea 5: La semana en lectura

**Archivos:** `features/grilla/GrillaPage.tsx`, `api.ts`, `rutas.tsx`, `Layout.tsx`, `Icono.tsx` (ícono de grilla de Tabler), `test/datos.ts`, su test

- [ ] **Paso 1:** escribir los tests de la semana, la navegación y el tope del horizonte.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** implementar la página, la ruta y el menú.
- [ ] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(grilla): la semana de clases en la grilla`.

### Tarea 6: Arrastrar, editar y el aviso

**Archivos:** `features/grilla/`, `components/ui/Flotante.tsx`, sus tests

- [ ] **Paso 1:** escribir los tests del editor, el aviso, los días pasados y las canceladas.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** implementar `useArrastre`, el editor flotante, el aviso y "Volver a dictarla".
- [ ] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan. Mirar la cascada y el editor en Chromium con el script de capturas.
- [ ] **Paso 5:** commit `feat(grilla): mover, estirar y crear clases arrastrando`.

### Tarea 7: Las vistas Día y Mes

**Archivos:** `features/grilla/`, sus tests

- [ ] **Paso 1:** escribir los tests de la vista Mes y del paso a la vista Día.
- [ ] **Paso 2:** correr los tests y verificar que fallan.
- [ ] **Paso 3:** implementar las dos vistas.
- [ ] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `feat(grilla): vistas de día y de mes`.

### Tarea 8: El recorrido de punta a punta

**Archivos:** `e2e/`

- [ ] **Paso 1:** sumar el tramo de la grilla al recorrido.
- [ ] **Paso 2:** correr `pnpm e2e` y verificar que falla en el tramo nuevo si la grilla no guarda el cambio.
- [ ] **Paso 3:** ajustar lo que haga falta.
- [ ] **Paso 4:** correr `pnpm e2e`, `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [ ] **Paso 5:** commit `test(e2e): mover una clase en la grilla y verla en la agenda`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio.
- [ ] `pnpm e2e` pasa.
- [ ] A mano contra la API real: mover una clase solo esta semana, aplicar otra a todas, crear un workshop y tomarle asistencia, cancelar una y volver a dictarla, y ver todo en la agenda de recepción.
