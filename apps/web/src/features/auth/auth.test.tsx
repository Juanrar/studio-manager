import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { UsuarioPublico } from '@studio/shared';
import { ADMIN, RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

// Simula la sesión del servidor: el login la abre y el logout la cierra.
function sesionDelServidor(usuarioAlLoguear: UsuarioPublico, logueadoAlEmpezar = false) {
  let logueado = logueadoAlEmpezar;
  const registro = { logoutLlamado: false };
  servidor.use(
    http.get('/api/auth/yo', () =>
      logueado
        ? HttpResponse.json(usuarioAlLoguear)
        : HttpResponse.json({ error: 'Tenés que iniciar sesión' }, { status: 401 }),
    ),
    http.post('/api/auth/login', () => {
      logueado = true;
      return HttpResponse.json(usuarioAlLoguear);
    }),
    http.post('/api/auth/logout', () => {
      logueado = false;
      registro.logoutLlamado = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return registro;
}

describe('login', () => {
  it('con credenciales correctas lleva a la agenda y muestra el nombre del usuario', async () => {
    sesionDelServidor(ADMIN);
    const { router, usuario } = renderizarEn('/login');

    await usuario.type(await screen.findByLabelText('Email'), 'ana@estudio.test');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-de-ana-1');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/agenda');
  });

  it('con credenciales incorrectas muestra el mensaje de la API', async () => {
    conSesion(null);
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 }),
      ),
    );
    const { usuario } = renderizarEn('/login');

    await usuario.type(await screen.findByLabelText('Email'), 'ana@estudio.test');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-equivocada');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });
});

describe('sesión', () => {
  it('sin sesión, una ruta protegida redirige al login', async () => {
    conSesion(null);
    const { router } = renderizarEn('/alumnos');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it.each([
    ['recepción no ve el menú de administración', RECEPCION, false],
    ['admin ve el menú de administración', ADMIN, true],
  ])('%s', async (_caso, usuarioLogueado, veAdministracion) => {
    conSesion(usuarioLogueado);
    renderizarEn('/agenda');

    expect(await screen.findByRole('link', { name: 'Alumnos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Liquidaciones' }) !== null).toBe(veAdministracion);
  });

  it('cerrar sesión avisa a la API y vuelve al login', async () => {
    const registro = sesionDelServidor(RECEPCION, true);
    const { usuario, router } = renderizarEn('/agenda');

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(registro.logoutLlamado).toBe(true);
  });
});
