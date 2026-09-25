import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AgendaDelDia, Sesion } from '@studio/shared';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };

// Martes 10 de marzo: Ballet sin abrir, Hip-Hop con suplente y 4 asistentes, Salsa cancelada.
const AGENDA_DEL_10: AgendaDelDia = {
  fecha: '2026-03-10',
  items: [
    { claseId: 1, estilo: 'Ballet', nivel: null, horaInicio: '18:00', horaFin: '19:00', profesorTitular: ERIK, sesion: null },
    {
      claseId: 2,
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      horaInicio: '19:00',
      horaFin: '20:30',
      profesorTitular: ERIK,
      sesion: { id: 50, claseId: 2, fecha: '2026-03-10', estado: 'programada', profesor: IARU, asistentes: 4 },
    },
    {
      claseId: 3,
      estilo: 'Salsa',
      nivel: null,
      horaInicio: '21:00',
      horaFin: '22:00',
      profesorTitular: ERIK,
      sesion: { id: 51, claseId: 3, fecha: '2026-03-10', estado: 'cancelada', profesor: ERIK, asistentes: 0 },
    },
  ],
};

function agendaDel10() {
  conSesion(RECEPCION);
  const fechasPedidas: (string | null)[] = [];
  servidor.use(
    http.get('/api/sesiones/dia', ({ request }) => {
      fechasPedidas.push(new URL(request.url).searchParams.get('fecha'));
      return HttpResponse.json(AGENDA_DEL_10);
    }),
  );
  return fechasPedidas;
}

describe('/agenda', () => {
  it('muestra las clases del día con el profesor que la da, el estado y los asistentes', async () => {
    const fechasPedidas = agendaDel10();
    renderizarEn('/agenda?fecha=2026-03-10');

    const hipHop = await screen.findByRole('article', { name: 'Hip-Hop 19:00' });
    expect(within(hipHop).getByText('Iaru Speroni (suplente)')).toBeInTheDocument();
    expect(within(hipHop).getByText('4 asistentes')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Salsa 21:00' })).getByText('Cancelada')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Ballet 18:00' })).getByText('Erik Zapata')).toBeInTheDocument();
    expect(fechasPedidas).toEqual(['2026-03-10']);
  });

  it('"Tomar asistencia" abre la sesión de esa clase y esa fecha, y lleva a su pantalla', async () => {
    agendaDel10();
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/sesiones', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const sesion: Sesion = { id: 52, claseId: 1, fecha: '2026-03-10', estado: 'programada', profesor: ERIK, asistentes: 0 };
        return HttpResponse.json(sesion, { status: 201 });
      }),
      // La pantalla de la sesión carga sus datos al llegar.
      http.get('/api/sesiones/52', () =>
        HttpResponse.json({
          id: 52, claseId: 1, fecha: '2026-03-10', estado: 'programada', profesor: ERIK, asistentes: 0,
          estilo: 'Ballet', nivel: null, horaInicio: '18:00', horaFin: '19:00',
        }),
      ),
      http.get('/api/sesiones/52/asistencias', () => HttpResponse.json({ items: [] })),
      http.get('/api/profesores', () => HttpResponse.json({ items: [] })),
    );
    const { usuario, router } = renderizarEn('/agenda?fecha=2026-03-10');

    const ballet = await screen.findByRole('article', { name: 'Ballet 18:00' });
    await usuario.click(within(ballet).getByRole('button', { name: 'Tomar asistencia' }));

    await screen.findByRole('heading', { name: /Asistencia/ });
    expect(cuerpoRecibido).toEqual({ claseId: 1, fecha: '2026-03-10' });
    expect(router.state.location.pathname).toBe('/sesiones/52');
  });
});
