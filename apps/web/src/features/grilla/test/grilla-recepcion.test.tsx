import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clase, ClasesDelRango } from '@studio/shared';
import { unaClase } from '../../../../test/datos.ts';
import { conSesion, RECEPCION, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const HIP_HOP = unaClase({ id: 50, horarioId: 2, fecha: '2026-03-10' });
const BALLET = unaClase({ id: 52, horarioId: 4, fecha: '2026-03-12', estilo: 'Ballet', nivel: 'Inicial', horaInicio: '10:00', horaFin: '11:00' });

function grillaDeRecepcion(clases: Clase[]) {
  conSesion(RECEPCION);
  const pedidos: string[] = [];
  servidor.use(
    http.get('/api/clases', ({ request }) => {
      const url = new URL(request.url);
      pedidos.push(url.search);
      const desde = url.searchParams.get('desde')!;
      const hasta = url.searchParams.get('hasta')!;
      const respuesta: ClasesDelRango = {
        desde,
        hasta,
        finDelHorizonte: '2026-05-03',
        items: clases.filter((clase) => clase.fecha >= desde && clase.fecha <= hasta),
      };
      return HttpResponse.json(respuesta);
    }),
  );
  return pedidos;
}

describe('/grilla para recepción', () => {
  it('recepción entra a la grilla desde el menú y ve las clases de la semana por su nombre, sin ningún botón de clase', async () => {
    const pedidos = grillaDeRecepcion([HIP_HOP, BALLET]);
    renderizarEn('/grilla');

    const hipHop = await screen.findByLabelText('Hip-Hop Inicial, 19:00 a 20:30, Erik Zapata');
    const martes = screen.getByRole('group', { name: 'Martes 10' });
    const jueves = screen.getByRole('group', { name: 'Jueves 12' });
    expect(martes).toContainElement(hipHop);
    expect(jueves).toContainElement(screen.getByLabelText('Ballet Inicial, 10:00 a 11:00, Erik Zapata'));
    expect(within(martes).queryAllByRole('button')).toEqual([]);
    expect(within(jueves).queryAllByRole('button')).toEqual([]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Marzo 2026');
    expect(pedidos).toEqual(['?desde=2026-03-09&hasta=2026-03-15']);
    expect(
      within(screen.getByRole('navigation', { name: 'Menú' }))
        .getAllByRole('link')
        .map((enlace) => enlace.textContent),
    ).toEqual(['Agenda', 'Grilla', 'Alumnos', 'Asistente']);
    expect(screen.getByRole('link', { name: 'Grilla' })).toHaveAttribute('aria-current', 'page');
  });

  it('apretar un hueco de un día futuro no abre "Nueva clase" y apretar una clase no abre su editor', async () => {
    grillaDeRecepcion([HIP_HOP, BALLET]);
    const { usuario } = renderizarEn('/grilla');
    const ballet = await screen.findByLabelText('Ballet Inicial, 10:00 a 11:00, Erik Zapata');
    const sabado = screen.getByRole('group', { name: 'Sábado 14' });
    vi.spyOn(sabado.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 700, height: 945 } as DOMRect);

    await usuario.pointer([
      { keys: '[MouseLeft>]', target: sabado, coords: { clientX: 550, clientY: 600 * 1.05 + 5 } },
      { keys: '[/MouseLeft]', target: sabado, coords: { clientX: 550, clientY: 600 * 1.05 + 5 } },
    ]);
    await usuario.click(ballet);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recepción pasa de semana con las flechas y va a la vista Mes', async () => {
    const pedidos = grillaDeRecepcion([HIP_HOP]);
    const { usuario, router } = renderizarEn('/grilla');
    await screen.findByLabelText('Hip-Hop Inicial, 19:00 a 20:30, Erik Zapata');

    await usuario.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await screen.findByRole('group', { name: 'Lunes 16' });
    expect(screen.getByText('16 – 22 mar')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Mes' }));
    await screen.findByRole('button', { name: 'Martes 10, 1 clase' });

    expect(router.state.location.search).toBe('?vista=mes&fecha=2026-03-16');
    await waitFor(() =>
      expect(pedidos).toEqual([
        '?desde=2026-03-09&hasta=2026-03-15',
        '?desde=2026-03-16&hasta=2026-03-22',
        '?desde=2026-02-23&hasta=2026-04-05',
      ]),
    );
  });
});
