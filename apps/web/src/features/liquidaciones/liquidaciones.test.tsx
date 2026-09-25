import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { IngresosDelPeriodo, ResumenDelPeriodo } from '@studio/shared';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };
const MALENA = { id: 3, nombre: 'Malena', apellido: 'Rosas' };

// Marzo: Erik abierto, Iaru cerrado con un monto guardado distinto del calculado, Malena pagada.
const RESUMEN_DE_MARZO: ResumenDelPeriodo = {
  periodo: '2026-03',
  items: [
    { profesor: ERIK, asistencias: 3, montoCalculado: 2050, liquidacion: null },
    {
      profesor: IARU,
      asistencias: 5,
      montoCalculado: 4000,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    },
    {
      profesor: MALENA,
      asistencias: 2,
      montoCalculado: 1300,
      liquidacion: { id: 71, profesorId: 3, periodo: '2026-03', monto: 1300, pagadoEn: '2026-04-02T15:00:00.000Z' },
    },
  ],
};

const INGRESOS_DE_MARZO: IngresosDelPeriodo = {
  periodo: '2026-03',
  total: 6700,
  porMedio: [
    { medio: 'efectivo', cantidad: 1, total: 1500 },
    { medio: 'transferencia', cantidad: 1, total: 5200 },
  ],
};

function marzo() {
  conSesion(ADMIN);
  servidor.use(
    http.get('/api/liquidaciones', () => HttpResponse.json(RESUMEN_DE_MARZO)),
    http.get('/api/pagos/ingresos', () => HttpResponse.json(INGRESOS_DE_MARZO)),
  );
  return renderizarEn('/liquidaciones?periodo=2026-03');
}

describe('/liquidaciones', () => {
  it('muestra los ingresos por medio y el sueldo de cada profesor con su estado', async () => {
    marzo();

    const ingresos = await screen.findByRole('region', { name: 'Ingresos del mes' });
    expect(await within(ingresos).findByText('$6.700')).toBeInTheDocument();
    expect(within(within(ingresos).getByRole('row', { name: /Transferencia/ })).getByText('$5.200')).toBeInTheDocument();

    const erik = await screen.findByRole('row', { name: /Zapata/ });
    expect(within(erik).getByText('$2.050')).toBeInTheDocument();
    expect(within(erik).getByText('Abierta')).toBeInTheDocument();
    const iaru = screen.getByRole('row', { name: /Speroni/ });
    expect(within(iaru).getByText('$3.600')).toBeInTheDocument();
    expect(within(iaru).getByText('Calculado hoy: $4.000')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Rosas/ })).getByText('Pagada el 02/04/2026')).toBeInTheDocument();
  });

  it('"Cerrar" manda el profesor y el período elegido', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/liquidaciones', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json({ id: 72, profesorId: 1, periodo: '2026-03', monto: 2050, pagadoEn: null }, { status: 201 });
      }),
    );
    const { usuario } = marzo();

    const erik = await screen.findByRole('row', { name: /Zapata/ });
    await usuario.click(within(erik).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ profesorId: 1, periodo: '2026-03' }));
  });

  it('"Marcar pagada" llama a la API de esa liquidación', async () => {
    let liquidacionPagada: string | undefined;
    servidor.use(
      http.post('/api/liquidaciones/:id/pagar', ({ params }) => {
        liquidacionPagada = String(params.id);
        return HttpResponse.json({ id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: '2026-04-05T15:00:00.000Z' });
      }),
    );
    const { usuario } = marzo();

    const iaru = await screen.findByRole('row', { name: /Speroni/ });
    await usuario.click(within(iaru).getByRole('button', { name: 'Marcar pagada' }));

    await waitFor(() => expect(liquidacionPagada).toBe('70'));
  });
});
