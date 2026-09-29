import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AlumnoEnListado } from '@studio/shared';
import { unAlumno, unAlumnoEnListado, unListadoDeAlumnos } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';
import { celdasDe } from '../../../test/tabla.ts';

describe('/alumnos', () => {
  it('buscar "garcia" pide la búsqueda a la API y muestra el resultado', async () => {
    conSesion(RECEPCION);
    const busquedas: (string | null)[] = [];
    servidor.use(
      http.get('/api/alumnos', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        busquedas.push(q);
        return HttpResponse.json(
          unListadoDeAlumnos(q === 'garcia' ? [unAlumnoEnListado({ nombre: 'Martina', apellido: 'García' })] : []),
        );
      }),
    );
    const { usuario } = renderizarEn('/alumnos');

    await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar alumno' }), 'garcia');

    expect(await screen.findByRole('link', { name: 'García, Martina' })).toBeInTheDocument();
    // La primera carga va sin filtro y después una sola búsqueda, no una por tecla.
    expect(busquedas).toEqual([null, 'garcia']);
  });

  it('la tabla muestra estado del pack, clases, vencimiento y última clase, "Dado de baja" para los inactivos y el total de vigentes', async () => {
    conSesion(RECEPCION);
    servidor.use(
      http.get('/api/alumnos', () =>
        HttpResponse.json(
          unListadoDeAlumnos(
            [
              unAlumnoEnListado({
                id: 11,
                nombre: 'Lucía',
                apellido: 'Fernández',
                dni: null,
                telefono: null,
                estadoPack: 'vencido',
                pagoActual: { pack: 'Pack x4', cantidadClases: 4, clasesRestantes: 2, venceEl: '2025-12-20' },
                ultimaClase: '2025-12-02',
              }),
              unAlumnoEnListado({
                id: 10,
                nombre: 'Martina',
                apellido: 'García',
                dni: '38555666',
                telefono: '11 5555-0000',
                estadoPack: 'vigente',
                pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 6, venceEl: '2026-04-01' },
                ultimaClase: '2026-03-03',
              }),
              unAlumnoEnListado({
                id: 12,
                nombre: 'Paula',
                apellido: 'Morales',
                dni: '35101202',
                telefono: '11 6060-7070',
                activo: false,
                estadoPack: 'vigente',
                pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 8, venceEl: '2026-04-05' },
              }),
              unAlumnoEnListado({ id: 13, nombre: 'Joaquín', apellido: 'Pérez', dni: null, telefono: null }),
            ],
            { vigentes: 1, hoy: '2026-03-10' },
          ),
        ),
      ),
    );
    renderizarEn('/alumnos');

    await screen.findByRole('link', { name: 'García, Martina' });
    const [, ...filas] = screen.getAllByRole('row');
    expect(filas.map(celdasDe)).toEqual([
      ['Fernández, Lucía', 'Vencido', 'Pack x4', '2 de 4', '20 dic 2025', '—', '—', '2 dic 2025'],
      ['García, Martina', 'Vigente', 'Pack x8', '6 de 8', '1 abr', '11 5555-0000', '38555666', '3 mar'],
      ['Morales, Paula', 'Dado de baja', 'Pack x8', '8 de 8', '5 abr', '11 6060-7070', '35101202', '—'],
      ['Pérez, Joaquín', 'Sin pack', '—', '—', '—', '—', '—', '—'],
    ]);
    expect(screen.getByText('4 alumnos · 1 con el pack vigente')).toBeInTheDocument();
  });

  it('abrir un alumno muestra su ficha al costado sin perder la búsqueda, y cerrarla vuelve a la lista', async () => {
    conSesion(RECEPCION);
    const martina = unAlumno({ id: 10, nombre: 'Martina', apellido: 'García', dni: '38555666' });
    servidor.use(
      http.get('/api/alumnos', () => HttpResponse.json(unListadoDeAlumnos([unAlumnoEnListado(martina)]))),
      http.get('/api/alumnos/10', () => HttpResponse.json(martina)),
      http.get('/api/pagos', () => HttpResponse.json({ items: [] })),
    );
    const { usuario, router } = renderizarEn('/alumnos');

    await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar alumno' }), 'garcia');
    await usuario.click(await screen.findByRole('link', { name: 'García, Martina' }));

    const ficha = await screen.findByRole('complementary', { name: 'Ficha de Martina García' });
    expect(within(ficha).getByText('38555666')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/alumnos/10');
    expect(screen.getByRole('searchbox', { name: 'Buscar alumno' })).toHaveValue('garcia');

    await usuario.click(within(ficha).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('complementary', { name: 'Ficha de Martina García' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/alumnos');
    expect(screen.getByRole('searchbox', { name: 'Buscar alumno' })).toHaveValue('garcia');
  });

  it('crear un alumno manda los datos y el nuevo aparece en la tabla', async () => {
    conSesion(RECEPCION);
    const alumnos: AlumnoEnListado[] = [];
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/alumnos', () => HttpResponse.json(unListadoDeAlumnos(alumnos))),
      http.post('/api/alumnos', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const creado = unAlumno({ id: 11, nombre: 'Lucía', apellido: 'Ferreyra', dni: null, telefono: null });
        alumnos.push(unAlumnoEnListado(creado));
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
      http.get('/api/alumnos', () => HttpResponse.json(unListadoDeAlumnos([]))),
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
