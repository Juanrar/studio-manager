import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN, conAgendaVacia, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('menú lateral: solapa del asistente', () => {
  // Sin GEMINI_API_KEY la API responde disponible: false. Esa solapa no tiene que aparecer en el menú.
  it('no muestra Asistente cuando la API no tiene modelo configurado', async () => {
    conSesion(ADMIN);
    conAgendaVacia();
    servidor.use(http.get('/api/asistente/disponible', () => HttpResponse.json({ disponible: false })));
    renderizarEn('/agenda');

    await screen.findByRole('link', { name: 'Agenda' });
    expect(screen.queryByRole('link', { name: 'Asistente' })).not.toBeInTheDocument();
  });

  it('muestra Asistente cuando la API tiene modelo configurado', async () => {
    conSesion(ADMIN);
    conAgendaVacia();
    renderizarEn('/agenda');

    expect(await screen.findByRole('link', { name: 'Asistente' })).toBeInTheDocument();
  });
});
