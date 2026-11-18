import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { TableroDelMes, TableroDelProfesor } from '@studio/shared';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';
import { descargarCsv } from '../csv.ts';

vi.mock('../csv.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../csv.ts')>()),
  descargarCsv: vi.fn(),
}));

const ERIK = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const IARU = { id: 2, nombre: 'Iaru', apellido: 'Speroni' };
const MARTIN = { id: 4, nombre: 'Martín', apellido: 'Núñez' };

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
      profesor: IARU,
      asistencias: 5,
      asistenciasMesAnterior: 4,
      montoCalculado: 4000,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    },
    { profesor: ERIK, asistencias: 3, asistenciasMesAnterior: 0, montoCalculado: 2050, liquidacion: null },
    {
      profesor: MARTIN,
      asistencias: 2,
      asistenciasMesAnterior: 4,
      montoCalculado: 1300,
      liquidacion: { id: 71, profesorId: 4, periodo: '2026-03', monto: 1300, pagadoEn: '2026-04-02T15:00:00.000Z' },
    },
  ],
  alumnosPorEstado: { vigente: 0, por_vencer: 0, vencido: 0, sin_clases: 0, sin_pack: 0 },
};

function unaFicha(datos: Partial<TableroDelProfesor>): TableroDelProfesor {
  return {
    periodo: '2026-03',
    profesor: { ...ERIK, aliasCbu: 'erik.zapata', porcentajeBp: 5000 },
    liquidacion: null,
    montoCalculado: 2050,
    clasesDictadas: 2,
    clasesCanceladas: 0,
    asistencias: 3,
    alumnosDistintos: 3,
    suplenciasDadas: 0,
    suplenciasRecibidas: 0,
    sueldoPorMes: [],
    porHorario: [],
    clases: [],
    ...datos,
  };
}

const FICHAS: Record<number, TableroDelProfesor> = {
  1: unaFicha({
    clases: [
      {
        claseId: 10,
        fecha: '2026-03-03',
        estilo: 'Hip-Hop',
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
        estilo: 'Hip-Hop',
        asistentes: 1,
        monto: 650,
        alumnos: [{ alumnoId: 7, nombre: 'Lucía', apellido: 'Gómez', pack: 'Pack x8', valorClase: 1300, parte: 650 }],
      },
    ],
  }),
  2: unaFicha({
    profesor: { ...IARU, aliasCbu: null, porcentajeBp: 5250 },
    liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    montoCalculado: 4000,
    clasesDictadas: 4,
  }),
  4: unaFicha({
    profesor: { ...MARTIN, aliasCbu: 'martin.nunez', porcentajeBp: 4000 },
    liquidacion: { id: 71, profesorId: 4, periodo: '2026-03', monto: 1300, pagadoEn: '2026-04-02T15:00:00.000Z' },
    montoCalculado: 1300,
    clasesDictadas: 1,
  }),
};

function abrirLiquidar(profesor?: number) {
  conSesion(ADMIN);
  servidor.use(
    http.get('/api/tablero', () => HttpResponse.json(TABLERO_DE_MARZO)),
    http.get('/api/tablero/profesores/:id', ({ params }) => HttpResponse.json(FICHAS[Number(params['id'])])),
  );
  const profesorEnLaDireccion = profesor === undefined ? '' : `&profesor=${profesor}`;
  return renderizarEn(`/liquidaciones?periodo=2026-03&solapa=liquidar${profesorEnLaDireccion}`);
}

function lista() {
  return within(screen.getByRole('list', { name: 'Profesores' }));
}

function nombresEnLaLista() {
  return lista()
    .getAllByRole('button')
    .map((boton) => boton.textContent);
}

function panel() {
  return within(screen.getByRole('region', { name: 'Profesor elegido' }));
}

function dato(nombre: string) {
  return panel().getByRole('group', { name: nombre }).textContent;
}

