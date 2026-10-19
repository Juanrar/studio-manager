# Agenda en lista

**Estado:** en curso  
**Depende de:** clases-por-adelantado  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; en `/agenda`, las clases del día se ven en una lista por hora con estilo y profesor, sin tabla, y en el día de hoy una línea "Ahora" separa las que terminaron de las que faltan.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa. Con subagentes, usá `superpowers:subagent-driven-development`; en la misma sesión, `superpowers:executing-plans`.

## Qué cambia

La [agenda](frontend-agenda.md) mostraba las clases del día en una tabla con horario, clase, nivel, profesor, asistentes, estado y un botón. El estudio pidió algo más simple: ver solo el horario, el estilo y quién da la clase. Eligió el diseño entre maquetas en el navegador (servidor de brainstorming, archivo `.superpowers/brainstorm/944-1792419833/content/agenda-linea-de-ahora-v3.html`, fuera de git): la lista de la propuesta A con la línea de "ahora" de la propuesta D, sin cuentas de tiempo.

**La lista.** Reemplaza a la tabla. Es un `<ol aria-label="Clases del día">`. Cada renglón es un grupo de clases con la misma hora de inicio y de fin:

- A la izquierda, en una columna de `w-14`: la hora de inicio (`text-[15px] font-semibold tabular-nums`) y debajo "a 19:00" (`text-xs text-apagado`).
- A la derecha, cada clase del grupo es un `Link` a `/clases/:id`: una barra de 3 px con `colorDeNombre(clase.estilo)`, el estilo (`text-[15px] font-semibold`) y debajo el profesor con `Avatar` y nombre y apellido (`text-tenue`). Al final, `Icono` `siguiente` en `text-apagado`, con `aria-hidden`.
- Los renglones se separan con `border-b border-borde`, sin borde en el último.
- Salen de la pantalla el nivel, los asistentes, el estado "Programada" y el botón "Tomar asistencia" / "Ver asistencia". Tocar la clase hace lo que hacía el botón.

**Marcas.** Van con `Insignia`, después del nombre del profesor:

- `suplente` (tono `ambar`) cuando `profesorTitular !== null` y su `id` es distinto del de `profesor`, la misma regla que hoy.
- `cancelada` (tono `rojo`). El estilo y el profesor van tachados (`line-through text-apagado`) y la barra es `bg-borde-fuerte` en lugar del color del estilo.

**El ahora, solo si el día que se ve es hoy.** Hoy es `hoyEnEstudio(ahora)` y se compara con `agenda.data.desde`, así que vale igual con `?fecha=` que sin fecha. Con la hora del estudio como `HH:MM`:

- Una clase **terminó** si `horaFin <= hora`. Se ve con `opacity-40` y se puede abrir.
- Una clase **está en curso** si `horaInicio <= hora < horaFin` y no está cancelada. Lleva la marca `en curso` (tono `verde`), a la derecha antes del ícono, y su renglón tiene fondo `bg-elevado`, `rounded-lg` y sin borde de abajo.
- **La línea** es un renglón más de la lista: `Insignia` verde "Ahora" y una raya de 2 px `bg-green-500` que ocupa el resto, con `aria-hidden`. Va antes del primer grupo con alguna clase que no terminó. Si terminaron todas, va al final.
- Todo se recalcula solo cada minuto con `useAhora()`, sin recargar.
- Cuando llegan las clases de hoy, la lista baja hasta la línea con `scrollIntoView({ block: 'center' })`. Pasa una vez por día abierto: el cambio de minuto no vuelve a mover la pantalla. jsdom no tiene `scrollIntoView`, así que se llama con `?.`, como en `AsistentePage`.

Otro día que no es hoy se ve sin línea, sin apagado y sin "en curso". La barra de `Pagina` ("‹ Hoy ›" y la fecha), el aviso de fuera del horizonte y "No hay clases este día." no cambian.

**La grilla también pasa a verde.** El estudio pidió que la línea de la hora actual de la [grilla](grilla-semanal.md) tenga el mismo color que la de la agenda: en `LineaDeAhora` y `EtiquetaDeAhora` de `VistaDeSemana.tsx`, `bg-red-500` pasa a `bg-green-500`.

**Decisiones tomadas sin el estudio:**

