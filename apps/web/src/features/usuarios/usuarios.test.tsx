import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

describe('/usuarios', () => {
  it('crear un usuario manda el rol elegido', async () => {
    conSesion(ADMIN);
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/usuarios', () => HttpResponse.json({ items: [ADMIN] })),
      http.post('/api/usuarios', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(
          { id: 3, nombre: 'Tomás Turno Tarde', email: 'tomas@estudio.test', rol: 'recepcion', activo: true },
          { status: 201 },
        );
      }),
    );
    const { usuario } = renderizarEn('/usuarios');

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo usuario' });
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Tomás Turno Tarde');
    await usuario.type(within(dialogo).getByLabelText('Email'), 'tomas@estudio.test');
    await usuario.type(within(dialogo).getByLabelText('Contraseña'), 'clave-de-tomas-1');
    await usuario.selectOptions(within(dialogo).getByLabelText('Rol'), 'Recepción');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(cuerpoRecibido).toEqual({
        nombre: 'Tomás Turno Tarde',
        email: 'tomas@estudio.test',
        password: 'clave-de-tomas-1',
        rol: 'recepcion',
      }),
    );
  });

  it('no ofrece desactivar al propio usuario logueado', async () => {
    conSesion(ADMIN);
    const recepcion = { id: 2, nombre: 'Rita Recepción', email: 'rita@estudio.test', rol: 'recepcion', activo: true };
    servidor.use(http.get('/api/usuarios', () => HttpResponse.json({ items: [ADMIN, recepcion] })));
    renderizarEn('/usuarios');

    const filaPropia = await screen.findByRole('row', { name: /Ana Admin/ });
    const filaDeRita = screen.getByRole('row', { name: /Rita Recepción/ });
    expect(within(filaPropia).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(within(filaDeRita).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });
});
