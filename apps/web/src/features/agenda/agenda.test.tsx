import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AgendaDelDia, Clase } from '@studio/shared';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };

// Martes 10 de marzo: Ballet sin abrir, Hip-Hop con suplente y 4 asistentes, Salsa cancelada.
const AGENDA_DEL_10: AgendaDelDia = {
  fecha: '2026-03-10',
  items: [
    { horarioId: 1, estilo: 'Ballet', nivel: null, horaInicio: '18:00', horaFin: '19:00', profesorTitular: ERIK, clase: null },
    {
      horarioId: 2,
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      horaInicio: '19:00',
      horaFin: '20:30',
      profesorTitular: ERIK,
      clase: { id: 50, horarioId: 2, fecha: '2026-03-10', estado: 'programada', profesor: IARU, asistentes: 4 },
    },
    {
      horarioId: 3,
      estilo: 'Salsa',
      nivel: null,
      horaInicio: '21:00',
      horaFin: '22:00',
      profesorTitular: ERIK,
      clase: { id: 51, horarioId: 3, fecha: '2026-03-10', estado: 'cancelada', profesor: ERIK, asistentes: 0 },
    },
  ],
};

function agendaDel10() {
  conSesion(RECEPCION);
  const fechasPedidas: (string | null)[] = [];
  servidor.use(
    http.get('/api/clases/dia', ({ request }) => {
      fechasPedidas.push(new URL(request.url).searchParams.get('fecha'));
      return HttpResponse.json(AGENDA_DEL_10);
    }),
  );
  return fechasPedidas;
}

describe('/agenda', () => {
  it('muestra cada clase en una fila con el profesor que la da, los asistentes y el estado', async () => {
    const fechasPedidas = agendaDel10();
    renderizarEn('/agenda?fecha=2026-03-10');

    await screen.findByRole('row', { name: /Hip-Hop/ });
    const [, ...filas] = screen.getAllByRole('row');
    const celdas = filas.map((fila) => within(fila).getAllByRole('cell').map((celda) => celda.textContent));
    expect(celdas).toEqual([
      ['18:00 a 19:00', 'Ballet', '—', 'Erik Zapata', '—', 'Sin abrir', 'Tomar asistencia'],
      ['19:00 a 20:30', 'Hip-Hop', 'Inicial', 'Iaru Speroni (suplente)', '4', 'Abierta', 'Ver asistencia'],
      ['21:00 a 22:00', 'Salsa', '—', 'Erik Zapata', '0', 'Cancelada', 'Ver asistencia'],
    ]);
    expect(fechasPedidas).toEqual(['2026-03-10']);
  });

  it('"Tomar asistencia" abre la clase de ese horario y esa fecha, y lleva a su pantalla', async () => {
    agendaDel10();
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/clases', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const clase: Clase = { id: 52, horarioId: 1, fecha: '2026-03-10', estado: 'programada', profesor: ERIK, asistentes: 0 };
        return HttpResponse.json(clase, { status: 201 });
      }),
      // La pantalla de la clase carga sus datos al llegar.
      http.get('/api/clases/52', () =>
        HttpResponse.json({
          id: 52, horarioId: 1, fecha: '2026-03-10', estado: 'programada', profesor: ERIK, asistentes: 0,
          estilo: 'Ballet', nivel: null, horaInicio: '18:00', horaFin: '19:00',
        }),
      ),
      http.get('/api/clases/52/asistencias', () => HttpResponse.json({ items: [] })),
      http.get('/api/profesores', () => HttpResponse.json({ items: [] })),
    );
    const { usuario, router } = renderizarEn('/agenda?fecha=2026-03-10');

    const ballet = await screen.findByRole('row', { name: /Ballet/ });
    await usuario.click(within(ballet).getByRole('button', { name: 'Tomar asistencia' }));

    await screen.findByRole('heading', { name: /Asistencia/ });
    expect(cuerpoRecibido).toEqual({ horarioId: 1, fecha: '2026-03-10' });
    expect(router.state.location.pathname).toBe('/clases/52');
  });
});
