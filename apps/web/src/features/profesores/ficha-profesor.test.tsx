import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ActualizarClaseInput, Clase, CrearClaseInput, PorcentajeProfesor } from '@studio/shared';
import { unaClase, unProfesor } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

type Pedido = [metodo: string, ruta: string, cuerpo: unknown];

// Abre la ficha de Erik Zapata (id 1) con sus clases. Los handlers leen y cambian `clases` como lo haría la API,
// así la recarga después de guardar trae lo guardado. `pedidos` anota lo que la pantalla manda.
function fichaDeErik(clasesIniciales: Clase[]) {
  conSesion(ADMIN);
  let clases = clasesIniciales;
  const pedidos: Pedido[] = [];
  const consultasDeClases: string[] = [];
  servidor.use(
    http.get('/api/profesores/1', () =>
      HttpResponse.json(unProfesor({ id: 1, nombre: 'Erik', apellido: 'Zapata', porcentajeVigenteBp: 5000 })),
    ),
    // MSW compara la ruta sin la query: el filtro por profesor se controla acá. Sin él, la ficha mostraría
    // las clases de todo el estudio.
    http.get('/api/clases', ({ request }) => {
      const url = new URL(request.url);
      consultasDeClases.push(url.search);
      if (url.searchParams.get('profesorId') !== '1') {
        return HttpResponse.json({ error: `Faltó filtrar por el profesor: ${url.search}` }, { status: 400 });
      }
      return HttpResponse.json({ items: clases });
    }),
    http.post('/api/clases', async ({ request }) => {
      const cuerpo = (await request.json()) as CrearClaseInput;
      pedidos.push(['POST', '/api/clases', cuerpo]);
      const nueva = unaClase({
        id: 50,
        estilo: cuerpo.estilo,
        nivel: cuerpo.nivel ?? null,
        diaSemana: cuerpo.diaSemana,
        horaInicio: cuerpo.horaInicio,
        horaFin: cuerpo.horaFin,
      });
      clases = [...clases, nueva];
      return HttpResponse.json(nueva, { status: 201 });
    }),
    http.patch('/api/clases/:id', async ({ request, params }) => {
      const cuerpo = (await request.json()) as ActualizarClaseInput;
      pedidos.push(['PATCH', `/api/clases/${String(params.id)}`, cuerpo]);
      clases = clases.map((clase) => (clase.id === Number(params.id) ? { ...clase, ...cuerpo } as Clase : clase));
      return HttpResponse.json(clases.find((clase) => clase.id === Number(params.id)));
    }),
  );
  return { ...renderizarEn('/profesores/1'), pedidos, consultasDeClases };
}

// Lo que se lee de una fila: el texto de cada pieza, sin los íconos. Los campos de una fila en edición no tienen texto.
function piezasDe(fila: HTMLElement): string[] {
  return [...fila.querySelectorAll('*')]
    .filter((nodo) => nodo.children.length === 0 && nodo.closest('[aria-hidden="true"]') === null)
    .map((nodo) => nodo.textContent ?? '')
    .filter((texto) => texto !== '');
}

const elDia = (nombre: string) => screen.getByRole('region', { name: nombre });
const filasDe = (nombre: string) => within(elDia(nombre)).queryAllByRole('listitem');
const clasesDe = (nombre: string) => filasDe(nombre).map(piezasDe);

// Cada día de la pestaña Clases, en orden, con sus clases o con el texto del día vacío.
function semana() {
  return within(screen.getByRole('tabpanel'))
    .getAllByRole('region')
    .map((dia) => {
      const filas = within(dia).queryAllByRole('listitem');
      return [
        within(dia).getByRole('heading').textContent,
        filas.length > 0 ? filas.map(piezasDe) : within(dia).getByText('Sin clases').textContent,
      ];
    });
}

const SALSA_DEL_LUNES = unaClase({ id: 1, estilo: 'Salsa', nivel: null, diaSemana: 1, horaInicio: '18:00', horaFin: '19:30' });
const BACHATA_DEL_LUNES = unaClase({
  id: 2,
  estilo: 'Bachata',
  nivel: 'Inicial',
  diaSemana: 1,
  horaInicio: '19:30',
  horaFin: '21:00',
});

