import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Indicadores, TableroDelMes } from '@studio/shared';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';
import { celdasDe } from '../../../../test/tabla.ts';

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };
const MALENA = { id: 3, nombre: 'Malena', apellido: 'Rosas' };

const INDICADORES_DE_FEBRERO: Indicadores = {
  ingresos: 5000,
  sueldos: 6950,
  leQuedaAlEstudio: -1950,
  asistencias: 8,
  alumnosActivos: 8,
  alumnosNuevos: 0,
  clasesPerdidas: 4,
  valorPerdido: 2000,
};

const TABLERO_DE_MARZO: TableroDelMes = {
  periodo: '2026-03',
  actual: {
    ingresos: 6700,
    sueldos: 6950,
    leQuedaAlEstudio: -250,
    asistencias: 10,
    alumnosActivos: 8,
    alumnosNuevos: 3,
    clasesPerdidas: 2,
    valorPerdido: 1000,
  },
  anterior: INDICADORES_DE_FEBRERO,
  porDia: [
    { fecha: '2026-03-01', asistencias: 4, cobrado: 0 },
    { fecha: '2026-03-02', asistencias: 2, cobrado: 6700 },
    { fecha: '2026-03-03', asistencias: 0, cobrado: 0 },
  ],
  ingresosPorMedio: [
    { medio: 'efectivo', cantidad: 1, total: 1500 },
    { medio: 'transferencia', cantidad: 1, total: 5200 },
  ],
  profesores: [
    { profesor: ERIK, asistencias: 3, asistenciasMesAnterior: 0, montoCalculado: 2050, liquidacion: null },
    {
      profesor: IARU,
      asistencias: 5,
      asistenciasMesAnterior: 4,
      montoCalculado: 4000,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    },
    {
      profesor: MALENA,
      asistencias: 2,
      asistenciasMesAnterior: 4,
      montoCalculado: 1300,
      liquidacion: { id: 71, profesorId: 3, periodo: '2026-03', monto: 1300, pagadoEn: '2026-04-02T15:00:00.000Z' },
    },
  ],
  alumnosPorEstado: { vigente: 3, por_vencer: 1, vencido: 1, sin_clases: 1, sin_pack: 2 },
};

function marzo(tablero: TableroDelMes = TABLERO_DE_MARZO) {
  conSesion(ADMIN);
  servidor.use(http.get('/api/tablero', () => HttpResponse.json(tablero)));
  return renderizarEn('/liquidaciones?periodo=2026-03');
}

function indicador(nombre: string) {
  return within(screen.getByRole('group', { name: nombre }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('/liquidaciones', () => {
  it('muestra los indicadores con su variación contra el mes anterior', async () => {
    marzo();

    await screen.findByRole('group', { name: 'Ingresos cobrados' });
    expect(indicador('Ingresos cobrados').getByText('$6.700')).toBeInTheDocument();
    expect(indicador('Ingresos cobrados').getByText('+34%')).toBeInTheDocument();
    expect(indicador('Sueldos del mes').getByText('$6.950')).toBeInTheDocument();
    expect(indicador('Sueldos del mes').getByText('0%')).toBeInTheDocument();
    expect(indicador('Asistencias').getByText('10')).toBeInTheDocument();
    expect(indicador('Asistencias').getByText('+25%')).toBeInTheDocument();
    expect(indicador('Alumnos activos').getByText('8')).toBeInTheDocument();
    expect(indicador('Alumnos activos').getByText('0%')).toBeInTheDocument();
    expect(indicador('Alumnos nuevos').getByText('3')).toBeInTheDocument();
    expect(indicador('Alumnos nuevos').getByText('—')).toBeInTheDocument();
    expect(indicador('Clases que se perdieron').getByText('2')).toBeInTheDocument();
    expect(indicador('Clases que se perdieron').getByText('-50%')).toBeInTheDocument();
    expect(indicador('Clases que se perdieron').getByText('$1.000 sin usar')).toBeInTheDocument();
  });

  it('muestra en rojo lo que le queda al estudio cuando es negativo', async () => {
    marzo();

    await screen.findByRole('group', { name: 'Le queda al estudio' });
    expect(indicador('Le queda al estudio').getByText('-$250')).toHaveClass('text-red-400');
    expect(indicador('Le queda al estudio').getByText('+87%')).toBeInTheDocument();
  });

  it('muestra los ingresos por medio en su panel con el total', async () => {
    marzo();

    const ingresos = await screen.findByRole('region', { name: 'Ingresos del mes' });
    expect(within(ingresos).getByText('$6.700')).toBeInTheDocument();
    expect(celdasDe(within(ingresos).getByRole('row', { name: /Transferencia/ }))).toEqual(['Transferencia', '1', '$5.200']);
  });

  it('ordena el ranking por asistencias y muestra variación, sueldo y estado de cada profesor', async () => {
    marzo();

    const ranking = await screen.findByRole('region', { name: 'Ranking de profesores' });
    const filas = within(ranking).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['Speroni, Iaru', '5', '+25%', '$3.600Calculado hoy: $4.000', 'Cerrada', 'Marcar pagada'],
      ['Zapata, Erik', '3', '—', '$2.050', 'Abierta', 'Cerrar'],
      ['Rosas, Malena', '2', '-50%', '$1.300', 'Pagada el 02/04/2026', ''],
    ]);
  });

  it('el nombre del profesor lleva a su ficha con el mismo período', async () => {
    marzo();

    const iaru = await screen.findByRole('link', { name: 'Speroni, Iaru' });
    expect(iaru).toHaveAttribute('href', '/liquidaciones/2?periodo=2026-03');
  });

  it('muestra la barra de alumnos por estado agrupando los vencidos y sin clases', async () => {
    marzo();

    const estado = await screen.findByRole('region', { name: 'Estado de los alumnos' });
    expect(within(estado).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Al día: 3',
      'Por vencer: 1',
      'Sin renovar: 2',
      'Sin pack: 2',
    ]);
    expect(within(estado).getByText('Sin renovar: 2', { selector: 'title' })).toBeInTheDocument();
  });

  it('dibuja la actividad diaria con un título por barra y por punto', async () => {
    marzo();

    const actividad = await screen.findByRole('region', { name: 'Actividad diaria' });
    expect(within(actividad).getByText('1 mar: 4 asistencias')).toBeInTheDocument();
    expect(within(actividad).getByText('2 mar: $6.700 cobrados')).toBeInTheDocument();
  });

  it('pide el tablero del período elegido', async () => {
    let periodoPedido: string | null = null;
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero', ({ request }) => {
        periodoPedido = new URL(request.url).searchParams.get('periodo');
        return HttpResponse.json(TABLERO_DE_MARZO);
      }),
    );
    renderizarEn('/liquidaciones?periodo=2026-03');

    await screen.findByRole('group', { name: 'Asistencias' });
    expect(periodoPedido).toBe('2026-03');
  });

  it('marca "mes en curso" cuando el período es el mes de hoy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-15T15:00:00Z'));
    marzo();

    await screen.findByRole('group', { name: 'Asistencias' });
    expect(screen.getByText('mes en curso')).toBeInTheDocument();
  });

  it('no marca "mes en curso" en un mes cerrado', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-15T15:00:00Z'));
    marzo();

    await screen.findByRole('group', { name: 'Asistencias' });
    expect(screen.queryByText('mes en curso')).not.toBeInTheDocument();
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
