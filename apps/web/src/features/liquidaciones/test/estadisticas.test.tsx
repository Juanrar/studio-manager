import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { TableroDelMes, TableroDelProfesor } from '@studio/shared';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';
import { celdasDe } from '../../../../test/tabla.ts';
import { descargarCsv } from '../csv.ts';

vi.mock('../csv.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../csv.ts')>()),
  descargarCsv: vi.fn(),
}));

const SIN_INDICADORES = {
  ingresos: 0,
  sueldos: 0,
  leQuedaAlEstudio: 0,
  asistencias: 0,
  alumnosActivos: 0,
  alumnosNuevos: 0,
  clasesPerdidas: 0,
  valorPerdido: 0,
};

const TABLERO_DE_MARZO: TableroDelMes = {
  periodo: '2026-03',
  actual: SIN_INDICADORES,
  anterior: SIN_INDICADORES,
  porDia: [],
  ingresosPorMedio: [],
  profesores: [
    {
      profesor: { id: 2, nombre: 'Iaru', apellido: 'Speroni' },
      asistencias: 10,
      asistenciasMesAnterior: 4,
      montoCalculado: 4000,
      liquidacion: null,
    },
    {
      profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
      asistencias: 1,
      asistenciasMesAnterior: 0,
      montoCalculado: 650,
      liquidacion: null,
    },
  ],
  alumnosPorEstado: { vigente: 0, por_vencer: 0, vencido: 0, sin_clases: 0, sin_pack: 0 },
};

const FICHA_DE_IARU: TableroDelProfesor = {
  periodo: '2026-03',
  profesor: { id: 2, nombre: 'Iaru', apellido: 'Speroni', aliasCbu: 'iaru.speroni', porcentajeBp: 5250 },
  liquidacion: null,
  montoCalculado: 4000,
  clasesDictadas: 4,
  clasesCanceladas: 1,
  asistencias: 10,
  alumnosDistintos: 6,
  suplenciasDadas: 1,
  suplenciasRecibidas: 2,
  sueldoPorMes: [
    { periodo: '2025-10', monto: 0 },
    { periodo: '2025-11', monto: 1000 },
    { periodo: '2025-12', monto: 2000 },
    { periodo: '2026-01', monto: 3000 },
    { periodo: '2026-02', monto: 2500 },
    { periodo: '2026-03', monto: 4000 },
  ],
  porHorario: [
    { horarioId: 5, estilo: 'Salsa', diaSemana: 2, horaInicio: '18:00', clases: 3, asistencias: 8, monto: 3200 },
    { horarioId: null, estilo: 'Clase única', diaSemana: null, horaInicio: null, clases: 1, asistencias: 2, monto: 800 },
  ],
  clases: [
    {
      claseId: 10,
      fecha: '2026-03-03',
      estilo: 'Salsa',
      asistentes: 2,
      monto: 1400,
      alumnos: [
        { alumnoId: 5, nombre: 'Martina', apellido: 'García', pack: 'Pack x4', valorClase: 1300, parte: 700 },
        { alumnoId: 6, nombre: 'Joaquín', apellido: 'Pérez', pack: 'Clase suelta', valorClase: 1500, parte: 700 },
      ],
    },
    {
      claseId: 11,
      fecha: '2026-03-10',
      estilo: 'Salsa',
      asistentes: 1,
      monto: 650,
      alumnos: [{ alumnoId: 7, nombre: 'Lucía', apellido: 'Gómez', pack: 'Pack x8', valorClase: 1300, parte: 650 }],
    },
  ],
};

const DIRECCION_DE_IARU = '/liquidaciones?periodo=2026-03&solapa=estadisticas&profesor=2';

function abrirEstadisticas(ficha: TableroDelProfesor = FICHA_DE_IARU, direccion: string = DIRECCION_DE_IARU) {
  conSesion(ADMIN);
  servidor.use(
    http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)),
    http.get('/api/tablero/profesores/2', () => HttpResponse.json(ficha)),
  );
  return renderizarEn(direccion);
}

function panel() {
  return within(screen.getByRole('region', { name: 'Profesor elegido' }));
}

function indicador(nombre: string) {
  return within(screen.getByRole('group', { name: nombre }));
}

