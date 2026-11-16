import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ResumenDeAlumno } from '@studio/shared';
import { unaFichaDeAlumno, unListadoDeAlumnos, unResumenDeAlumno } from '../../../../test/datos.ts';
import { ADMIN, RECEPCION, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { celdasDe } from '../../../../test/tabla.ts';
import { servidor } from '../../../../test/servidor.ts';

function resumenDeMartina(resumen: ResumenDeAlumno, usuario = ADMIN) {
  conSesion(usuario);
  servidor.use(
    http.get('/api/alumnos', () => HttpResponse.json(unListadoDeAlumnos([]))),
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

function indicador(panel: ReturnType<typeof within>, etiqueta: string) {
  return panel.getByText(etiqueta, { selector: 'div' }).parentElement?.textContent;
}

describe('pestaña Resumen', () => {
  it('la ficha se abre en Resumen y muestra contacto, pack, indicadores y profesores', async () => {
    resumenDeMartina(unResumenDeAlumno());
    const resumen = await elResumen();

    expect(await resumen.findByText('Salsa · 5 clases')).toBeInTheDocument();
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
    expect(resumen.getAllByText('Julia Paz')).toHaveLength(2);
    expect(resumen.getByText('Jazz · 1 clase')).toBeInTheDocument();
  });

  it('recepción no ve "Total pagado": con null no se dibuja ni como $0', async () => {
    resumenDeMartina(unResumenDeAlumno({ totalPagado: null }), RECEPCION);
    const resumen = await elResumen();

    await resumen.findByText('Clases tomadas', { selector: 'div' });

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

    await resumen.findByText('Clases tomadas', { selector: 'div' });

    expect(indicador(resumen, 'Por semana')).toBe('Por semana2últimas 8 semanas');
    expect(indicador(resumen, 'Última clase')).toBe('Última claseHace 2 días');
    expect(indicador(resumen, 'Suele venir')).toBe('Suele venirMartes 19:00');
  });

  describe('mes a mes', () => {
    const detalleDe = async (nombre: string) => within(await (await elResumen()).findByRole('region', { name: nombre }));

    it('se abre con el último mes: sus compras, sus clases tomadas y la tabla', async () => {
      resumenDeMartina(unResumenDeAlumno());
      const detalle = await detalleDe('Marzo 2026');

      expect(detalle.getByRole('heading', { name: 'Marzo 2026' })).toBeInTheDocument();
      expect(detalle.getByText('Pack x8')).toBeInTheDocument();
      expect(detalle.getByText('3 clases tomadas')).toBeInTheDocument();
      expect(detalle.queryByText(/sin usar/)).not.toBeInTheDocument();
      const filas = detalle.getAllByRole('row').slice(1);
      expect(filas.map(celdasDe)).toEqual([
        ['10/03', 'Jazz', 'Julia Paz'],
        ['05/03', 'Jazz', 'Erik Zapata'],
        ['03/03', 'Jazz', 'Erik Zapata'],
      ]);
      expect((await elResumen()).getByRole('button', { name: 'Marzo 2026: 3 clases tomadas' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('tocar otro mes muestra sus compras, sus clases y las vencidas', async () => {
      resumenDeMartina(unResumenDeAlumno());
      const resumen = await elResumen();
      await userEvent.click(await resumen.findByRole('button', { name: 'Enero 2026: 1 clase tomada' }));
      const detalle = await detalleDe('Enero 2026');

      expect(detalle.getByText('Pack x4')).toBeInTheDocument();
      expect(detalle.getByText('1 clase tomada')).toBeInTheDocument();
      expect(detalle.getByText('3 sin usar')).toBeInTheDocument();
      expect(detalle.getAllByRole('row').slice(1).map(celdasDe)).toEqual([['13/01', 'Salsa', 'Erik Zapata']]);
      expect(resumen.getByRole('button', { name: 'Enero 2026: 1 clase tomada' })).toHaveAttribute('aria-pressed', 'true');
      expect(resumen.getByRole('button', { name: 'Marzo 2026: 3 clases tomadas' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('una compra repetida se escribe "2 × Clase suelta", debajo de la barra y en el detalle', async () => {
      resumenDeMartina(unResumenDeAlumno());
      const resumen = await elResumen();
      const barra = await resumen.findByRole('button', { name: 'Febrero 2026: 1 clase tomada' });
      expect(barra).toHaveTextContent('2 × Clase suelta');

      await userEvent.click(barra);

      expect((await detalleDe('Febrero 2026')).getByText('2 × Clase suelta')).toBeInTheDocument();
    });

    it('un mes con dos compras distintas muestra la primera y "+1" en la barra, y las dos en el detalle', async () => {
      const base = unResumenDeAlumno();
      const marzo = { ...base.meses[11]!, compras: [{ pack: 'Pack x8', veces: 1 }, { pack: 'Clase suelta', veces: 1 }] };
      resumenDeMartina(unResumenDeAlumno({ meses: [...base.meses.slice(0, 11), marzo] }));
      const resumen = await elResumen();
      const barra = await resumen.findByRole('button', { name: 'Marzo 2026: 3 clases tomadas' });

      expect(barra).toHaveTextContent('Pack x8');
      expect(barra).toHaveTextContent('+1');
      expect(barra).not.toHaveTextContent('Clase suelta');
      const detalle = await detalleDe('Marzo 2026');
      expect(detalle.getByText('Pack x8')).toBeInTheDocument();
      expect(detalle.getByText('Clase suelta')).toBeInTheDocument();
    });

    it('un mes sin nada muestra "—" en la barra y "No tomó clases este mes."', async () => {
      resumenDeMartina(unResumenDeAlumno());
      const resumen = await elResumen();
      const barra = await resumen.findByRole('button', { name: 'Abril 2025: 0 clases tomadas' });
      expect(barra).toHaveTextContent('—');

      await userEvent.click(barra);

      const detalle = await detalleDe('Abril 2025');
      expect(detalle.getByText('No tomó clases este mes.')).toBeInTheDocument();
      expect(detalle.getByText('0 clases tomadas')).toBeInTheDocument();
      expect(detalle.queryByRole('table')).not.toBeInTheDocument();
    });

    it('si todos los meses están en cero, las barras no dan NaN', async () => {
      const base = unResumenDeAlumno();
      resumenDeMartina(unResumenDeAlumno({ meses: base.meses.map((mes) => ({ ...mes, tomadas: 0, vencidas: 0, clases: [] })) }));
      const resumen = await elResumen();

      await resumen.findByRole('button', { name: 'Marzo 2026: 0 clases tomadas' });

      expect(document.body.innerHTML).not.toContain('NaN');
      const barras = resumen.getAllByRole('button', { name: /clases tomadas$/ }).map((boton) => boton.querySelector<HTMLElement>('span[style] > span:last-child'));
      expect(barras).toHaveLength(12);
      expect(barras.map((barra) => barra?.style.height)).toEqual(Array(12).fill('2px'));
    });

    it('un mes con dos clases el mismo día no deja filas de más al cambiar de mes', async () => {
      const base = unResumenDeAlumno();
      const personaErik = base.meses[11]!.clases[1]!.profesor;
      const personaJulia = base.meses[11]!.clases[0]!.profesor;
      const marzo = {
        ...base.meses[11]!,
        tomadas: 3,
        clases: [
          { fecha: '2026-03-10', estilo: 'Jazz', profesor: personaJulia },
          { fecha: '2026-03-10', estilo: 'Salsa', profesor: personaErik },
          { fecha: '2026-03-03', estilo: 'Jazz', profesor: personaErik },
        ],
      };
      resumenDeMartina(unResumenDeAlumno({ meses: [...base.meses.slice(0, 11), marzo] }));
      const resumen = await elResumen();
      const filasDe = async (nombre: string) => (await detalleDe(nombre)).getAllByRole('row').slice(1).map(celdasDe);
      const filasDeMarzo = [
        ['10/03', 'Jazz', 'Julia Paz'],
        ['10/03', 'Salsa', 'Erik Zapata'],
        ['03/03', 'Jazz', 'Erik Zapata'],
      ];
      expect(await filasDe('Marzo 2026')).toEqual(filasDeMarzo);

      await userEvent.click(resumen.getByRole('button', { name: 'Enero 2026: 1 clase tomada' }));
      expect(await filasDe('Enero 2026')).toEqual([['13/01', 'Salsa', 'Erik Zapata']]);

      await userEvent.click(resumen.getByRole('button', { name: 'Marzo 2026: 3 clases tomadas' }));
      expect(await filasDe('Marzo 2026')).toEqual(filasDeMarzo);
    });
  });
});