- Dos clases que empiezan a la misma hora y terminan a otra van en renglones separados, cada uno con su "a ...". Juntas, el grupo no tendría una sola hora de fin.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Junta las clases con el mismo inicio y fin, y separa las que terminan a otra hora | Unitario (`grupos.test.ts`) | Agrupar solo por inicio, o confiar en el orden de la API, que ordena por inicio e `id` |
| Otro día muestra cada grupo con su hora, estilo, profesor y marcas, sin nivel, asistentes, estado ni línea | Web | Volver a mostrar columnas de la tabla, o calcular el ahora sin mirar si el día es hoy |
| Tocar una clase lleva a su asistencia | Web | Que la clase deje de ser un enlace a `/clases/:id` |
| Hoy a las 19:20, "Ahora" va entre el grupo de las 18:00 y Hip-Hop, que dice "en curso" | Web | Poner la línea por hora de inicio en lugar de fin, o no marcar la clase en curso |
| A las 10:00 la línea va primera; a las 21:30 la cancelada en horario no dice "en curso"; a las 22:00 va al final | Web | Marcar en curso una cancelada, o dejar sin terminar la clase que termina justo ahora |
| A las 20:29 Hip-Hop está en curso y un minuto después la línea pasa después de ella sin recargar; la lista baja a la línea una sola vez | Web | Calcular la hora una sola vez al montar, o volver a desplazar en cada minuto |

---

### Tarea 1: La lista agrupada por hora reemplaza a la tabla

**Archivos:**
- Crear: `apps/web/src/features/agenda/grupos.ts`
- Modificar: `apps/web/src/features/agenda/AgendaPage.tsx`
- Test: `apps/web/src/features/agenda/grupos.test.ts`, `apps/web/src/features/agenda/agenda.test.tsx`

**Interfaces:**
- Produce: `type GrupoDeClases = { horaInicio: string; horaFin: string; clases: Clase[] }` y `agruparPorHora(clases: Clase[]): GrupoDeClases[]`, en `grupos.ts`.

- [x] **Paso 1:** escribir `grupos.test.ts` con `unaClase` de `test/datos.ts`. Entran D 17:00–18:00 (id 4), A 18:00–19:30 (id 1), B 18:00–19:00 (id 2) y C 18:00–19:00 (id 3), en el orden 1, 2, 3, 4. Se espera:

  ```ts
  expect(agruparPorHora(clases).map((g) => [g.horaInicio, g.horaFin, g.clases.map((c) => c.id)])).toEqual([
    ['17:00', '18:00', [4]],
    ['18:00', '19:00', [2, 3]],
    ['18:00', '19:30', [1]],
  ]);
  ```

- [x] **Paso 2:** en `agenda.test.tsx`, sumar a `CLASES_DEL_10`, después de Ballet, `unaClase({ id: 52, horarioId: 4, estilo: 'Jazz', nivel: null, horaInicio: '18:00', horaFin: '19:00', profesor: IARU, profesorTitular: IARU })`. Sumar el reloj a todo el archivo: en `beforeEach`, `vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })` y `vi.setSystemTime(new Date('2026-03-11T15:00:00Z'))` (el día 11, así el 10 no es hoy); en `afterEach`, `vi.useRealTimers()`. Agregar el ayudante que lee la lista:

  ```ts
  // El texto de cada renglón de la agenda, sin lo decorativo (aria-hidden). La línea se lee "Ahora".
  function renglones(): string[] {
    const lista = screen.getByRole('list', { name: 'Clases del día' });
    return [...lista.children].map((renglon) => {
      const copia = renglon.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[aria-hidden="true"]').forEach((nodo) => nodo.remove());
      const textos: string[] = [];
      const recorrido = document.createTreeWalker(copia, NodeFilter.SHOW_TEXT);
      while (recorrido.nextNode()) textos.push(recorrido.currentNode.textContent!.trim());
      return textos.filter(Boolean).join(' ');
    });
  }
  ```

