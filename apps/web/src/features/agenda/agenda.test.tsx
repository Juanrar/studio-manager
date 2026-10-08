import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
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

describe('/agenda', () => {
  it('muestra cada clase del día en una fila con el profesor que la da, los asistentes y el estado', async () => {
    const pedidos = agendaQueDevuelve(CLASES_DEL_10);
    renderizarEn('/agenda?fecha=2026-03-10');

    await screen.findByRole('row', { name: /Hip-Hop/ });
    const [, ...filas] = screen.getAllByRole('row');
    const celdas = filas.map((fila) => within(fila).getAllByRole('cell').map((celda) => celda.textContent));
    expect(celdas).toEqual([
      ['18:00 a 19:00', 'Ballet', '—', 'Erik Zapata', '0', 'Programada', 'Tomar asistencia'],
      ['19:00 a 20:30', 'Hip-Hop', 'Inicial', 'Iaru Speroni (suplente)', '4', 'Programada', 'Ver asistencia'],
      ['21:00 a 22:00', 'Salsa', '—', 'Erik Zapata', '0', 'Cancelada', 'Ver asistencia'],
    ]);
    expect(pedidos).toEqual(['?desde=2026-03-10&hasta=2026-03-10']);
  });

  it('"Tomar asistencia" lleva a la clase, que ya existe: no la abre con un POST', async () => {
    agendaQueDevuelve(CLASES_DEL_10);
    servidor.use(
      // La pantalla de la clase carga sus datos al llegar. MSW falla si llega un POST que el test no previó.
      http.get('/api/clases/49', () => HttpResponse.json(CLASES_DEL_10.items[0])),
      http.get('/api/clases/49/asistencias', () => HttpResponse.json({ items: [] })),
      http.get('/api/profesores', () => HttpResponse.json({ items: [] })),
    );
    const { usuario, router } = renderizarEn('/agenda?fecha=2026-03-10');

    const ballet = await screen.findByRole('row', { name: /Ballet/ });
    await usuario.click(within(ballet).getByRole('link', { name: 'Tomar asistencia' }));

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
