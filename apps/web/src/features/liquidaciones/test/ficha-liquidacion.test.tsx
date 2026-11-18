import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { TableroDelProfesor } from '@studio/shared';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';
import { celdasDe } from '../../../../test/tabla.ts';
import { descargarCsv } from '../csv.ts';

vi.mock('../csv.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../csv.ts')>()),
  descargarCsv: vi.fn(),
}));

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
    { claseId: 10, fecha: '2026-03-03', estilo: 'Salsa', asistentes: 3, monto: 1200, alumnos: [] },
    { claseId: 11, fecha: '2026-03-10', estilo: 'Salsa', asistentes: 5, monto: 2000, alumnos: [] },
  ],
};

function abrirFicha(ficha: TableroDelProfesor = FICHA_DE_IARU) {
  conSesion(ADMIN);
  servidor.use(http.get('/api/tablero/profesores/2', () => HttpResponse.json(ficha)));
  return renderizarEn('/liquidaciones/2?periodo=2026-03');
}

function indicador(nombre: string) {
  return within(screen.getByRole('group', { name: nombre }));
}

describe('/liquidaciones/:profesorId', () => {
  it('muestra el encabezado con porcentaje, alias y estado abierto', async () => {
    abrirFicha();

    await screen.findByRole('heading', { name: 'Iaru Speroni · marzo de 2026' });
    expect(screen.getByText('Porcentaje: 52,5%')).toBeInTheDocument();
    expect(screen.getByText('Alias o CBU: iaru.speroni')).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    const volver = within(screen.getByRole('banner')).getByRole('link', { name: 'Liquidaciones' });
    expect(volver).toHaveAttribute('href', '/liquidaciones?periodo=2026-03');
  });

  it('muestra "—" cuando no hay porcentaje ni alias', async () => {
    abrirFicha({ ...FICHA_DE_IARU, profesor: { ...FICHA_DE_IARU.profesor, aliasCbu: null, porcentajeBp: null } });

    await screen.findByRole('heading', { name: 'Iaru Speroni · marzo de 2026' });
    expect(screen.getByText('Porcentaje: —')).toBeInTheDocument();
    expect(screen.getByText('Alias o CBU: —')).toBeInTheDocument();
  });

  it('muestra los indicadores del mes', async () => {
    abrirFicha();

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
    abrirFicha({ ...FICHA_DE_IARU, clasesDictadas: 0, asistencias: 0 });

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(indicador('Asistentes por clase').getByText('—')).toBeInTheDocument();
  });

  it('dibuja el sueldo de los últimos 6 meses con el mes y el monto en el nombre de cada barra', async () => {
    abrirFicha();

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
    abrirFicha();

    const panel = await screen.findByRole('region', { name: 'Por horario' });
    const filas = within(panel).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['Salsa · Martes · 18:00', '3', '2,7', '$3.200'],
      ['Clases únicas', '1', '2,0', '$800'],
    ]);
  });

  it('muestra las clases del mes', async () => {
    abrirFicha();

    const panel = await screen.findByRole('region', { name: 'Clases del mes' });
    const filas = within(panel).getAllByRole('row').slice(1);
    expect(filas.map(celdasDe)).toEqual([
      ['03/03', 'Salsa', '3', '$1.200'],
      ['10/03', 'Salsa', '5', '$2.000'],
    ]);
  });

  it('con la liquidación cerrada y montos distintos muestra el guardado y el calculado', async () => {
    abrirFicha({
      ...FICHA_DE_IARU,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    });

    await screen.findByRole('group', { name: 'Sueldo' });
    expect(indicador('Sueldo').getByText('$3.600')).toBeInTheDocument();
    expect(indicador('Sueldo').getByText('Calculado hoy: $4.000')).toBeInTheDocument();
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar pagada' })).toBeInTheDocument();
  });

  it('con la liquidación pagada y el mismo monto no muestra el calculado', async () => {
    abrirFicha({
      ...FICHA_DE_IARU,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 4000, pagadoEn: '2026-04-02T15:00:00.000Z' },
    });

    await screen.findByText('Pagada el 02/04/2026');
    expect(indicador('Sueldo').getByText('$4.000')).toBeInTheDocument();
    expect(indicador('Sueldo').queryByText(/Calculado hoy/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar pagada' })).not.toBeInTheDocument();
  });

  it('"Cerrar" manda el profesor y el período y vuelve a pedir la ficha', async () => {
    let cuerpoRecibido: unknown;
    let pedidos = 0;
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero/profesores/2', () => {
        pedidos += 1;
        return HttpResponse.json(FICHA_DE_IARU);
      }),
      http.post('/api/liquidaciones', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json({ id: 72, profesorId: 2, periodo: '2026-03', monto: 4000, pagadoEn: null }, { status: 201 });
      }),
    );
    const { usuario } = renderizarEn('/liquidaciones/2?periodo=2026-03');

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ profesorId: 2, periodo: '2026-03' }));
    await waitFor(() => expect(pedidos).toBe(2));
  });

  it('"Marcar pagada" llama a la API de esa liquidación', async () => {
    let liquidacionPagada: string | undefined;
    servidor.use(
      http.post('/api/liquidaciones/:id/pagar', ({ params }) => {
        liquidacionPagada = String(params.id);
        return HttpResponse.json({ id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: '2026-04-05T15:00:00.000Z' });
      }),
    );
    const { usuario } = abrirFicha({
      ...FICHA_DE_IARU,
      liquidacion: { id: 70, profesorId: 2, periodo: '2026-03', monto: 3600, pagadoEn: null },
    });

    await usuario.click(await screen.findByRole('button', { name: 'Marcar pagada' }));

    await waitFor(() => expect(liquidacionPagada).toBe('70'));
  });

  it('cambiar el mes conserva al profesor y pide la ficha del nuevo período', async () => {
    const periodosPedidos: (string | null)[] = [];
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero/profesores/2', ({ request }) => {
        periodosPedidos.push(new URL(request.url).searchParams.get('periodo'));
        return HttpResponse.json(FICHA_DE_IARU);
      }),
    );
    renderizarEn('/liquidaciones/2?periodo=2026-03');

    fireEvent.change(await screen.findByLabelText('Mes'), { target: { value: '2026-02' } });

    await waitFor(() => expect(periodosPedidos).toEqual(['2026-03', '2026-02']));
  });

  it('muestra el error cuando el profesor no existe', async () => {
    conSesion(ADMIN);
    servidor.use(
      http.get('/api/tablero/profesores/2', () => HttpResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })),
    );
    renderizarEn('/liquidaciones/2?periodo=2026-03');

    expect(await screen.findByText('Profesor no encontrado')).toBeInTheDocument();
  });

  it('descarga el CSV armado con las clases de la ficha', async () => {
    const { usuario } = abrirFicha();

    await usuario.click(await screen.findByRole('button', { name: 'Descargar CSV' }));

    expect(descargarCsv).toHaveBeenCalledWith(
      'sueldo-speroni-iaru-2026-03.csv',
      'Fecha;Clase;Asistentes;Monto\r\n03/03/2026;Salsa;3;1200\r\n10/03/2026;Salsa;5;2000\r\nTotal;;8;3200',
    );
  });
});
