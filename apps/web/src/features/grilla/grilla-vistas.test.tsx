import { screen, waitFor, within } from '@testing-library/react';
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

// Cinco clases el martes 10, en orden de hora, y una el jueves 12.
const DEL_MARTES = ['09:00', '11:00', '17:00', '19:00', '21:00'].map((hora, indice) =>
  unaClase({ id: 70 + indice, fecha: '2026-03-10', estilo: `Clase ${indice + 1}`, nivel: null, horaInicio: hora, horaFin: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00` }),
);
const DEL_JUEVES = unaClase({ id: 80, fecha: '2026-03-12', estilo: 'Ballet', nivel: null, horaInicio: '10:00', horaFin: '11:00' });

function grillaCon(clases: Clase[]) {
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
        finDelHorizonte: '2026-05-03',
        items: clases.filter((clase) => clase.fecha >= desde && clase.fecha <= hasta),
      };
      return HttpResponse.json(respuesta);
    }),
  );
  return pedidos;
}

describe('/grilla: vistas de día y de mes', () => {
  it('el mes pide sus semanas completas y cada día muestra hasta 4 clases y cuántas más tiene', async () => {
    const pedidos = grillaCon([...DEL_MARTES, DEL_JUEVES]);
    renderizarEn('/grilla?vista=mes&fecha=2026-03-10');

    const martes = await screen.findByRole('button', { name: 'Martes 10, 5 clases' });

    // El 1 de marzo es domingo: el mes empieza el lunes 23 de febrero y termina el domingo 5 de abril.
    expect(pedidos).toEqual(['?desde=2026-02-23&hasta=2026-04-05']);
    expect(within(martes).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '09:00 Clase 1',
      '11:00 Clase 2',
      '17:00 Clase 3',
      '19:00 Clase 4',
      '1 más',
    ]);
    expect(screen.getByRole('button', { name: 'Jueves 12, 1 clase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Miércoles 11, sin clases' })).toBeInTheDocument();
  });

  it('un clic en un día del mes abre ese día en la vista Día', async () => {
    const pedidos = grillaCon([...DEL_MARTES, DEL_JUEVES]);
    const { usuario, router } = renderizarEn('/grilla?vista=mes&fecha=2026-03-10');

    await usuario.click(await screen.findByRole('button', { name: 'Jueves 12, 1 clase' }));

    expect(await screen.findByRole('button', { name: /^Ballet, 10:00 a 11:00/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Jueves 12' })).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('vista')).toBe('dia');
    expect(pedidos.at(-1)).toBe('?desde=2026-03-12&hasta=2026-03-12');
  });

  it('"Día", "Semana" y "Mes" cambian la vista sobre la misma fecha, y las flechas avanzan de a uno de esos', async () => {
    const pedidos = grillaCon([...DEL_MARTES]);
    const { usuario } = renderizarEn('/grilla');
    await screen.findByRole('group', { name: 'Lunes 9' });

    await usuario.click(screen.getByRole('button', { name: 'Día' }));
    await screen.findByRole('group', { name: 'Martes 10' });
    await usuario.click(screen.getByRole('button', { name: 'Día siguiente' }));
    await screen.findByRole('group', { name: 'Miércoles 11' });
    await usuario.click(screen.getByRole('button', { name: 'Mes' }));
    await screen.findByRole('button', { name: 'Miércoles 11, sin clases' });
    await usuario.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Abril 2026');
    await waitFor(() =>
      expect(pedidos).toEqual([
        '?desde=2026-03-09&hasta=2026-03-15',
        '?desde=2026-03-10&hasta=2026-03-10',
        '?desde=2026-03-11&hasta=2026-03-11',
        '?desde=2026-02-23&hasta=2026-04-05',
        '?desde=2026-03-30&hasta=2026-05-03',
      ]),
    );
  });
});
