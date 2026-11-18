import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    {
      profesor: IARU,
      asistencias: 5,
      asistenciasMesAnterior: 4,
      montoCalculado: 4000,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    },
    { profesor: ERIK, asistencias: 3, asistenciasMesAnterior: 0, montoCalculado: 2050, liquidacion: null },
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

  it('muestra el ranking en el orden que manda la API, sin estado, botones ni enlaces', async () => {
    marzo();

    const ranking = await screen.findByRole('region', { name: 'Ranking de profesores' });
    expect(within(ranking).getAllByRole('columnheader').map((columna) => columna.textContent)).toEqual([
      'Profesor',
      'Asistencias',
      'Contra el mes anterior',
      'Sueldo',
    ]);
    const filas = within(ranking).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['Speroni, Iaru', '5', '+25%', '$3.600Calculado hoy: $4.000'],
      ['Zapata, Erik', '3', '—', '$2.050'],
      ['Rosas, Malena', '2', '-50%', '$1.300'],
    ]);
    expect(within(ranking).queryByRole('button')).not.toBeInTheDocument();
    expect(within(ranking).queryByRole('link')).not.toBeInTheDocument();
  });

  it('muestra el estado de los alumnos con el total y cuatro números, juntando vencidos y sin clases', async () => {
    marzo();

    const estado = await screen.findByRole('region', { name: 'Alumnos activos hoy: 8' });
    expect(within(estado).getAllByRole('group').map((recuadro) => recuadro.textContent)).toEqual([
      'Al día3',
      'Por vencer1',
      'Sin renovar2',
      'Sin pack2',
    ]);
  });

  it('dibuja la actividad diaria con las asistencias y lo cobrado en el nombre de cada barra', async () => {
    marzo();

    const actividad = await screen.findByRole('region', { name: 'Actividad diaria' });
    expect(within(actividad).getByLabelText('1 mar: 4 asistencias, $0 cobrados')).toBeInTheDocument();
    expect(within(actividad).getByLabelText('2 mar: 2 asistencias, $6.700 cobrados')).toBeInTheDocument();
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

  it('dibuja las tres solapas con Resumen elegida', async () => {
    marzo();

    const solapas = await screen.findAllByRole('tab');
    expect(solapas.map((solapa) => solapa.textContent)).toEqual(['Resumen', 'Liquidar', 'Estadísticas']);
    expect(solapas.map((solapa) => solapa.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('cambiar de solapa escribe solapa en la dirección y conserva período y profesor', async () => {
    conSesion(ADMIN);
    servidor.use(http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)));
    const { router, usuario } = renderizarEn('/liquidaciones?periodo=2026-03&profesor=2');

    await usuario.click(await screen.findByRole('tab', { name: 'Estadísticas' }));

    expect(router.state.location.search).toBe('?periodo=2026-03&profesor=2&solapa=estadisticas');
    expect(screen.getByRole('tab', { name: 'Estadísticas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('region', { name: 'Ranking de profesores' })).not.toBeInTheDocument();
  });

  it('cambiar el mes conserva la solapa y el profesor', async () => {
    conSesion(ADMIN);
    servidor.use(http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)));
    const { router } = renderizarEn('/liquidaciones?periodo=2026-03&solapa=liquidar&profesor=2');

    fireEvent.change(await screen.findByLabelText('Mes'), { target: { value: '2026-02' } });

    await waitFor(() => expect(router.state.location.search).toBe('?periodo=2026-02&solapa=liquidar&profesor=2'));
  });

  it('una solapa desconocida muestra Resumen', async () => {
    conSesion(ADMIN);
    servidor.use(http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)));
    renderizarEn('/liquidaciones?periodo=2026-03&solapa=otra');

    await screen.findByRole('region', { name: 'Ranking de profesores' });
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  });
});
