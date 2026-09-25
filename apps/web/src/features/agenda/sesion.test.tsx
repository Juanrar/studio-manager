import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { SIN_CLASES_DISPONIBLES, type Asistencia, type SesionDetalle } from '@studio/shared';
import { unAlumno, unaAsistencia, unListado, unPack, unProfesor } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const HIP_HOP_DEL_10: SesionDetalle = {
  id: 50,
  claseId: 2,
  fecha: '2026-03-10',
  estado: 'programada',
  profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
  asistentes: 0,
  estilo: 'Hip-Hop',
  nivel: 'Inicial',
  horaInicio: '19:00',
  horaFin: '20:30',
};

// La sesión de Hip-Hop del martes 10, con la lista de asistencias que el test va cambiando.
function sesionDeHipHop(asistencias: Asistencia[]) {
  conSesion(RECEPCION);
  servidor.use(
    http.get('/api/sesiones/50', () => HttpResponse.json(HIP_HOP_DEL_10)),
    http.get('/api/sesiones/50/asistencias', () => HttpResponse.json({ items: asistencias })),
    http.get('/api/profesores', () =>
      HttpResponse.json({
        items: [unProfesor({ id: 1, nombre: 'Erik', apellido: 'Zapata' }), unProfesor({ id: 2, nombre: 'Iaru', apellido: 'Speroni' })],
      }),
    ),
    http.get('/api/alumnos', () => HttpResponse.json(unListado([unAlumno({ id: 10, nombre: 'Martina', apellido: 'García' })]))),
    http.get('/api/packs', () =>
      HttpResponse.json({
        items: [
          unPack({ id: 1, nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 }),
          unPack({ id: 3, nombre: 'Pack x8', cantidadClases: 8, precio: 9600 }),
        ],
      }),
    ),
  );
  return renderizarEn('/sesiones/50');
}

async function buscarYElegirAMartina(usuario: ReturnType<typeof renderizarEn>['usuario']) {
  await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar alumno para anotar' }), 'mart');
  await usuario.click(await screen.findByRole('button', { name: 'García, Martina' }));
}

describe('/sesiones/:id', () => {
  it('anotar a un alumno buscado manda su id y lo muestra entre los asistentes', async () => {
    const asistencias: Asistencia[] = [];
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/sesiones/50/asistencias', async ({ request }) => {
        cuerpoRecibido = await request.json();
        asistencias.push(unaAsistencia({ id: 901, pack: 'Pack x8' }));
        return HttpResponse.json(asistencias[0], { status: 201 });
      }),
    );
    const { usuario } = sesionDeHipHop(asistencias);

    await buscarYElegirAMartina(usuario);

    const fila = await screen.findByRole('row', { name: /García, Martina/ });
    expect(within(fila).getByText('Pack x8')).toBeInTheDocument();
    expect(cuerpoRecibido).toEqual({ alumnoId: 10 });
  });

  it('sin clases disponibles ofrece cobrar, y "Cobrar y anotar" manda el pack y el medio', async () => {
    const cuerpos: unknown[] = [];
    servidor.use(
      http.post('/api/sesiones/50/asistencias', async ({ request }) => {
        const cuerpo = (await request.json()) as { cobrar?: unknown };
        cuerpos.push(cuerpo);
        if (cuerpo.cobrar === undefined) {
          return HttpResponse.json(
            { error: 'Martina García no tiene clases disponibles para el 2026-03-10', codigo: SIN_CLASES_DISPONIBLES },
            { status: 422 },
          );
        }
        return HttpResponse.json(unaAsistencia({ pack: 'Clase suelta' }), { status: 201 });
      }),
    );
    const { usuario } = sesionDeHipHop([]);

    await buscarYElegirAMartina(usuario);
    const cobro = await screen.findByRole('form', { name: 'Cobrar y anotar' });
    expect(within(cobro).getByText('Martina García no tiene clases disponibles para el 2026-03-10')).toBeInTheDocument();
    await usuario.selectOptions(within(cobro).getByLabelText('Medio de pago'), 'Mercado Pago');
    await usuario.click(within(cobro).getByRole('button', { name: 'Cobrar y anotar' }));

    await waitFor(() =>
      expect(cuerpos).toEqual([{ alumnoId: 10 }, { alumnoId: 10, cobrar: { packId: 1, medio: 'mercado_pago' } }]),
    );
  });

  it('quitar una asistencia llama a la API y la saca de la lista', async () => {
    const asistencias = [unaAsistencia({ id: 900 })];
    let borrada: string | undefined;
    servidor.use(
      http.delete('/api/asistencias/:id', ({ params }) => {
        borrada = String(params.id);
        asistencias.pop();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { usuario } = sesionDeHipHop(asistencias);

    const fila = await screen.findByRole('row', { name: /García, Martina/ });
    await usuario.click(within(fila).getByRole('button', { name: 'Quitar' }));

    expect(await screen.findByText('Todavía no hay asistentes.')).toBeInTheDocument();
    expect(borrada).toBe('900');
  });

  it('una suplencia manda el profesor nuevo', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.patch('/api/sesiones/50', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json({ ...HIP_HOP_DEL_10, profesor: { id: 2, nombre: 'Iaru', apellido: 'Speroni' } });
      }),
    );
    const { usuario } = sesionDeHipHop([]);

    await screen.findByRole('option', { name: 'Iaru Speroni' });
    await usuario.selectOptions(screen.getByLabelText('Profesor que da la clase'), 'Iaru Speroni');
    await usuario.click(screen.getByRole('button', { name: 'Registrar suplencia' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ profesorId: 2 }));
  });
});
