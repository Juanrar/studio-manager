import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Pack } from '@studio/shared';
import { unPack } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

function packsDelEstudio(packs: Pack[]) {
  conSesion(ADMIN);
  const cuerpos: unknown[] = [];
  servidor.use(
    http.get('/api/packs', () => HttpResponse.json({ items: packs })),
    http.post('/api/packs', async ({ request }) => {
      const cuerpo = (await request.json()) as Omit<Pack, 'id' | 'activo'>;
      cuerpos.push(cuerpo);
      packs.push({ id: 9, activo: true, ...cuerpo });
      return HttpResponse.json(packs.at(-1), { status: 201 });
    }),
  );
  return { cuerpos, ...renderizarEn('/packs') };
}

async function completarNuevoPack(usuario: ReturnType<typeof renderizarEn>['usuario'], precio: string) {
  await usuario.click(await screen.findByRole('button', { name: 'Nuevo pack' }));
  const dialogo = screen.getByRole('dialog', { name: 'Nuevo pack' });
  await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Pack x12');
  await usuario.type(within(dialogo).getByLabelText('Cantidad de clases'), '12');
  await usuario.type(within(dialogo).getByLabelText('Precio'), precio);
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  return dialogo;
}

describe('/packs', () => {
  it('crear un pack manda la cantidad y el precio como números, y lo muestra', async () => {
    const { cuerpos, usuario } = packsDelEstudio([unPack({ id: 1, nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 })]);

    await completarNuevoPack(usuario, '13000');

    const fila = await screen.findByRole('row', { name: /Pack x12/ });
    expect(within(fila).getByText('$13.000')).toBeInTheDocument();
    expect(cuerpos).toEqual([{ nombre: 'Pack x12', cantidadClases: 12, precio: 13_000 }]);
  });

  it('un precio con centavos muestra el error y no llama a la API', async () => {
    const { cuerpos, usuario } = packsDelEstudio([]);

    const dialogo = await completarNuevoPack(usuario, '12999.50');

    expect(await within(dialogo).findByText('El precio es en pesos enteros, sin centavos')).toBeInTheDocument();
    expect(cuerpos).toEqual([]);
  });
});
