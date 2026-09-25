import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Pago } from '@studio/shared';
import { unAlumno, unPack, unPago } from '../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

function fichaDeMartina(pagos: Pago[]) {
  conSesion(RECEPCION);
  servidor.use(
    http.get('/api/alumnos/10', () => HttpResponse.json(unAlumno({ id: 10, nombre: 'Martina', apellido: 'García' }))),
    http.get('/api/pagos', () => HttpResponse.json({ items: pagos })),
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

describe('/alumnos/:id', () => {
  it('muestra cada pago con su estado, sus clases y el monto en pesos', async () => {
    fichaDeMartina([
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
    ]);

    const packX8 = await screen.findByRole('row', { name: /Pack x8/ });
    expect(within(packX8).getByText('5 de 8')).toBeInTheDocument();
    expect(within(packX8).getByText('$9.600')).toBeInTheDocument();
    expect(within(packX8).getByText('Vigente')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Clase suelta/ })).getByText('Vencido')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Pack x4/ })).getByText('Anulado')).toBeInTheDocument();
  });

  it('registrar un pago manda pack y medio, y lo muestra en la lista', async () => {
    const pagos: Pago[] = [];
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos', async ({ request }) => {
        cuerpoRecibido = await request.json();
        pagos.push(unPago({ id: 104, pack: { id: 3, nombre: 'Pack x8' }, clasesRestantes: 8, clasesUsadas: 0 }));
        return HttpResponse.json(pagos[0], { status: 201 });
      }),
    );
    const { usuario } = fichaDeMartina(pagos);

    await usuario.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago' });
    await usuario.selectOptions(await within(dialogo).findByLabelText('Pack'), 'Pack x8 · $9.600 · 8 clases');
    await usuario.selectOptions(within(dialogo).getByLabelText('Medio de pago'), 'Transferencia');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByRole('row', { name: /Pack x8/ })).toBeInTheDocument();
    expect(cuerpoRecibido).toEqual({ alumnoId: 10, packId: 3, medio: 'transferencia' });
  });

  it('anular un pago manda el motivo', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos/101/anular', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(unPago({ id: 101, anulado: true }));
      }),
    );
    const { usuario } = fichaDeMartina([unPago({ id: 101, pack: { id: 3, nombre: 'Pack x8' } })]);

    const fila = await screen.findByRole('row', { name: /Pack x8/ });
    await usuario.click(within(fila).getByRole('button', { name: 'Anular' }));
    const dialogo = screen.getByRole('dialog', { name: 'Anular pago' });
    await usuario.type(within(dialogo).getByLabelText('Motivo'), 'Se cargó dos veces');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anular pago' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ motivo: 'Se cargó dos veces' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
