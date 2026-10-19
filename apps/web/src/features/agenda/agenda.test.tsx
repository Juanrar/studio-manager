import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClasesDelRango } from '@studio/shared';
import { unaClase } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };

// Martes 10 de marzo: Ballet sin asistentes, Hip-Hop con suplente y 4 asistentes, Salsa cancelada.
const CLASES_DEL_10: ClasesDelRango = {
  desde: '2026-03-10',
  hasta: '2026-03-10',
  finDelHorizonte: '2026-05-03',
  items: [
    unaClase({ id: 49, horarioId: 1, estilo: 'Ballet', nivel: null, horaInicio: '18:00', horaFin: '19:00' }),
    unaClase({
      id: 52,
      horarioId: 4,
      estilo: 'Jazz',
      nivel: null,
      horaInicio: '18:00',
      horaFin: '19:00',
      profesor: IARU,
      profesorTitular: IARU,
    }),
    unaClase({ id: 50, horarioId: 2, profesor: IARU, profesorTitular: ERIK, tieneCambios: true, asistentes: 4 }),
    unaClase({
      id: 51,
      horarioId: 3,
      estilo: 'Salsa',
      nivel: null,
      horaInicio: '21:00',
      horaFin: '22:00',
      estado: 'cancelada',
      tieneCambios: true,
    }),
  ],
};

// Devuelve la respuesta pedida y anota los parámetros de cada pedido.
function agendaQueDevuelve(respuesta: ClasesDelRango) {
  conSesion(RECEPCION);
  const pedidos: string[] = [];
  servidor.use(
    http.get('/api/clases', ({ request }) => {
      pedidos.push(new URL(request.url).search);
      return HttpResponse.json(respuesta);
    }),
  );
  return pedidos;
}

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

const G1 = '18:00 a 19:00 Ballet Erik Zapata Jazz Iaru Speroni';
const G2 = '19:00 a 20:30 Hip-Hop Iaru Speroni suplente';
const G3 = '21:00 a 22:00 Salsa Erik Zapata cancelada';

describe('/agenda', () => {
  beforeEach(() => {
    // El día 11: así el 10 de marzo no es hoy.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-03-11T15:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('otro día muestra cada grupo con su hora, estilo, profesor y marcas', async () => {
    const pedidos = agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda?fecha=2026-03-10');

    await screen.findByRole('list', { name: 'Clases del día' });
    expect(renglones()).toEqual([
      '18:00 a 19:00 Ballet Erik Zapata Jazz Iaru Speroni',
      '19:00 a 20:30 Hip-Hop Iaru Speroni suplente',
      '21:00 a 22:00 Salsa Erik Zapata cancelada',
    ]);
    expect(pedidos).toEqual(['?desde=2026-03-10&hasta=2026-03-10']);
  });

  it('hoy, la línea va antes de la primera clase que no terminó', async () => {
    vi.setSystemTime(new Date('2026-03-10T22:20:00Z'));
    agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda?fecha=2026-03-10');

    await screen.findByRole('list', { name: 'Clases del día' });
    expect(renglones()).toEqual([G1, 'Ahora', `${G2} en curso`, G3]);
  });

  it('sin fecha en la dirección, hoy muestra la línea igual que con fecha', async () => {
    vi.setSystemTime(new Date('2026-03-10T22:20:00Z'));
    agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda');

    await screen.findByRole('list', { name: 'Clases del día' });
    expect(renglones()).toEqual([G1, 'Ahora', `${G2} en curso`, G3]);
  });

  it('sin fecha, al pasar la medianoche la agenda pide el día nuevo', async () => {
    // 23:59:30 del 10 en el estudio.
    vi.setSystemTime(new Date('2026-03-11T02:59:30Z'));
    const pedidos = agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda');

    await screen.findByRole('list', { name: 'Clases del día' });
    expect(pedidos).toEqual(['']);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    await vi.waitFor(() => expect(pedidos).toEqual(['', '']));
  });

  it.each([
    ['10:00', '2026-03-10T13:00:00Z', ['Ahora', G1, G2, G3]],
    ['21:30, con la cancelada en horario', '2026-03-11T00:30:00Z', [G1, G2, 'Ahora', G3]],
    ['22:00, cuando terminó la última', '2026-03-11T01:00:00Z', [G1, G2, G3, 'Ahora']],
  ])('hoy a las %s', async (_hora, instante, esperado) => {
    vi.setSystemTime(new Date(instante));
    agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda?fecha=2026-03-10');

    await screen.findByRole('list', { name: 'Clases del día' });
    expect(renglones()).toEqual(esperado);
  });

  it('la línea avanza sola y la lista baja a ella una vez', async () => {
    const desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar;
    try {
      vi.setSystemTime(new Date('2026-03-10T23:29:00Z'));
      agendaQueDevuelve(CLASES_DEL_10);
      renderizarEn('/agenda?fecha=2026-03-10');

      await screen.findByRole('list', { name: 'Clases del día' });
      expect(renglones()).toEqual([G1, 'Ahora', `${G2} en curso`, G3]);
      expect(desplazar).toHaveBeenCalledTimes(1);
      expect(desplazar).toHaveBeenCalledWith({ block: 'center' });
      expect(desplazar.mock.contexts[0]).toHaveTextContent('Ahora');

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(renglones()).toEqual([G1, G2, 'Ahora', G3]);
      expect(desplazar).toHaveBeenCalledTimes(1);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('tocar una clase lleva a su asistencia, que ya existe: no la abre con un POST', async () => {
    agendaQueDevuelve(CLASES_DEL_10);
    servidor.use(
      // La pantalla de la clase carga sus datos al llegar. MSW falla si llega un POST que el test no previó.
      http.get('/api/clases/49', () => HttpResponse.json(CLASES_DEL_10.items[0])),
      http.get('/api/clases/49/asistencias', () => HttpResponse.json({ items: [] })),
      http.get('/api/profesores', () => HttpResponse.json({ items: [] })),
    );
    const { usuario, router } = renderizarEn('/agenda?fecha=2026-03-10');

    await usuario.click(await screen.findByRole('link', { name: /Ballet/ }));

    await screen.findByRole('heading', { name: /Asistencia/ });
    expect(router.state.location.pathname).toBe('/clases/49');
  });

  it('sin fecha en la dirección pide las clases de hoy y muestra el día que devuelve la API', async () => {
    const pedidos = agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda');

    expect(await screen.findByText('martes, 10 de marzo')).toBeInTheDocument();
    expect(pedidos).toEqual(['']);
  });

  it('una fecha después del horizonte avisa que la grilla de ese día todavía no está armada', async () => {
    agendaQueDevuelve({ desde: '2026-06-10', hasta: '2026-06-10', finDelHorizonte: '2026-05-03', items: [] });
    renderizarEn('/agenda?fecha=2026-06-10');

    expect(await screen.findByText('La grilla de ese día todavía no está armada.')).toBeInTheDocument();
    expect(screen.queryByText('No hay clases este día.')).not.toBeInTheDocument();
  });
});