- [x] **Paso 3:** reemplazar el test de las filas por "otro día muestra cada grupo con su hora, estilo, profesor y marcas" en `/agenda?fecha=2026-03-10`:

  ```ts
  expect(renglones()).toEqual([
    '18:00 a 19:00 Ballet Erik Zapata Jazz Iaru Speroni',
    '19:00 a 20:30 Hip-Hop Iaru Speroni suplente',
    '21:00 a 22:00 Salsa Erik Zapata cancelada',
  ]);
  ```

  Conserva la aserción de `pedidos`. Cambiar el test de "Tomar asistencia" por "tocar una clase lleva a su asistencia": clic en `getByRole('link', { name: /Ballet/ })` y la ruta termina en `/clases/49`.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test agenda` y verificar que fallan: `agruparPorHora` no existe y no hay lista "Clases del día".
- [x] **Paso 5:** escribir `agruparPorHora` (ordena por inicio y después por fin, y junta los iguales) y armar la lista en `AgendaPage` como dice "Qué cambia", sin el ahora. Sacar `ESTADOS`, `Tabla`, `Celda` y `CeldaDeAcciones` de la página.
- [x] **Paso 6:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 7:** commit `feat(agenda): lista de clases agrupadas por hora en lugar de la tabla`.

### Tarea 2: La línea "Ahora" y las clases en curso en el día de hoy

**Archivos:**
- Crear: `apps/web/src/lib/useAhora.ts`
- Modificar: `apps/web/src/lib/formato.ts`, `apps/web/src/features/agenda/AgendaPage.tsx`, `apps/web/src/features/grilla/VistaDeSemana.tsx`
- Test: `apps/web/src/features/agenda/agenda.test.tsx`

**Interfaces:**
- Consume: `agruparPorHora` y `GrupoDeClases` de la tarea 1.
- Produce: `horaEnEstudio(ahora: Date = new Date()): string` en `lib/formato.ts`, que da `HH:MM` en `America/Argentina/Buenos_Aires` con reloj de 24 horas; y `useAhora(): Date` en `lib/useAhora.ts`, que se renueva con `setInterval` cada 60 000 ms y lo limpia al desmontar.

- [x] **Paso 1:** en `agenda.test.tsx`, test "hoy, la línea va antes de la primera clase que no terminó" con `vi.setSystemTime(new Date('2026-03-10T22:20:00Z'))` (19:20 en el estudio):

  ```ts
  expect(renglones()).toEqual([
    '18:00 a 19:00 Ballet Erik Zapata Jazz Iaru Speroni',
    'Ahora',
    '19:00 a 20:30 Hip-Hop Iaru Speroni suplente en curso',
    '21:00 a 22:00 Salsa Erik Zapata cancelada',
  ]);
  ```

- [x] **Paso 2:** test con `it.each` sobre el mismo día. Los grupos, abreviados acá como G1 (18:00), G2 (19:00, sin "en curso") y G3 (21:00), se escriben completos como en el paso 1:
  - `2026-03-10T13:00:00Z` (10:00): `['Ahora', G1, G2, G3]`
  - `2026-03-11T00:30:00Z` (21:30, la cancelada en horario): `[G1, G2, 'Ahora', G3]`
  - `2026-03-11T01:00:00Z` (22:00, terminó la última): `[G1, G2, G3, 'Ahora']`
- [x] **Paso 3:** test "la línea avanza sola y la lista baja a ella una vez". Antes de renderizar, `Element.prototype.scrollIntoView = desplazar` con `const desplazar = vi.fn()`, y se borra al terminar. Con `2026-03-10T23:29:00Z` (20:29): `[G1, 'Ahora', '19:00 a 20:30 Hip-Hop Iaru Speroni suplente en curso', G3]`, `desplazar` llamado una vez con `{ block: 'center' }` y `desplazar.mock.contexts[0]` con el texto "Ahora". Después de `act(() => vi.advanceTimersByTime(60_000))`: `[G1, G2, 'Ahora', G3]` y `desplazar` sigue con una sola llamada.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test agenda` y verificar que los tres fallan porque no hay renglón "Ahora".
- [x] **Paso 5:** escribir `horaEnEstudio` y `useAhora`, y sumar a `AgendaPage` el ahora como dice "Qué cambia". En `VistaDeSemana.tsx`, borrar `minutosDeAhora`, usar `aMinutos(horaEnEstudio())` en sus usos y pasar la línea y la etiqueta de la hora actual de `bg-red-500` a `bg-green-500`.
- [x] **Paso 6:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan, también los de la grilla.
- [x] **Paso 7:** commit `feat(agenda): línea de "Ahora" y clases en curso en el día de hoy`.

### Tarea 3: Mirarla en Chromium y cerrar

- [ ] **Paso 1:** con `pnpm dev:web` y un script de Playwright fuera del repo que simula la API con `page.route('**/api/**', ...)` (ver CLAUDE.md), capturar `/agenda` a 1280 y a 1024 px con clases de hoy antes, durante y después de la hora actual, y otro día. Verificar contra la maqueta: hora a la izquierda, barra de color, terminadas apagadas, renglón en curso resaltado, línea verde, y que la pantalla bajó a la línea.
- [ ] **Paso 2:** correr la verificación final.
- [ ] **Paso 3:** pasar la feature a `lista` en el índice y escribir la bitácora.

## Review Focus

- Dos clases que empiezan juntas y terminan a distinta hora: dos renglones, cada uno con su fin. Lo cubre el test de `grupos.test.ts`.
- Una clase cancelada en el horario actual no dice "en curso" y no deja la línea antes de tiempo. Lo cubre el caso de las 21:30.
- Una clase que termina justo a la hora actual cuenta como terminada. Lo cubren el caso de las 22:00 y el cambio de minuto a las 20:30.
- Hoy con `?fecha=` en la dirección se ve igual que sin fecha. Los tests de hoy usan `?fecha=2026-03-10`.
- La pantalla abierta al pasar la medianoche: el día que se ve deja de ser hoy y la lista queda sin línea hasta tocar "Hoy". Se acepta sin test.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
