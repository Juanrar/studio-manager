import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Alumno } from '@studio/shared';
import { unAlumno, unListado } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

describe('/alumnos', () => {
  it('buscar "garcia" pide la búsqueda a la API y muestra el resultado', async () => {
    conSesion(RECEPCION);
    const busquedas: (string | null)[] = [];
    servidor.use(
      http.get('/api/alumnos', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        busquedas.push(q);
        return HttpResponse.json(
          unListado(q === 'garcia' ? [unAlumno({ nombre: 'Martina', apellido: 'García' })] : []),
        );
      }),
    );
    const { usuario } = renderizarEn('/alumnos');

    await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar alumno' }), 'garcia');

    expect(await screen.findByRole('link', { name: 'García, Martina' })).toBeInTheDocument();
    // La primera carga va sin filtro y después una sola búsqueda, no una por tecla.
    expect(busquedas).toEqual([null, 'garcia']);
  });

  it('crear un alumno manda los datos y el nuevo aparece en la tabla', async () => {
    conSesion(RECEPCION);
    const alumnos: Alumno[] = [];
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/alumnos', () => HttpResponse.json(unListado(alumnos))),
      http.post('/api/alumnos', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const creado = unAlumno({ id: 11, nombre: 'Lucía', apellido: 'Ferreyra', dni: null, telefono: null });
        alumnos.push(creado);
        return HttpResponse.json(creado, { status: 201 });
      }),
    );
    const { usuario } = renderizarEn('/alumnos');

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo alumno' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo alumno' });
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Lucía');
    await usuario.type(within(dialogo).getByLabelText('Apellido'), 'Ferreyra');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('link', { name: 'Ferreyra, Lucía' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cuerpoRecibido).toMatchObject({ nombre: 'Lucía', apellido: 'Ferreyra' });
  });

  it('un DNI repetido muestra el mensaje de la API y deja el formulario abierto', async () => {
    conSesion(RECEPCION);
    servidor.use(
      http.get('/api/alumnos', () => HttpResponse.json(unListado([]))),
      http.post('/api/alumnos', () =>
        HttpResponse.json({ error: 'Ya existe un alumno con ese DNI' }, { status: 422 }),
      ),
    );
    const { usuario } = renderizarEn('/alumnos');

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo alumno' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo alumno' });
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Lucía');
    await usuario.type(within(dialogo).getByLabelText('Apellido'), 'Ferreyra');
    await usuario.type(within(dialogo).getByLabelText('DNI'), '40111222');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Ya existe un alumno con ese DNI');
    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Lucía');
  });
});