describe('solapa Estadísticas', () => {
  it('lista los profesores con sus asistencias y muestra el texto sin elegido', async () => {
    abrirEstadisticas(FICHA_DE_IARU, '/liquidaciones?periodo=2026-03&solapa=estadisticas');

    const lista = within(await screen.findByRole('list', { name: 'Profesores' }));
    expect(lista.getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      'Speroni, Iaru$4.00010 asistencias',
      'Zapata, Erik$6501 asistencia',
    ]);
    expect(screen.getByText('Elegí un profesor de la lista para ver sus estadísticas del mes.')).toBeInTheDocument();
  });

  it('muestra el nombre con porcentaje y alias', async () => {
    abrirEstadisticas();

    await screen.findByText('Porcentaje: 52,5% · Alias o CBU: iaru.speroni');
    expect(panel().getByRole('heading', { name: 'Iaru Speroni' })).toBeInTheDocument();
  });

  it('muestra "—" cuando no hay porcentaje ni alias', async () => {
    abrirEstadisticas({ ...FICHA_DE_IARU, profesor: { ...FICHA_DE_IARU.profesor, aliasCbu: null, porcentajeBp: null } });

    expect(await screen.findByText('Porcentaje: — · Alias o CBU: —')).toBeInTheDocument();
  });

  it('muestra los indicadores del mes', async () => {
    abrirEstadisticas();

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(indicador('Sueldo').getByText('$4.000')).toBeInTheDocument();
    expect(indicador('Clases dictadas').getByText('4')).toBeInTheDocument();
    expect(indicador('Clases canceladas').getByText('1')).toBeInTheDocument();
    expect(indicador('Asistentes por clase').getByText('2,5')).toBeInTheDocument();
    expect(indicador('Alumnos distintos').getByText('6')).toBeInTheDocument();
    expect(indicador('Suplencias dadas').getByText('1')).toBeInTheDocument();
    expect(indicador('Suplencias recibidas').getByText('2')).toBeInTheDocument();
  });

  it('muestra "—" en asistentes por clase cuando no dictó clases', async () => {
    abrirEstadisticas({ ...FICHA_DE_IARU, clasesDictadas: 0, asistencias: 0 });

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(indicador('Asistentes por clase').getByText('—')).toBeInTheDocument();
  });

  it('dibuja el sueldo de los últimos 6 meses con el mes y el monto en el nombre de cada barra', async () => {
    abrirEstadisticas();

    const grafico = await screen.findByRole('region', { name: 'Sueldo de los últimos 6 meses' });
    const nombres = [...grafico.querySelectorAll('rect[aria-label]')].map((barra) => barra.getAttribute('aria-label'));
    expect(nombres).toEqual([
      'Octubre 2025: $0',
      'Noviembre 2025: $1.000',
      'Diciembre 2025: $2.000',
      'Enero 2026: $3.000',
      'Febrero 2026: $2.500',
      'Marzo 2026: $4.000',
    ]);
  });

  it('muestra la tabla por horario con la fila de clases únicas', async () => {
    abrirEstadisticas();

    const tabla = await screen.findByRole('region', { name: 'Por horario' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['Salsa · Martes · 18:00', '3', '2,7', '$3.200'],
      ['Clases únicas', '1', '2,0', '$800'],
    ]);
  });

  it('muestra las clases del mes con un botón Detalle por fila', async () => {
    abrirEstadisticas();

    const tabla = await screen.findByRole('region', { name: 'Clases del mes' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['03/03', 'Salsa', '2', '$1.400', 'Detalle'],
      ['10/03', 'Salsa', '1', '$650', 'Detalle'],
    ]);
  });

  it('sin clases dice que no dio clases con asistentes', async () => {
    abrirEstadisticas({ ...FICHA_DE_IARU, clases: [] });

    expect(await screen.findByText('No dio clases con asistentes este mes.')).toBeInTheDocument();
  });

  it('"Detalle" abre los alumnos de esa clase y cambia a "Ocultar"; abrir otra deja abierta la primera', async () => {
    const { usuario } = abrirEstadisticas();
    const tabla = await screen.findByRole('region', { name: 'Clases del mes' });

    await usuario.click(within(tabla).getAllByRole('button', { name: 'Detalle' })[0]!);

    expect(within(tabla).getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(tabla).getByText('Martina García')).toBeInTheDocument();
    expect(within(tabla).queryByText('Lucía Gómez')).not.toBeInTheDocument();

    await usuario.click(within(tabla).getByRole('button', { name: 'Detalle' }));

    const alumnos = within(tabla).getAllByRole('table').slice(1);
    expect(alumnos.map((porClase) => within(porClase).getAllByRole('row').slice(1).map(celdasDe))).toEqual([
      [
        ['Martina García', 'Pack x4', '$1.300', '$700'],
        ['Joaquín Pérez', 'Clase suelta', '$1.500', '$700'],
      ],
      [['Lucía Gómez', 'Pack x8', '$1.300', '$650']],
    ]);
    expect(within(tabla).getAllByRole('button', { name: 'Ocultar' })).toHaveLength(2);
  });

  it('"Ocultar" cierra los alumnos de la clase', async () => {
    const { usuario } = abrirEstadisticas();
    const tabla = await screen.findByRole('region', { name: 'Clases del mes' });

    await usuario.click(within(tabla).getAllByRole('button', { name: 'Detalle' })[0]!);
    await usuario.click(within(tabla).getByRole('button', { name: 'Ocultar' }));

    expect(within(tabla).queryByText('Martina García')).not.toBeInTheDocument();
    expect(within(tabla).getAllByRole('button', { name: 'Detalle' })).toHaveLength(2);
  });

  it('con la liquidación cerrada y montos distintos muestra el guardado y el calculado', async () => {
    abrirEstadisticas({
      ...FICHA_DE_IARU,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    });

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(indicador('Sueldo').getByText('$3.600')).toBeInTheDocument();
    expect(indicador('Sueldo').getByText('Calculado hoy: $4.000')).toBeInTheDocument();
  });

  it('no tiene botones de cerrar ni de pagar', async () => {
    abrirEstadisticas({
      ...FICHA_DE_IARU,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    });

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(screen.queryByRole('button', { name: /Cerrar liquidación|Marcar como pagada/ })).not.toBeInTheDocument();
  });

  it('cambiar el mes conserva al profesor y pide la ficha del nuevo período', async () => {
    const periodosPedidos: (string | null)[] = [];
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)),
      http.get('/api/tablero/profesores/2', ({ request }) => {
        periodosPedidos.push(new URL(request.url).searchParams.get('periodo'));
        return HttpResponse.json(FICHA_DE_IARU);
      }),
    );
    renderizarEn(DIRECCION_DE_IARU);

    await screen.findByRole('heading', { name: 'Iaru Speroni' });
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-02' } });

    await waitFor(() => expect(periodosPedidos).toEqual(['2026-03', '2026-02']));
  });

  it('muestra el error cuando la ficha del profesor falla', async () => {
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)),
      http.get('/api/tablero/profesores/2', () => HttpResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })),
    );
    renderizarEn(DIRECCION_DE_IARU);

    expect(await screen.findByText('Profesor no encontrado')).toBeInTheDocument();
  });

  it('descarga el CSV con las clases y sus alumnos', async () => {
    const { usuario } = abrirEstadisticas();

    await usuario.click(await screen.findByRole('button', { name: 'Descargar CSV' }));

    expect(descargarCsv).toHaveBeenCalledWith(
      'sueldo-speroni-iaru-2026-03.csv',
      'Fecha;Clase;Alumno;Pack;Valor de la clase;Parte del profesor\r\n03/03/2026;Salsa;2 alumnos;;;1400\r\n;;Martina García;Pack x4;1300;700\r\n;;Joaquín Pérez;Clase suelta;1500;700\r\n10/03/2026;Salsa;1 alumno;;;650\r\n;;Lucía Gómez;Pack x8;1300;650\r\nTotal;;;;;2050',
    );
  });
});

describe('/liquidaciones/:profesorId', () => {
  it('redirige a Estadísticas con el profesor y el mes elegidos', async () => {
    abrirEstadisticas(FICHA_DE_IARU, '/liquidaciones/2?periodo=2026-03');

    expect(await screen.findByRole('heading', { name: 'Iaru Speroni' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estadísticas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Liquidaciones de marzo de 2026' })).toBeInTheDocument();
  });
});
