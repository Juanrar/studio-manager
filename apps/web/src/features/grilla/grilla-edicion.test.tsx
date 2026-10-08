import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clase, ClasesDelRango } from '@studio/shared';
import { unaClase, unProfesorEnListado } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

// Martes 10 de marzo de 2026 a las 12:00 de Buenos Aires: el lunes 9 ya pasó.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const HIP_HOP_DEL_JUEVES = unaClase({ id: 50, horarioId: 2, fecha: '2026-03-12' });
const SALSA_CANCELADA = unaClase({
  id: 51,
  horarioId: 3,
  fecha: '2026-03-12',
  estilo: 'Salsa',
  nivel: null,
  horaInicio: '21:00',
  horaFin: '22:00',
  estado: 'cancelada',
  tieneCambios: true,
});
const BALLET_DEL_LUNES = unaClase({ id: 53, horarioId: 4, fecha: '2026-03-09', estilo: 'Ballet', nivel: null, horaInicio: '10:00', horaFin: '11:00' });

type Pedido = [string, string, unknown];

function grillaEditable(clases: Clase[] = [HIP_HOP_DEL_JUEVES, SALSA_CANCELADA, BALLET_DEL_LUNES]) {
  conSesion(ADMIN);
  let actuales = [...clases];
  const pedidos: Pedido[] = [];
  servidor.use(
    http.get('/api/clases', ({ request }) => {
      const url = new URL(request.url);
      const desde = url.searchParams.get('desde')!;
      const hasta = url.searchParams.get('hasta')!;
      const respuesta: ClasesDelRango = {
        desde,
        hasta,
        finDelHorizonte: '2026-05-03',
        items: actuales.filter((clase) => clase.fecha >= desde && clase.fecha <= hasta),
      };
      return HttpResponse.json(respuesta);
    }),
    http.get('/api/profesores', () =>
      HttpResponse.json({
        items: [
          unProfesorEnListado({ id: 1, nombre: 'Erik', apellido: 'Zapata' }),
          unProfesorEnListado({ id: 2, nombre: 'Iaru', apellido: 'Speroni' }),
        ],
      }),
    ),
    http.patch('/api/clases/:id', async ({ request, params }) => {
      const cuerpo = (await request.json()) as Partial<Clase>;
      pedidos.push(['PATCH', `/api/clases/${String(params.id)}`, cuerpo]);
      actuales = actuales.map((clase) => (clase.id === Number(params.id) ? { ...clase, ...cuerpo } : clase));
      return HttpResponse.json(actuales.find((clase) => clase.id === Number(params.id)));
    }),
    http.post('/api/clases', async ({ request }) => {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      pedidos.push(['POST', '/api/clases', cuerpo]);
      const creada = unaClase({ ...(cuerpo as Partial<Clase>), id: 60, horarioId: null, profesorTitular: null, tieneCambios: true });
      actuales = [...actuales, creada];
      return HttpResponse.json(creada, { status: 201 });
    }),
    http.patch('/api/horarios/:id', async ({ request, params }) => {
      pedidos.push(['PATCH', `/api/horarios/${String(params.id)}`, await request.json()]);
      return HttpResponse.json({});
    }),
    http.post('/api/horarios', async ({ request }) => {
      pedidos.push(['POST', '/api/horarios', await request.json()]);
      return HttpResponse.json({ id: 9 }, { status: 201 });
    }),
  );
  return { ...renderizarEn('/grilla'), pedidos };
}

async function elegirHora(usuario: ReturnType<typeof renderizarEn>['usuario'], campo: 'Empieza' | 'Termina', hora: string) {
  await usuario.click(screen.getByRole('button', { name: `Elegir el horario (${campo})` }));
  await usuario.click(screen.getByRole('option', { name: hora }));
}

