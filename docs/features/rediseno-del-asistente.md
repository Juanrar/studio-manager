# Rediseño de la pantalla del asistente

**Estado:** pendiente  
**Depende de:** alta-de-profesor-desde-el-asistente  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; en `/asistente`, la pantalla vacía muestra el saludo centrado con resplandor, la caja con borde en degradé y las sugerencias en píldoras, y el resplandor se desvanece con el primer mensaje.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa. Con subagentes, usá `superpowers:subagent-driven-development`; en la misma sesión, `superpowers:executing-plans`.

## Qué cambia

El estudio pidió que la pantalla del [asistente](asistente.md) "no sea tan plana" y mandó una imagen de referencia: un saludo, una pregunta grande, una caja de texto con sombra y sugerencias en píldoras. Eligió el diseño entre cuatro prototipos en la app real. Quedó la variante C, con un cambio: el resplandor se apaga al mandar el primer mensaje. Los prototipos están en la rama `prototipo/asistente` (commit `3634f7e`, archivo `apps/web/src/features/asistente/prototipo-asistente.tsx`), fuera de main. Las clases, los degradés y los trazos de los íconos se copian de la variante C de ese archivo.

**Pantalla vacía** (sin mensajes y sin pedido en curso):

- Todo centrado, en una columna de `max-w-2xl`. Arriba, un cuadrado de 44 px con degradé azul y el ícono `destellos`. Debajo, "Hola, Ana" (el primer nombre del usuario) en gris y "¿Por dónde empezamos?" como `h2` de 32 px, con degradé de `--color-texto` a azul claro.
- Detrás del título, un resplandor azul: un óvalo de 640 × 320 px con degradé radial y `blur-3xl`.
- La caja grande, con un brillo azul alrededor que se intensifica con el foco.
- Debajo, las sugerencias en píldoras centradas, que pasan de renglón. Tocar una reemplaza lo escrito por su frase y deja el foco en el campo. No envía.

**Con conversación:**

- Los mensajes del usuario van en burbuja a la derecha (`bg-resalte`, `rounded-2xl rounded-br-md`, 80% de ancho como máximo). Los del asistente van sin burbuja, con un avatar redondo de 28 px con degradé y `destellos`. Sus tarjetas de propuesta van debajo del texto, alineadas con él. El texto de los mensajes es de 14 px.
- Mientras espera se ven el avatar y tres puntos que rebotan con 150 ms de diferencia. "Pensando..." queda solo para el lector de pantalla (`sr-only`).
- La caja se achica y queda fija abajo (`sticky bottom-0`), con el mismo borde y sin brillo. El error va arriba de la caja.
- "Nueva conversación" sigue en la barra de `Pagina`, como hoy.

**La caja:** borde de 1 px en degradé (un fondo pintado detrás, con `p-px`) y fondo `bg-elevado`. El `textarea` crece con lo escrito (`field-sizing-content`): arranca en 84 px la grande y 36 px la chica, y a partir de 192 px hace scroll. El placeholder es "Preguntá por clases, profesores u horarios..." en la grande y "Escribí un mensaje..." en la chica. Abajo a la izquierda hay una etiqueta con el ícono `escudo`: "Lo procesa Google. No escribas datos de alumnos." Abajo a la derecha va el botón de enviar, de 32 px, azul, con `flechaArriba`, y `aria-label` y `title` "Enviar". Con el campo vacío o mientras espera queda deshabilitado, con opacidad 35%. Enter envía y Shift+Enter agrega un renglón, como hoy.

**El resplandor se apaga** cuando empieza la conversación: el de fondo baja a opacidad 0 en 700 ms y el brillo de la caja se va en el mismo tiempo. "Nueva conversación" lo vuelve a encender. Para que se desvanezca, el resplandor queda siempre montado, fuera del contenido que cambia, y solo cambia su opacidad. La pantalla está vacía cuando `mensajes.length === 0 && !esperando`. Si el primer mensaje falla, la conversación lo saca y la pantalla vuelve a estar vacía, con el error debajo de la caja.

**Sugerencias**, en este orden:

