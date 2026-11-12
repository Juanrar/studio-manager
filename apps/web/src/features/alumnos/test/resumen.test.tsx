import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ResumenDeAlumno } from '@studio/shared';
import { unaFichaDeAlumno, unResumenDeAlumno } from '../../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';

// Abre la ficha de Martina, que se abre en la pestaña Resumen, con el resumen que se le pase.
function resumenDeMartina(resumen: ResumenDeAlumno) {
  conSesion(ADMIN);
  servidor.use(
    http.get('/api/alumnos', () => HttpResponse.json({ items: [], total: 0, pagina: 1, porPagina: 20, vigentes: 0, hoy: '2026-03-10' })),
    http.get('/api/alumnos/10', () =>
      HttpResponse.json(
        unaFichaDeAlumno({
          id: 10,
          nombre: 'Martina',
          apellido: 'García',
          email: 'martina@ejemplo.com',
          estadoPack: 'vigente',
          pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 6, venceEl: '2026-04-01' },
        }),
      ),
    ),
    http.get('/api/alumnos/10/resumen', () => HttpResponse.json(resumen)),
  );
  return renderizarEn('/alumnos/10');
}

async function elResumen() {
  const ficha = await screen.findByRole('dialog', { name: 'Ficha de Martina García' });
  return within(await within(ficha).findByRole('tabpanel', { name: 'Resumen' }));
}

// El valor y la nota de un indicador, juntos, como se leen en pantalla.
function indicador(panel: ReturnType<typeof within>, etiqueta: string) {
  return panel.getByText(etiqueta).parentElement?.textContent;
}

describe('pestaña Resumen', () => {
  it('la ficha se abre en Resumen y muestra contacto, pack, indicadores y profesores', async () => {
    resumenDeMartina(unResumenDeAlumno());
    const resumen = await elResumen();

    expect(await resumen.findByText('Erik Zapata')).toBeInTheDocument();
    expect(resumen.getByText('martina@ejemplo.com')).toBeInTheDocument();
    expect(resumen.getByText('6 de 8')).toBeInTheDocument();
    expect(resumen.getByText('Vence el 01/04/2026')).toBeInTheDocument();
    expect(indicador(resumen, 'Clases tomadas')).toBe('Clases tomadas6desde el alta');
    expect(indicador(resumen, 'Por semana')).toBe('Por semana0,5últimas 8 semanas');
    expect(indicador(resumen, 'Última clase')).toBe('Última claseHoy');
    expect(indicador(resumen, 'Estilo que más toma')).toBe('Estilo que más tomaJazz');
    expect(indicador(resumen, 'Suele venir')).toBe('Suele venirMartes y jueves 19:00');
    expect(indicador(resumen, 'Vencidas sin usar')).toBe('Vencidas sin usar3últimos 12 meses');
    expect(indicador(resumen, 'Total pagado')).toBe('Total pagado$17.800');
    expect(resumen.getByText('Salsa · 5 clases')).toBeInTheDocument();
    expect(resumen.getByText('Julia Paz')).toBeInTheDocument();
    expect(resumen.getByText('Jazz · 1 clase')).toBeInTheDocument();
  });

  it('recepción no ve "Total pagado": con null no se dibuja ni como $0', async () => {
    resumenDeMartina(unResumenDeAlumno({ totalPagado: null }));
    const resumen = await elResumen();

    await resumen.findByText('Clases tomadas');

    expect(resumen.queryByText('Total pagado')).not.toBeInTheDocument();
    expect(resumen.queryByText('$0')).not.toBeInTheDocument();
  });

  it('un alumno sin clases muestra "—", "Todavía no tomó clases" y ningún NaN', async () => {
    resumenDeMartina(
      unResumenDeAlumno({
        clasesTomadas: 0,
        clasesEnOchoSemanas: 0,
        ultimaClase: null,
        estiloMasTomado: null,
        sueleVenir: null,
        vencidasSinUsar: 0,
        totalPagado: 0,
        profesores: [],
        meses: [],
      }),
    );
    const resumen = await elResumen();

    expect(await resumen.findByText('Todavía no tomó clases')).toBeInTheDocument();
    expect(indicador(resumen, 'Clases tomadas')).toBe('Clases tomadas0desde el alta');
    expect(indicador(resumen, 'Por semana')).toBe('Por semana0últimas 8 semanas');
    expect(indicador(resumen, 'Última clase')).toBe('Última clase—');
    expect(indicador(resumen, 'Estilo que más toma')).toBe('Estilo que más toma—');
    expect(indicador(resumen, 'Suele venir')).toBe('Suele venir—');
    expect(indicador(resumen, 'Total pagado')).toBe('Total pagado$0');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('"Por semana" usa un decimal con coma, y un solo día de la semana va con la hora', async () => {
    resumenDeMartina(
      unResumenDeAlumno({ clasesEnOchoSemanas: 16, ultimaClase: '2026-03-08', sueleVenir: { diasSemana: [2], horaInicio: '19:00' } }),
    );
    const resumen = await elResumen();

    await resumen.findByText('Clases tomadas');

    expect(indicador(resumen, 'Por semana')).toBe('Por semana2últimas 8 semanas');
    expect(indicador(resumen, 'Última clase')).toBe('Última claseHace 2 días');
    expect(indicador(resumen, 'Suele venir')).toBe('Suele venirMartes 19:00');
  });
});