describe('/grilla: editar una semana', () => {
  it('guardar el editor manda el cambio de esa clase y el aviso ofrece aplicarlo a todas las semanas', async () => {
    const { usuario, pedidos } = grillaEditable();

    await usuario.click(await screen.findByRole('button', { name: /^Hip-Hop/ }));
    const editor = await screen.findByRole('dialog', { name: 'Hip-Hop Inicial' });
    await elegirHora(usuario, 'Empieza', '20:00');
    await elegirHora(usuario, 'Termina', '21:30');
    await usuario.click(within(editor).getByRole('button', { name: 'Guardar' }));

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Hip-Hop pasa al jueves 20:00, solo esta semana.');
    await usuario.click(within(aviso).getByRole('button', { name: 'Aplicar a todas las semanas' }));

    await waitFor(() =>
      expect(pedidos).toEqual([
        [
          'PATCH',
          '/api/clases/50',
          { fecha: '2026-03-12', horaInicio: '20:00', horaFin: '21:30', estilo: 'Hip-Hop', nivel: 'Inicial', profesorId: 1 },
        ],
        [
          'PATCH',
          '/api/horarios/2',
          {
            diaSemana: 4,
            horaInicio: '20:00',
            horaFin: '21:30',
            estilo: 'Hip-Hop',
            nivel: 'Inicial',
            profesorId: 1,
            desde: '2026-03-09',
          },
        ],
      ]),
    );
  });

  it('"Deshacer" vuelve la clase a como estaba', async () => {
    const { usuario, pedidos } = grillaEditable();

    await usuario.click(await screen.findByRole('button', { name: /^Hip-Hop/ }));
    await elegirHora(usuario, 'Empieza', '20:00');
    await elegirHora(usuario, 'Termina', '21:30');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    await usuario.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Deshacer' }));

    await waitFor(() => expect(pedidos).toHaveLength(2));
    expect(pedidos[1]).toEqual([
      'PATCH',
      '/api/clases/50',
      { fecha: '2026-03-12', horaInicio: '19:00', horaFin: '20:30', estilo: 'Hip-Hop', nivel: 'Inicial', profesorId: 1 },
    ]);
  });

  it('una clase de un día que ya pasó no abre el editor', async () => {
    const { usuario } = grillaEditable();

    await usuario.click(await screen.findByRole('button', { name: /^Ballet/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('una clase cancelada ofrece volver a dictarla', async () => {
    const { usuario, pedidos } = grillaEditable();

    await usuario.click(await screen.findByRole('button', { name: /^Salsa.*cancelada$/ }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver a dictarla' }));

    await waitFor(() => expect(pedidos).toEqual([['PATCH', '/api/clases/51', { estado: 'programada' }]]));
  });

  it('quitar una clase de un horario la cancela esa semana y el aviso ofrece quitarla de todas', async () => {
    const { usuario, pedidos } = grillaEditable();

    await usuario.click(await screen.findByRole('button', { name: /^Hip-Hop/ }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' }));
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Hip-Hop no se dicta esta semana.');
    await usuario.click(within(aviso).getByRole('button', { name: 'Quitar de todas las semanas' }));

    await waitFor(() =>
      expect(pedidos).toEqual([
        ['PATCH', '/api/clases/50', { estado: 'cancelada' }],
        ['PATCH', '/api/horarios/2', { activo: false, desde: '2026-03-09' }],
      ]),
    );
  });

  it('tocar un hueco crea una clase única de una hora, y el aviso ofrece agregarla a todas las semanas', async () => {
    const { usuario, pedidos } = grillaEditable();
    const sabado = await screen.findByRole('group', { name: 'Sábado 14' });
    // jsdom no calcula el diseño: la grilla mide 700 px de ancho (100 por día) y empieza arriba de todo.
    vi.spyOn(sabado.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 700, height: 945 } as DOMRect);

    // Las 18:00 están 10 horas después de las 08:00, a 1,05 px por minuto.
    await usuario.pointer([
      { keys: '[MouseLeft>]', target: sabado, coords: { clientX: 550, clientY: 600 * 1.05 + 5 } },
      { keys: '[/MouseLeft]', target: sabado, coords: { clientX: 550, clientY: 600 * 1.05 + 5 } },
    ]);
    const editor = await screen.findByRole('dialog', { name: 'Nueva clase' });
    expect(within(editor).getByRole('combobox', { name: 'Empieza' })).toHaveValue('18:00');
    expect(within(editor).getByRole('combobox', { name: 'Termina' })).toHaveValue('19:00');
    await usuario.type(within(editor).getByRole('textbox', { name: 'Estilo' }), 'Tango');
    await usuario.type(within(editor).getByRole('textbox', { name: 'Nivel' }), 'Workshop');
    await usuario.click(within(editor).getByRole('button', { name: 'Agregar' }));
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Tango agregada el sábado 18:00, solo esta semana.');
    await usuario.click(within(aviso).getByRole('button', { name: 'Agregar a todas las semanas' }));

    await waitFor(() =>
      expect(pedidos).toEqual([
        [
          'POST',
          '/api/clases',
          { fecha: '2026-03-14', horaInicio: '18:00', horaFin: '19:00', estilo: 'Tango', nivel: 'Workshop', profesorId: 1 },
        ],
        [
          'POST',
          '/api/horarios',
          {
            estilo: 'Tango',
            nivel: 'Workshop',
            diaSemana: 6,
            horaInicio: '18:00',
            horaFin: '19:00',
            profesorId: 1,
            desde: '2026-03-09',
            claseId: 60,
          },
        ],
      ]),
    );
  });

  it('si la API rechaza el cambio, el aviso muestra el motivo', async () => {
    const { usuario } = grillaEditable();
    servidor.use(
      http.patch('/api/clases/:id', () =>
        HttpResponse.json(
          { error: 'La clase del 2026-03-12 tiene alumnos anotados con un pack que vence antes del 2026-03-13' },
          { status: 422 },
        ),
      ),
    );

    await usuario.click(await screen.findByRole('button', { name: /^Hip-Hop/ }));
    await usuario.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Día'), 'Viernes 13');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La clase del 2026-03-12 tiene alumnos anotados con un pack que vence antes del 2026-03-13',
    );
  });
});
