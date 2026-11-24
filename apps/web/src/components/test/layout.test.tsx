import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ADMIN, conAgendaVacia, conSesion, renderizarEn } from '../../../test/render.tsx';

const CERRAR_MENU: [string, (usuario: UserEvent) => Promise<void>][] = [
  ['elegir una pantalla', (usuario) => usuario.click(within(screen.getByRole('navigation', { name: 'Menú' })).getByRole('link', { name: 'Agenda' }))],
  ['el botón de cerrar', (usuario) => usuario.click(screen.getByRole('button', { name: 'Cerrar menú' }))],
  ['Escape', (usuario) => usuario.keyboard('{Escape}')],
];

describe('menú lateral en el teléfono', () => {
  it('el botón de la barra superior abre el menú', async () => {
    conSesion(ADMIN);
    conAgendaVacia();
    const { usuario } = renderizarEn('/agenda');

    const botonMenu = await screen.findByRole('button', { name: 'Abrir menú' });
    expect(botonMenu).toHaveAttribute('aria-expanded', 'false');

    await usuario.click(botonMenu);

    expect(botonMenu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus();
  });

  it.each(CERRAR_MENU)('%s cierra el menú y devuelve el foco al botón', async (_caso, cerrar) => {
    conSesion(ADMIN);
    conAgendaVacia();
    const { usuario } = renderizarEn('/agenda');
    const botonMenu = await screen.findByRole('button', { name: 'Abrir menú' });
    await usuario.click(botonMenu);

    await cerrar(usuario);

    expect(botonMenu).toHaveAttribute('aria-expanded', 'false');
    expect(botonMenu).toHaveFocus();
  });
});
