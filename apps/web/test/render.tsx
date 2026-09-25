import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { UsuarioPublico } from '@studio/shared';
import { crearClienteQuery } from '../src/lib/query.ts';
import { rutas } from '../src/rutas.tsx';
import { servidor } from './servidor.ts';

export const ADMIN: UsuarioPublico = {
  id: 1,
  nombre: 'Ana Admin',
  email: 'ana@estudio.test',
  rol: 'admin',
  activo: true,
};

export const RECEPCION: UsuarioPublico = {
  id: 2,
  nombre: 'Rita Recepción',
  email: 'rita@estudio.test',
  rol: 'recepcion',
  activo: true,
};

// Responde `GET /api/auth/yo` con ese usuario, o con 401 si es null.
export function conSesion(usuario: UsuarioPublico | null) {
  servidor.use(
    http.get('/api/auth/yo', () =>
      usuario === null
        ? HttpResponse.json({ error: 'Tenés que iniciar sesión' }, { status: 401 })
        : HttpResponse.json(usuario),
    ),
  );
}

// Renderiza la app completa en una ruta, con el mismo árbol de rutas que producción.
export function renderizarEn(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  render(
    <QueryClientProvider client={crearClienteQuery({ reintentos: false })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, usuario: userEvent.setup() };
}

// Para tests que pasan por /agenda sin que la agenda sea lo que prueban.
export function conAgendaVacia(fecha = '2026-03-10') {
  servidor.use(http.get('/api/sesiones/dia', () => HttpResponse.json({ fecha, items: [] })));
}