| Título | Ícono | Frase | Para |
|---|---|---|---|
| Clases del jueves | `calendario` | ¿Qué clases hay el jueves? | todos |
| Crear un workshop | `calendarioMas` | Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik | admin |
| Alta de profesor | `personaMas` | Dá de alta a Sofía Ruiz con 40%, martes y jueves de 18 a 19 Contemporáneo | admin |
| Horario nuevo | `reloj` | Agregá Salsa los martes de 20 a 21 con Laura, todas las semanas | admin |
| Clases de un profesor | `profesores` | ¿Qué clases da Erik esta semana? | todos |

La API, `ConversacionDelAsistente.tsx` y las tarjetas de propuesta y de alta de profesor no cambian.

## Restricciones

- Los colores salen de las variables de `index.css`. El azul claro es `color-mix(in oklab, var(--color-acento) 45%, white)`. Sin violeta y sin la paleta de Tailwind.
- Los íconos nuevos se copian de Tabler en `components/ui/Icono.tsx`: `destellos` (sparkles), `flechaArriba` (arrow-up) y `escudo` (shield-lock). Los trazos están en el `Icono.tsx` del prototipo.
- La pantalla sigue usando `Pagina` con el título "Asistente".
- Con `prefers-reduced-motion`, el resplandor cambia sin transición y los puntos no rebotan (`motion-reduce:transition-none`, `motion-reduce:animate-none`). Lo decidió quien escribió el plan.
- Del prototipo se trae solo la variante C: nada de `?variante`, `?ejemplo` ni la barra para elegir.

## Archivos

Todos en `apps/web/src/features/asistente/`:

- `AsistentePage.tsx`: arma la pantalla vacía o la conversación y monta el resplandor (función `Resplandor`, en el mismo archivo).
- `CajaDeMensaje.tsx` (nuevo): la caja.
- `Bienvenida.tsx` (nuevo): `Saludo`, `Sugerencias` y la lista `SUGERENCIAS`.
- `ListaDeMensajes.tsx` (nuevo): los mensajes, el avatar y los puntos de espera.

## Tests

Todos en `apps/web/src/features/asistente/asistente.test.tsx`.

| Test | Tarea | Qué cambio lo rompe |
|---|---|---|
| La pantalla vacía saluda a recepción por el nombre y ofrece las dos sugerencias de consulta | 1 (reemplaza "recepción ve el menú Asistente y un solo ejemplo") | Mostrar el nombre completo, mostrar a recepción sugerencias de crear o cambiar el orden |
| El administrador ve las cinco sugerencias | 1 (reemplaza "el administrador ve el ejemplo de crear un workshop") | Esconderle al admin las sugerencias de crear |
| Tocar una sugerencia reemplaza lo escrito, deja el foco en el campo y no envía | 1 | Agregar la frase a lo escrito, no enfocar el campo o mandar el mensaje al tocar |
| Enviar está deshabilitado con el campo vacío o con solo espacios | 1 | Sacar el control de vacío del botón nuevo |
| Avisa que lo escrito lo procesa Google | 1 (reemplaza "avisa debajo del campo...") | Sacar el aviso de la caja |
| Enviar un mensaje lo muestra con la respuesta... | 1 (se le suma que el saludo y las sugerencias desaparecen) | Dejar la bienvenida arriba de la conversación |
| Si la API falla muestra el error... | 1 (se le suma que vuelve el saludo) | Calcular la pantalla vacía sin mirar los mensajes |
| Nueva conversación vacía la lista... y Cerrar sesión borra la conversación | 1 (buscan el título "¿Por dónde empezamos?" en lugar de la frase de ejemplo) | Que la pantalla vacía no vuelva |
| El resplandor se apaga con el primer mensaje y vuelve con Nueva conversación | 2 | Atar el resplandor a otra cosa que la conversación, o desmontarlo en lugar de bajar su opacidad |

Los tests de "Pensando..." y de "Enviar" deshabilitado mientras espera siguen sin cambios: el texto queda en `sr-only` y el botón conserva el nombre.

## Qué mirar en la revisión

jsdom no calcula el diseño. Estos casos se miran en Chromium en el paso 5 de la tarea 2, con un script fuera del repo que simula la API con `page.route` (ver CLAUDE.md):