describe('/profesores/:id', () => {
  it('muestra las siete filas de la semana con las clases del profesor en su día y los días vacíos', async () => {
    const { consultasDeClases } = fichaDeErik([
      SALSA_DEL_LUNES,
      BACHATA_DEL_LUNES,
      unaClase({ id: 3, estilo: 'Tango', nivel: 'Avanzado', diaSemana: 3, horaInicio: '20:00', horaFin: '21:00' }),
      unaClase({ id: 4, estilo: 'Hip-Hop', nivel: 'Niños', diaSemana: 6, horaInicio: '10:15', horaFin: '11:00' }),
    ]);

    await screen.findByRole('region', { name: 'Lunes' });

    expect(semana()).toEqual([
      [
        'Lunes',
        [
          ['18:00 – 19:30', '1 h 30 min', 'Salsa', '—'],
          ['19:30 – 21:00', '1 h 30 min', 'Bachata', 'Inicial'],
        ],
      ],
      ['Martes', 'Sin clases'],
      ['Miércoles', [['20:00 – 21:00', '1 h', 'Tango', 'Avanzado']]],
      ['Jueves', 'Sin clases'],
      ['Viernes', 'Sin clases'],
      ['Sábado', [['10:15 – 11:00', '45 min', 'Hip-Hop', 'Niños']]],
      ['Domingo', 'Sin clases'],
    ]);
    const encabezado = screen.getByRole('heading', { level: 2, name: 'Erik Zapata' });
    expect([...encabezado.nextElementSibling!.children].map((insignia) => insignia.textContent)).toEqual([
      'Activo',
      '50% por alumno',
      '4 clases por semana',
    ]);
    expect(consultasDeClases).toEqual(['?profesorId=1']);
  });

  it('editar una fila manda PATCH con solo las horas, el estilo y el nivel, y la fila vuelve a lectura', async () => {
    const { usuario, pedidos } = fichaDeErik([SALSA_DEL_LUNES, BACHATA_DEL_LUNES]);
    await screen.findByRole('region', { name: 'Lunes' });

    await usuario.click(within(filasDe('Lunes')[0]!).getByRole('button', { name: 'Editar la clase' }));
    const fila = filasDe('Lunes')[0]!;
    expect(within(fila).getByRole('combobox', { name: 'Empieza' })).toHaveValue('18:00');
    expect(within(fila).getByRole('combobox', { name: 'Termina' })).toHaveValue('19:30');
    expect(within(fila).getByRole('textbox', { name: 'Estilo' })).toHaveValue('Salsa');
    expect(within(fila).getByRole('textbox', { name: 'Nivel' })).toHaveValue('');

    await usuario.click(within(fila).getByRole('button', { name: 'Elegir el horario (Empieza)' }));
    await usuario.click(screen.getByRole('option', { name: '18:30' }));
    await usuario.click(within(fila).getByRole('button', { name: 'Elegir el horario (Termina)' }));
    await usuario.click(screen.getByRole('option', { name: '20:00' }));
    await usuario.clear(within(fila).getByRole('textbox', { name: 'Estilo' }));
    await usuario.type(within(fila).getByRole('textbox', { name: 'Estilo' }), 'Salsa caleña');
    await usuario.type(within(fila).getByRole('textbox', { name: 'Nivel' }), 'Intermedio');
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(clasesDe('Lunes')).toEqual([
        ['18:30 – 20:00', '1 h 30 min', 'Salsa caleña', 'Intermedio'],
        ['19:30 – 21:00', '1 h 30 min', 'Bachata', 'Inicial'],
      ]),
    );
    expect(pedidos).toEqual([
      ['PATCH', '/api/clases/1', { horaInicio: '18:30', horaFin: '20:00', estilo: 'Salsa caleña', nivel: 'Intermedio' }],
    ]);
  });

  it('el "+" de un día agrega una fila en edición y guardarla manda POST con ese día y el profesor', async () => {
    const { usuario, pedidos } = fichaDeErik([SALSA_DEL_LUNES]);
    await screen.findByRole('region', { name: 'Jueves' });

    await usuario.click(within(elDia('Jueves')).getByRole('button', { name: 'Agregar una clase el jueves' }));
    const fila = filasDe('Jueves')[0]!;
    expect(within(fila).getByRole('combobox', { name: 'Empieza' })).toHaveValue('18:00');
    expect(within(fila).getByRole('combobox', { name: 'Termina' })).toHaveValue('19:30');
    expect(within(fila).getByRole('textbox', { name: 'Estilo' })).toHaveValue('');
    expect(within(fila).getByRole('textbox', { name: 'Nivel' })).toHaveValue('');

    await usuario.type(within(fila).getByRole('textbox', { name: 'Estilo' }), 'Jazz');
    await usuario.type(within(fila).getByRole('textbox', { name: 'Nivel' }), 'Inicial');
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(clasesDe('Jueves')).toEqual([['18:00 – 19:30', '1 h 30 min', 'Jazz', 'Inicial']]));
    expect(pedidos).toEqual([
      [
        'POST',
        '/api/clases',
        { estilo: 'Jazz', nivel: 'Inicial', diaSemana: 4, horaInicio: '18:00', horaFin: '19:30', profesorId: 1 },
      ],
    ]);
  });

  it('"Cancelar" en una fila nueva la descarta y no manda nada', async () => {
    const { usuario, pedidos } = fichaDeErik([SALSA_DEL_LUNES]);
    await screen.findByRole('region', { name: 'Jueves' });

    await usuario.click(within(elDia('Jueves')).getByRole('button', { name: 'Agregar una clase el jueves' }));
    await usuario.type(within(filasDe('Jueves')[0]!).getByRole('textbox', { name: 'Estilo' }), 'Jazz');
    await usuario.click(within(filasDe('Jueves')[0]!).getByRole('button', { name: 'Cancelar' }));

    expect(filasDe('Jueves')).toEqual([]);
    expect(within(elDia('Jueves')).getByText('Sin clases')).toBeInTheDocument();
    expect(pedidos).toEqual([]);
  });

  it('el error de la API aparece debajo de la fila y la fila sigue en edición', async () => {
    const { usuario } = fichaDeErik([SALSA_DEL_LUNES]);
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/clases', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json({ error: 'El profesor Erik Zapata está dado de baja' }, { status: 422 });
      }),
    );
    await screen.findByRole('region', { name: 'Jueves' });

    await usuario.click(within(elDia('Jueves')).getByRole('button', { name: 'Agregar una clase el jueves' }));
    await usuario.type(within(filasDe('Jueves')[0]!).getByRole('textbox', { name: 'Estilo' }), 'Jazz');
    await usuario.click(within(filasDe('Jueves')[0]!).getByRole('button', { name: 'Guardar' }));

    const fila = filasDe('Jueves')[0]!;
    expect(await within(fila).findByRole('alert')).toHaveTextContent('El profesor Erik Zapata está dado de baja');
    expect(within(fila).getByRole('combobox', { name: 'Empieza' })).toHaveValue('18:00');
    expect(within(fila).getByRole('combobox', { name: 'Termina' })).toHaveValue('19:30');
    expect(within(fila).getByRole('textbox', { name: 'Estilo' })).toHaveValue('Jazz');
    expect(filasDe('Jueves')).toHaveLength(1);
    expect(cuerpoRecibido).toEqual({
      estilo: 'Jazz',
      nivel: null,
      diaSemana: 4,
      horaInicio: '18:00',
      horaFin: '19:30',
      profesorId: 1,
    });
  });

  it('una hora de fin anterior a la de inicio muestra el error debajo de la fila y no manda nada', async () => {
    const { usuario, pedidos } = fichaDeErik([SALSA_DEL_LUNES]);
    await screen.findByRole('region', { name: 'Lunes' });

    await usuario.click(within(filasDe('Lunes')[0]!).getByRole('button', { name: 'Editar la clase' }));
    const fila = filasDe('Lunes')[0]!;
    await usuario.click(within(fila).getByRole('button', { name: 'Elegir el horario (Termina)' }));
    await usuario.click(screen.getByRole('option', { name: '17:00' }));
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }));

    expect(within(fila).getByRole('alert')).toHaveTextContent('La hora de fin tiene que ser posterior a la de inicio');
    expect(within(fila).getByRole('combobox', { name: 'Termina' })).toHaveValue('17:00');
    expect(pedidos).toEqual([]);
  });

  it('cargar un porcentaje nuevo desde la pestaña Porcentajes manda puntos básicos y la fecha', async () => {
    let porcentajes: PorcentajeProfesor[] = [{ id: 1, porcentajeBp: 5000, vigenteDesde: '2026-01-01' }];
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/profesores/1/porcentajes', () => HttpResponse.json({ items: porcentajes })),
      http.post('/api/profesores/1/porcentajes', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const nuevo = { id: 2, porcentajeBp: 6000, vigenteDesde: '2026-04-01' };
        porcentajes = [...porcentajes, nuevo];
        return HttpResponse.json(nuevo, { status: 201 });
      }),
    );
    const { usuario } = fichaDeErik([]);

    await usuario.click(await screen.findByRole('tab', { name: 'Porcentajes' }));
    const pestana = screen.getByRole('tabpanel');
    await within(pestana).findByText('50% desde el 01/01/2026');
    await usuario.type(within(pestana).getByLabelText('Nuevo porcentaje (%)'), '60');
    await usuario.type(within(pestana).getByLabelText('Vigente desde'), '2026-04-01');
    await usuario.click(within(pestana).getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(within(pestana).getAllByRole('listitem').map((porcentaje) => porcentaje.textContent)).toEqual([
        '50% desde el 01/01/2026',
        '60% desde el 01/04/2026',
      ]),
    );
    expect(cuerpoRecibido).toEqual({ porcentajeBp: 6000, vigenteDesde: '2026-04-01' });
  });
});