describe('solapa Liquidar', () => {
  it('lista los profesores por apellido con su sueldo y la insignia de cada estado', async () => {
    abrirLiquidar();

    await screen.findByRole('list', { name: 'Profesores' });
    expect(nombresEnLaLista()).toEqual([
      'Núñez, Martín$1.300Pagada',
      'Speroni, Iaru$3.600Por pagar',
      'Zapata, Erik$2.050Sin cerrar',
    ]);
    expect(screen.getByText('Elegí un profesor de la lista para ver y liquidar su sueldo.')).toBeInTheDocument();
  });

  it('cuenta los pagados y suma lo que falta pagar con el monto guardado de una cerrada', async () => {
    abrirLiquidar();

    expect(await screen.findByText('1 de 3 profesores pagados')).toBeInTheDocument();
    expect(screen.getByText('Falta pagar $5.650')).toBeInTheDocument();
  });

  it('el buscador tiene foco y encuentra sin tildes ni mayúsculas y con el apellido primero', async () => {
    const { usuario } = abrirLiquidar();

    const buscador = await screen.findByRole('textbox', { name: 'Buscar profesor' });
    expect(buscador).toHaveFocus();
    expect(buscador).toHaveAttribute('placeholder', 'Buscar profesor por nombre o apellido');

    await usuario.type(buscador, 'NUNEZ martin');
    expect(nombresEnLaLista()).toEqual(['Núñez, Martín$1.300Pagada']);

    await usuario.clear(buscador);
    await usuario.type(buscador, 'zapata erik');
    expect(nombresEnLaLista()).toEqual(['Zapata, Erik$2.050Sin cerrar']);

    await usuario.clear(buscador);
    await usuario.type(buscador, 'juana');
    expect(lista().queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Ningún profesor con ese nombre.')).toBeInTheDocument();
  });

  it('Enter elige el primero de la lista filtrada y lo escribe en la dirección sin sumar historial', async () => {
    const { router, usuario } = abrirLiquidar();

    await usuario.type(await screen.findByRole('textbox', { name: 'Buscar profesor' }), 'speroni{Enter}');

    expect(router.state.location.search).toBe('?periodo=2026-03&solapa=liquidar&profesor=2');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await (await panelCargado()).findByRole('heading', { name: 'Iaru Speroni' })).toBeInTheDocument();
    expect(lista().getByRole('button', { name: /Speroni, Iaru/ })).toHaveAttribute('aria-current', 'true');
  });

  it('un clic en la lista elige al profesor', async () => {
    const { router, usuario } = abrirLiquidar();

    await usuario.click(await screen.findByRole('button', { name: /Zapata, Erik/ }));

    expect(router.state.location.search).toBe('?periodo=2026-03&solapa=liquidar&profesor=1');
    expect(await (await panelCargado()).findByRole('heading', { name: 'Erik Zapata' })).toBeInTheDocument();
  });

  it('muestra los datos del profesor y sus clases con la cantidad de alumnos y la parte, sin nombres', async () => {
    abrirLiquidar(1);

    await (await panelCargado()).findByText('03/03');
    expect(dato('Sueldo')).toBe('Sueldo$2.050');
    expect(dato('Clases dictadas')).toBe('Clases dictadas2');
    expect(dato('Porcentaje')).toBe('Porcentaje50%');
    expect(dato('Alias o CBU')).toBe('Alias o CBUerik.zapata');
    const clases = within(panel().getByRole('list', { name: 'Clases del mes' }));
    expect(clases.getAllByRole('listitem').map((clase) => clase.textContent)).toEqual([
      '03/03Hip-Hop2 alumnos$1.400',
      '10/03Hip-Hop1 alumno$650',
    ]);
    expect(screen.queryByText(/Martina/)).not.toBeInTheDocument();
    expect(screen.queryByText('Calculado hoy: $2.050')).not.toBeInTheDocument();
  });

  it('una abierta está en el primer paso y pide confirmación antes de cerrar', async () => {
    let cuerpo: unknown = null;
    const { usuario } = abrirLiquidar(1);
    servidor.use(
      http.post('/api/liquidaciones', async ({ request }) => {
        cuerpo = await request.json();
        return HttpResponse.json({ id: 72, profesorId: 1, periodo: '2026-03', monto: 2050, pagadoEn: null });
      }),
    );

    await (await panelCargado()).findByText('03/03');
    expect(pasos()).toEqual(['Abierta: actual', 'Cerrada: pendiente', 'Pagada: pendiente']);
    expect(panel().queryByRole('button', { name: 'Marcar como pagada' })).not.toBeInTheDocument();
    await usuario.click(panel().getByRole('button', { name: 'Cerrar liquidación' }));

    const dialogo = screen.getByRole('dialog', { name: 'Cerrar liquidación' });
    expect(
      within(dialogo).getByText(
        '¿Cerrar la liquidación de Erik Zapata por $2.050? Después el monto no cambia aunque se carguen asistencias.',
      ),
    ).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cuerpo).toBeNull();

    await usuario.click(panel().getByRole('button', { name: 'Cerrar liquidación' }));
    await usuario.click(
      within(screen.getByRole('dialog', { name: 'Cerrar liquidación' })).getByRole('button', { name: 'Cerrar liquidación' }),
    );

    await waitFor(() => expect(cuerpo).toEqual({ profesorId: 1, periodo: '2026-03' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra en el panel el error de la API al cerrar', async () => {
    const { usuario } = abrirLiquidar(1);
    servidor.use(
      http.post('/api/liquidaciones', () =>
        HttpResponse.json({ error: 'No se puede cerrar un mes que no terminó' }, { status: 400 }),
      ),
    );

    await usuario.click(await (await panelCargado()).findByRole('button', { name: 'Cerrar liquidación' }));
    await usuario.click(
      within(screen.getByRole('dialog', { name: 'Cerrar liquidación' })).getByRole('button', { name: 'Cerrar liquidación' }),
    );

    expect(await (await panelCargado()).findByRole('alert')).toHaveTextContent('No se puede cerrar un mes que no terminó');
  });

  it('una cerrada muestra "Marcar como pagada", llama a pagar y avisa el calculado de hoy', async () => {
    let pagada: string | null = null;
    const { usuario } = abrirLiquidar(2);
    servidor.use(
      http.post('/api/liquidaciones/:id/pagar', ({ params }) => {
        pagada = String(params['id']);
        return HttpResponse.json({ id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: '2026-04-03T15:00:00.000Z' });
      }),
    );

    await (await panelCargado()).findByRole('heading', { name: 'Iaru Speroni' });
    expect(pasos()).toEqual(['Abierta: hecho', 'Cerrada: actual', 'Pagada: pendiente']);
    expect(dato('Sueldo')).toBe('Sueldo$3.600Calculado hoy: $4.000');
    expect(panel().getByText('Calculado hoy: $4.000')).toHaveClass('text-amber-300');
    expect(panel().queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();

    await usuario.click(panel().getByRole('button', { name: 'Marcar como pagada' }));

    await waitFor(() => expect(pagada).toBe('70'));
  });

  it('una pagada no tiene botón para avanzar y sus tres pasos están hechos', async () => {
    abrirLiquidar(4);

    expect(await (await panelCargado()).findByText('No dio clases con asistentes este mes.')).toBeInTheDocument();
    expect(pasos()).toEqual(['Abierta: hecho', 'Cerrada: hecho', 'Pagada: hecho']);
    expect(panel().getAllByRole('button').map((boton) => boton.textContent)).toEqual(['Descargar CSV']);
  });

  it('un profesor de la dirección que no está en el mes muestra el aviso', async () => {
    abrirLiquidar(9);

    expect(await screen.findByText('Ese profesor no tiene liquidación en este mes.')).toBeInTheDocument();
    expect(lista().getAllByRole('button').map((boton) => boton.getAttribute('aria-current'))).toEqual([
      'false',
      'false',
      'false',
    ]);
  });

  it('"Descargar CSV" arma el archivo con las clases y sus alumnos', async () => {
    const { usuario } = abrirLiquidar(1);

    await (await panelCargado()).findByText('03/03');
    await usuario.click(panel().getByRole('button', { name: 'Descargar CSV' }));

    expect(descargarCsv).toHaveBeenCalledWith(
      'sueldo-zapata-erik-2026-03.csv',
      [
        'Fecha;Clase;Alumno;Pack;Valor de la clase;Parte del profesor',
        '03/03/2026;Hip-Hop;2 alumnos;;;1400',
        ';;Martina García;Pack x4;1300;700',
        ';;Joaquín Pérez;Clase suelta;1500;700',
        '10/03/2026;Hip-Hop;1 alumno;;;650',
        ';;Lucía Gómez;Pack x8;1300;650',
        'Total;;;;;2050',
      ].join('\r\n'),
    );
  });
});

function pasos() {
  return within(panel().getByRole('list', { name: 'Pasos de la liquidación' }))
    .getAllByRole('listitem')
    .map((paso) => paso.getAttribute('aria-label'));
}

async function panelCargado() {
  return within(await screen.findByRole('region', { name: 'Profesor elegido' }));
}
