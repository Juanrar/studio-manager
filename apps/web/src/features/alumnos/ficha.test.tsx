import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { EventoDeAlumno, FichaDeAlumno, Pago } from '@studio/shared';
import { unAlumnoEnListado, unaFichaDeAlumno, unListadoDeAlumnos, unPack, unPago } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';
import { celdasDe } from '../../../test/tabla.ts';

type Respuestas = { ficha?: Partial<FichaDeAlumno>; pagos?: Pago[]; actividad?: EventoDeAlumno[] };

// Abre la ficha de Martina encima de la lista, que también se carga. Los handlers leen `respuestas`
// en cada pedido: un test las cambia para simular lo que devuelve la API después de una acción.
function fichaDeMartina(respuestas: Respuestas = {}) {
  conSesion(RECEPCION);
  const martina = () => unaFichaDeAlumno({ id: 10, nombre: 'Martina', apellido: 'García', ...respuestas.ficha });
  servidor.use(
    http.get('/api/alumnos', () => {
      const { estadoPack, pagoActual } = martina();
      return HttpResponse.json(
        unListadoDeAlumnos([unAlumnoEnListado({ id: 10, nombre: 'Martina', apellido: 'García', estadoPack, pagoActual })]),
      );
    }),
    http.get('/api/alumnos/10', () => HttpResponse.json(martina())),
    http.get('/api/alumnos/10/actividad', () => HttpResponse.json({ items: respuestas.actividad ?? [] })),
    http.get('/api/pagos', () => HttpResponse.json({ items: respuestas.pagos ?? [] })),
    http.get('/api/packs', () =>
      HttpResponse.json({
        items: [
          unPack({ id: 1, nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 }),
          unPack({ id: 3, nombre: 'Pack x8', cantidadClases: 8, precio: 9600 }),
        ],
      }),
    ),
  );
  return renderizarEn('/alumnos/10');
}

async function laFicha() {
  return screen.findByRole('complementary', { name: 'Ficha de Martina García' });
}

// Cada mes de la actividad con sus hechos, como se leen en pantalla: [mes, [texto, día], ...].
async function mesesDe(actividad: HTMLElement) {
  const meses = await within(actividad).findAllByRole('region');
  return meses.map((mes) => [
    within(mes).getByRole('heading').textContent,
    ...within(mes)
      .getAllByRole('listitem')
      .map((hecho) => [hecho.querySelector('p')?.textContent, hecho.querySelector('time')?.textContent]),
  ]);
}

// Cada dato como [etiqueta, valor].
function camposDe(panel: HTMLElement) {
  const valores = within(panel).getAllByRole('definition');
  return within(panel)
    .getAllByRole('term')
    .map((etiqueta, indice) => [etiqueta.textContent, valores[indice]?.textContent]);
}