1. Un mensaje largo en la caja crece hasta 192 px y después hace scroll, sin tapar la conversación.
2. En una conversación más alta que la ventana, el último mensaje queda a la vista arriba de la caja, no detrás.
3. A 1024 px, las píldoras pasan de renglón y la etiqueta de Google no pisa el botón de enviar.
4. Las letras con trazo hacia abajo del título con degradé ("¿", "p") no se cortan: lleva `pb-1`.
5. El resplandor se ve desvanecerse al mandar el primer mensaje y no tapa el texto: el contenido va con `relative` después del resplandor.

---

### Tarea 1: Saludo, sugerencias y caja nueva

**Archivos:**
- Modificar: `apps/web/src/components/ui/Icono.tsx`, `apps/web/src/features/asistente/AsistentePage.tsx`
- Crear: `apps/web/src/features/asistente/CajaDeMensaje.tsx`, `apps/web/src/features/asistente/Bienvenida.tsx`
- Test: `apps/web/src/features/asistente/asistente.test.tsx`

**Interfaces que deja:**
- `CajaDeMensaje({ grande, campo, valor, alCambiar, alEnviar, esperando }: { grande: boolean; campo: Ref<HTMLTextAreaElement>; valor: string; alCambiar: (texto: string) => void; alEnviar: () => void; esperando: boolean })`. Con `grande`, el brillo alrededor y el placeholder largo.
- `Saludo({ nombre }: { nombre: string })`.
- `Sugerencias({ esAdmin, alUsar }: { esAdmin: boolean; alUsar: (frase: string) => void })`, con `role="group"` y `aria-label="Sugerencias"`.

- [x] **Paso 1:** escribir los tests nuevos y cambiar los viejos como dice la tabla. Los nuevos:

```tsx
it('la pantalla vacía saluda a recepción por el nombre y ofrece las dos sugerencias de consulta', async () => {
  conSesion(RECEPCION);
  renderizarEn('/asistente');

  expect(await screen.findByRole('heading', { name: '¿Por dónde empezamos?' })).toBeInTheDocument();
  expect(screen.getByText('Hola, Rita')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Menú' })).toHaveTextContent('Asistente');
  const sugerencias = within(screen.getByRole('group', { name: 'Sugerencias' })).getAllByRole('button');
  expect(sugerencias.map((boton) => boton.textContent)).toEqual(['Clases del jueves', 'Clases de un profesor']);
});

it('el administrador ve las cinco sugerencias', async () => {
  conSesion(ADMIN);
  renderizarEn('/asistente');

  expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();
  const sugerencias = within(screen.getByRole('group', { name: 'Sugerencias' })).getAllByRole('button');
  expect(sugerencias.map((boton) => boton.textContent)).toEqual([
    'Clases del jueves',
    'Crear un workshop',
    'Alta de profesor',
    'Horario nuevo',
    'Clases de un profesor',
  ]);
});

it('tocar una sugerencia reemplaza lo escrito, deja el foco en el campo y no envía', async () => {
  let pedidos = 0;
  servidor.use(
    http.post('/api/asistente/mensajes', () => {
      pedidos++;
      return HttpResponse.json({ historial: [], texto: RESPUESTA, propuestas: [] });
    }),
  );
  conSesion(ADMIN);
  const { usuario } = renderizarEn('/asistente');
  const campo = await screen.findByLabelText('Mensaje para el asistente');
  await usuario.type(campo, 'algo');

  await usuario.click(screen.getByRole('button', { name: 'Crear un workshop' }));

  expect(campo).toHaveValue('Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik');
  expect(campo).toHaveFocus();
  expect(pedidos).toBe(0);
});

it('Enviar está deshabilitado con el campo vacío o con solo espacios', async () => {
  conSesion(RECEPCION);
  const { usuario } = renderizarEn('/asistente');
  const campo = await screen.findByLabelText('Mensaje para el asistente');
  const enviar = screen.getByRole('button', { name: 'Enviar' });
  expect(enviar).toBeDisabled();

  await usuario.type(campo, '   ');
  expect(enviar).toBeDisabled();
  await usuario.type(campo, 'a');
  expect(enviar).toBeEnabled();
});

it('avisa que lo escrito lo procesa Google', async () => {
  conSesion(RECEPCION);
  renderizarEn('/asistente');

  expect(await screen.findByText('Lo procesa Google. No escribas datos de alumnos.')).toBeInTheDocument();
});
```

  Lo que se suma a los viejos:
  - "enviar un mensaje lo muestra...": `queryByRole('heading', { name: '¿Por dónde empezamos?' })` y `queryByRole('group', { name: 'Sugerencias' })` no están.
  - "si la API falla...": `getByRole('heading', { name: '¿Por dónde empezamos?' })` está.
  - "Nueva conversación vacía la lista..." y "cerrar sesión borra la conversación": donde buscaban el texto "¿Qué clases hay el jueves?", buscan el `heading` "¿Por dónde empezamos?".

