import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ProfesorEnListado } from '@studio/shared';
import { unProfesor, unProfesorEnListado } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';
import { celdasDe } from '../../../test/tabla.ts';

function profesoresDelEstudio(profesores: ProfesorEnListado[]) {
  conSesion(ADMIN);
  servidor.use(http.get('/api/profesores', () => HttpResponse.json({ items: profesores })));
  return renderizarEn('/profesores');
}

describe('/profesores', () => {
  it('crear un profesor con "52,5" manda 5250 puntos básicos', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/profesores', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(unProfesor({ id: 7, nombre: 'Malena', apellido: 'Rosas', porcentajeVigenteBp: 5250 }), {
          status: 201,
        });
      }),
    );
    const { usuario } = profesoresDelEstudio([]);

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo profesor' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo profesor' });
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Malena');
    await usuario.type(within(dialogo).getByLabelText('Apellido'), 'Rosas');
    await usuario.type(within(dialogo).getByLabelText('Porcentaje por alumno (%)'), '52,5');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(cuerpoRecibido).toMatchObject({ nombre: 'Malena', apellido: 'Rosas', porcentajeBp: 5250 }));
  });

  it('muestra cada profesor con su porcentaje, clases por semana, días, teléfono, alias y estado', async () => {
    profesoresDelEstudio([
      unProfesorEnListado({
        id: 1,
        nombre: 'Erik',
        apellido: 'Zapata',
        telefono: '11 4444-0000',
        aliasCbu: 'erik.zapata',
        porcentajeVigenteBp: 5000,
        clasesPorSemana: 4,
        diasConClase: [1, 3, 5],
      }),
      unProfesorEnListado({ id: 2, nombre: 'Lucía', apellido: 'Núñez', porcentajeVigenteBp: null, activo: false }),
    ]);

    const fila = await screen.findByRole('row', { name: /Zapata/ });
    expect(celdasDe(fila)).toEqual(['Zapata, Erik', '50%', '4', 'Lun, Mié, Vie', '11 4444-0000', 'erik.zapata', 'Activo']);
    expect(celdasDe(screen.getByRole('row', { name: /Núñez/ }))).toEqual([
      'Núñez, Lucía',
      '—',
      '—',
      '—',
      '—',
      '—',
      'Dado de baja',
    ]);
    expect(screen.getByText('2 profesores · 1 activos')).toBeInTheDocument();
  });

  it('el nombre del profesor es un enlace a su ficha', async () => {
    profesoresDelEstudio([unProfesorEnListado({ id: 7, nombre: 'Erik', apellido: 'Zapata' })]);

    const enlace = await screen.findByRole('link', { name: /Zapata, Erik/ });

    expect(enlace).toHaveAttribute('href', '/profesores/7');
  });

  it('el buscador filtra por apellido, por DNI y sin distinguir mayúsculas ni tildes', async () => {
    const { usuario } = profesoresDelEstudio([
      unProfesorEnListado({ id: 1, nombre: 'Erik', apellido: 'Zapata', dni: '30111222' }),
      unProfesorEnListado({ id: 2, nombre: 'Lucía', apellido: 'Núñez', dni: '27333444' }),
    ]);
    const buscador = await screen.findByRole('searchbox', { name: 'Buscar profesor' });

    await usuario.type(buscador, 'NUNEZ');
    expect(screen.queryByRole('row', { name: /Zapata/ })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Núñez/ })).toBeInTheDocument();
    expect(screen.getByText('1 profesores · 1 activos')).toBeInTheDocument();

    await usuario.clear(buscador);
    await usuario.type(buscador, '3011');
    expect(screen.getByRole('row', { name: /Zapata/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Núñez/ })).not.toBeInTheDocument();
  });
});