describe('/alumnos/:id', () => {
  it('la actividad agrupa los hechos por mes, con el año, del más nuevo al más viejo, y las clases futuras van como anotadas', async () => {
    fichaDeMartina({
      actividad: [
        {
          tipo: 'anotado',
          fecha: '2026-03-17',
          clase: 'Hip-Hop',
          profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
        },
        {
          tipo: 'asistencia',
          fecha: '2026-03-10',
          clase: 'Hip-Hop',
          profesor: { id: 2, nombre: 'Julia', apellido: 'Paz' },
        },
        { tipo: 'pago', fecha: '2026-03-02', pack: 'Pack x8', monto: 9600, medio: 'mercado_pago', anulado: false },
        { tipo: 'pago', fecha: '2026-02-20', pack: 'Pack x4', monto: 5200, medio: 'efectivo', anulado: true },
        {
          tipo: 'asistencia',
          fecha: '2025-03-17',
          clase: 'Jazz',
          profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
        },
        { tipo: 'alta', fecha: '2025-03-10' },
      ],
    });

    const actividad = within(await laFicha()).getByRole('tabpanel', { name: 'Actividad' });

    expect(await mesesDe(actividad)).toEqual([
      [
        'Marzo 2026',
        ['Anotado en Hip-Hop con Erik Zapata', '17 mar'],
        ['Asistió a Hip-Hop con Julia Paz', '10 mar'],
        ['Pagó Pack x8 · $9.600 con Mercado Pago', '2 mar'],
      ],
      ['Febrero 2026', ['Pagó Pack x4 · $5.200 en efectivo Anulado', '20 feb']],
      ['Marzo 2025', ['Asistió a Jazz con Erik Zapata', '17 mar'], ['Alta en el estudio', '10 mar']],
    ]);
  });

  it('la actividad distingue la baja automática de la baja a mano, y muestra la reactivación', async () => {
    fichaDeMartina({
      ficha: { activo: false },
      actividad: [
        { tipo: 'baja', fecha: '2026-03-10', automatica: true },
        { tipo: 'reactivacion', fecha: '2026-01-08' },
        { tipo: 'baja', fecha: '2026-01-05', automatica: false },
        { tipo: 'alta', fecha: '2025-12-01' },
      ],
    });

    const actividad = within(await laFicha()).getByRole('tabpanel', { name: 'Actividad' });

    expect(await mesesDe(actividad)).toEqual([
      ['Marzo 2026', ['Baja automática: 2 meses sin comprar un pack', '10 mar']],
      ['Enero 2026', ['Reactivación en el estudio', '8 ene'], ['Baja en el estudio', '5 ene']],
      ['Diciembre 2025', ['Alta en el estudio', '1 dic']],
    ]);
  });

  it('no hay botón para dar de baja ni reactivar, y a un alumno dado de baja se le puede registrar un pago', async () => {
    const { usuario } = fichaDeMartina({ ficha: { activo: false } });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Datos' }));

    expect(within(ficha).queryByRole('button', { name: /dar de baja|reactivar/i })).toBeNull();
    expect(within(ficha).getByRole('button', { name: 'Registrar pago' })).toBeTruthy();
  });

  it('la pestaña Datos muestra los datos, el pack que está usando y "Vacío" en lo que falta', async () => {
    const { usuario } = fichaDeMartina({
      ficha: {
        dni: '38555666',
        telefono: '11 5555-0000',
        email: null,
        fechaNacimiento: '1998-05-04',
        contactoEmergencia: null,
        notas: 'Rodilla operada',
        alta: '2025-03-10',
        estadoPack: 'vigente',
        pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 6, venceEl: '2026-04-01' },
      },
    });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Datos' }));

    expect(camposDe(within(ficha).getByRole('tabpanel', { name: 'Datos' }))).toEqual([
      ['DNI', '38555666'],
      ['Teléfono', '11 5555-0000'],
      ['Email', 'Vacío'],
      ['Fecha de nacimiento', '04/05/1998'],
      ['Contacto de emergencia', 'Vacío'],
      ['Notas', 'Rodilla operada'],
      ['Alta', '10/03/2025'],
      ['Pack actual', 'Pack x8'],
      ['Clases restantes', '6 de 8'],
      ['Vence', '01/04/2026'],
    ]);
  });

  it('registrar un pago manda pack y medio, y actualiza la ficha y la lista', async () => {
    const respuestas: Respuestas = {};
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const pago = unPago({ id: 104, pack: { id: 3, nombre: 'Pack x8' }, clasesUsadas: 0, clasesRestantes: 8 });
        respuestas.pagos = [pago];
        respuestas.ficha = {
          estadoPack: 'vigente',
          pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 8, venceEl: '2026-04-10' },
        };
        return HttpResponse.json(pago, { status: 201 });
      }),
    );
    const { usuario } = fichaDeMartina(respuestas);
    const ficha = await laFicha();
    expect(await within(ficha).findByText('Sin pack')).toBeInTheDocument();

    await usuario.click(within(ficha).getByRole('button', { name: 'Registrar pago' }));
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago' });
    await usuario.selectOptions(await within(dialogo).findByLabelText('Pack'), 'Pack x8 · $9.600 · 8 clases');
    await usuario.selectOptions(within(dialogo).getByLabelText('Medio de pago'), 'Transferencia');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar' }));

    expect(await within(ficha).findByText('Vigente')).toBeInTheDocument();
    expect(within(ficha).getByText('Pack x8')).toBeInTheDocument();
    await waitFor(() => expect(celdasDe(screen.getByRole('row', { name: /García, Martina/ }))[1]).toBe('Vigente'));
    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));
    expect(await within(ficha).findByRole('row', { name: /Pack x8/ })).toBeInTheDocument();
    expect(cuerpoRecibido).toEqual({ alumnoId: 10, packId: 3, medio: 'transferencia' });
  });

  it('la pestaña Pagos muestra cada pago con su estado, sus clases y el monto en pesos', async () => {
    const { usuario } = fichaDeMartina({
      pagos: [
        unPago({ id: 101, pack: { id: 3, nombre: 'Pack x8' }, cantidadClases: 8, clasesRestantes: 5, monto: 9600 }),
        unPago({
          id: 102,
          pack: { id: 1, nombre: 'Clase suelta' },
          cantidadClases: 1,
          clasesUsadas: 1,
          clasesRestantes: 0,
          monto: 1500,
          vencido: true,
        }),
        unPago({
          id: 103,
          pack: { id: 2, nombre: 'Pack x4' },
          cantidadClases: 4,
          clasesRestantes: 4,
          monto: 5200,
          anulado: true,
          motivoAnulacion: 'Se cargó dos veces',
        }),
      ],
    });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));

    const packX8 = await within(ficha).findByRole('row', { name: /Pack x8/ });
    expect(within(packX8).getByText('5 de 8')).toBeInTheDocument();
    expect(within(packX8).getByText('$9.600')).toBeInTheDocument();
    expect(within(packX8).getByText('Vigente')).toBeInTheDocument();
    expect(within(within(ficha).getByRole('row', { name: /Clase suelta/ })).getByText('Vencido')).toBeInTheDocument();
    expect(within(within(ficha).getByRole('row', { name: /Pack x4/ })).getByText('Anulado')).toBeInTheDocument();
  });

  it('anular un pago manda el motivo', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos/101/anular', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(unPago({ id: 101, anulado: true }));
      }),
    );
    const { usuario } = fichaDeMartina({ pagos: [unPago({ id: 101, pack: { id: 3, nombre: 'Pack x8' } })] });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));
    const fila = await within(ficha).findByRole('row', { name: /Pack x8/ });
    await usuario.click(within(fila).getByRole('button', { name: 'Anular' }));
    const dialogo = screen.getByRole('dialog', { name: 'Anular pago' });
    await usuario.type(within(dialogo).getByLabelText('Motivo'), 'Se cargó dos veces');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anular pago' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ motivo: 'Se cargó dos veces' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