- [x] **Paso 2:** correr `pnpm --filter @studio/web exec vitest run src/features/asistente/asistente.test.tsx` y verificar que los tests nuevos y cambiados fallan porque no encuentran el título "¿Por dónde empezamos?", el grupo "Sugerencias" o el aviso nuevo.
- [x] **Paso 3:** agregar los tres íconos a `Icono.tsx`, crear `CajaDeMensaje.tsx` y `Bienvenida.tsx`, y armar las dos disposiciones en `AsistentePage.tsx`: vacía (saludo, caja grande, error y sugerencias, centrados en vertical) y con conversación (mensajes como hoy, caja chica fija abajo con el error arriba). `usarSugerencia(frase)` llama a `conversacion.cambiarBorrador(frase)` y enfoca el `ref` del campo.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(asistente): saludo, sugerencias y caja nueva en la pantalla vacía`.

### Tarea 2: Resplandor que se apaga y mensajes con avatar

**Archivos:**
- Modificar: `apps/web/src/features/asistente/AsistentePage.tsx`
- Crear: `apps/web/src/features/asistente/ListaDeMensajes.tsx`
- Test: `apps/web/src/features/asistente/asistente.test.tsx`

**Interfaces:**
- Usa: `CajaDeMensaje`, `Saludo` y `Sugerencias` de la tarea 1.
- Deja: `ListaDeMensajes({ mensajes, esperando, alCrearse }: { mensajes: MensajeDelChat[]; esperando: boolean; alCrearse: (idDelMensaje: number, indice: number, enlace: string) => void })`, y en `AsistentePage.tsx`, `Resplandor({ visible }: { visible: boolean })`, un `div` con `aria-hidden="true"`, `data-resplandor` y la clase `opacity-100` u `opacity-0`.

- [x] **Paso 1:** escribir el test. Guarda el mismo elemento de punta a punta: si se desmontara, no se desvanecería.

```tsx
it('el resplandor se apaga con el primer mensaje y vuelve con Nueva conversación', async () => {
  asistenteQueResponde([]);
  conSesion(RECEPCION);
  const { usuario } = renderizarEn('/asistente');
  await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
  const resplandor = document.querySelector('[data-resplandor]');
  expect(resplandor).toHaveClass('opacity-100');

  await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
  await screen.findByText(RESPUESTA);
  expect(resplandor).toHaveClass('opacity-0');

  await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }));
  expect(resplandor).toHaveClass('opacity-100');
});
```

- [x] **Paso 2:** correr el archivo de tests del asistente y verificar que el test nuevo falla porque no hay ningún elemento con `data-resplandor`.
- [x] **Paso 3:** agregar `Resplandor` en `AsistentePage.tsx`, montado en un contenedor `relative flex min-h-full flex-col` que envuelve a las dos disposiciones, con `visible={vacia}` y `transition-opacity duration-700`. Crear `ListaDeMensajes.tsx` con las burbujas, el avatar y los puntos, y usarla en la conversación.
- [x] **Paso 4:** correr `pnpm --filter @studio/web test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** mirar en Chromium, a 1280 y a 1024 px, la pantalla vacía de admin y de recepción, una conversación con una propuesta y los cinco puntos de "Qué mirar en la revisión".
- [x] **Paso 6:** commit `feat(asistente): resplandor que se apaga y mensajes con avatar`.

## Verificación final

- [ ] `pnpm test` y `pnpm typecheck` pasan.
- [ ] En [asistente.md](asistente.md), la lista de archivos de la web suma `CajaDeMensaje.tsx`, `Bienvenida.tsx` y `ListaDeMensajes.tsx`.
