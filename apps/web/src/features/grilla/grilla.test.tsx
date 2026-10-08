import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clase, ClasesDelRango } from '@studio/shared';
import { unaClase } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

// Martes 10 de marzo de 2026 a las 12:00 de Buenos Aires.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const HIP_HOP = unaClase({ id: 50, fecha: '2026-03-10' });
const SALSA = unaClase({
  id: 51,
  horarioId: 3,
  fecha: '2026-03-10',
  estilo: 'Salsa',
  nivel: null,
  horaInicio: '21:00',
  horaFin: '22:00',
  estado: 'cancelada',
  tieneCambios: true,
});
const BALLET = unaClase({ id: 52, horarioId: 4, fecha: '2026-03-12', estilo: 'Ballet', nivel: 'Inicial', horaInicio: '10:00', horaFin: '11:00' });

// Responde las clases que caen en el rango pedido y anota cada pedido.
function grillaCon(clases: Clase[], finDelHorizonte = '2026-05-03') {
  conSesion(ADMIN);
  const pedidos: string[] = [];
  servidor.use(
    http.get('/api/clases', ({ request }) => {
      const url = new URL(request.url);
      pedidos.push(url.search);
      const desde = url.searchParams.get('desde')!;
      const hasta = url.searchParams.get('hasta')!;
      const respuesta: ClasesDelRango = {
        desde,
        hasta,
        finDelHorizonte,
        items: clases.filter((clase) => clase.fecha >= desde && clase.fecha <= hasta),
      };
      return HttpResponse.json(respuesta);
    }),
  );
  return pedidos;
}

function clasesDelDia(nombre: string) {
  return within(screen.getByRole('group', { name: nombre }))
    .queryAllByRole('button')
    .map((clase) => clase.getAttribute('aria-label'));
}

describe('/grilla', () => {
  it('muestra la semana de hoy con cada clase en su día, con su estilo, su horario y su profesor', async () => {
    const pedidos = grillaCon([HIP_HOP, SALSA, BALLET]);
    renderizarEn('/grilla');

    await screen.findByRole('button', { name: /Hip-Hop/ });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Marzo 2026');
    expect(pedidos).toEqual(['?desde=2026-03-09&hasta=2026-03-15']);
    expect(clasesDelDia('Martes 10')).toEqual([
      'Hip-Hop Inicial, 19:00 a 20:30, Erik Zapata',
      'Salsa, 21:00 a 22:00, Erik Zapata, cancelada',
    ]);
    expect(clasesDelDia('Jueves 12')).toEqual(['Ballet Inicial, 10:00 a 11:00, Erik Zapata']);
    expect(clasesDelDia('Lunes 9')).toEqual([]);
    expect(screen.getByRole('link', { name: 'Grilla' })).toHaveAttribute('aria-current', 'page');
  });

  it('las flechas pasan de semana y "Hoy" vuelve a la de hoy', async () => {
    const pedidos = grillaCon([HIP_HOP]);
    const { usuario, router } = renderizarEn('/grilla');
    await screen.findByRole('button', { name: /Hip-Hop/ });

    await usuario.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await screen.findByRole('group', { name: 'Lunes 16' });
    await usuario.click(screen.getByRole('button', { name: 'Hoy' }));
    await screen.findByRole('group', { name: 'Lunes 9' });

    expect(pedidos).toEqual(['?desde=2026-03-09&hasta=2026-03-15', '?desde=2026-03-16&hasta=2026-03-22', '?desde=2026-03-09&hasta=2026-03-15']);
    expect(router.state.location.search).toBe('');
  });

  it('la flecha siguiente se deshabilita en la última semana con clases creadas', async () => {
    grillaCon([], '2026-03-22');
    renderizarEn('/grilla?fecha=2026-03-16');

    await screen.findByRole('group', { name: 'Lunes 16' });

    expect(await screen.findByRole('button', { name: 'Semana siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeEnabled();
  });
});
