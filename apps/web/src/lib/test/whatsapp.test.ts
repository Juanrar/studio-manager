import { describe, expect, it } from 'vitest';
import { enlaceDeWhatsapp } from '../whatsapp.ts';

describe('enlaceDeWhatsapp', () => {
  it.each([
    ['11 5555-0000', 'https://wa.me/5491155550000'],
    ['(011) 5555-0000', 'https://wa.me/5491155550000'],
    ['+54 9 11 5555-0000', 'https://wa.me/5491155550000'],
    ['+54 11 5555-0000', 'https://wa.me/5491155550000'],
    ['0054 9 11 5555 0000', 'https://wa.me/5491155550000'],
    ['351 555-0000', 'https://wa.me/5493515550000'],
    ['11 15 5555-0000', 'https://wa.me/5491155550000'],
    ['011 15-5555-0000', 'https://wa.me/5491155550000'],
    ['0351 15 555-0000', 'https://wa.me/5493515550000'],
  ])('%s abre %s', (telefono, enlace) => {
    expect(enlaceDeWhatsapp(telefono)).toBe(enlace);
  });

  it.each(['', '5555-0000', 'sin teléfono', '+1 415 555 2671'])('%j no tiene enlace', (telefono) => {
    expect(enlaceDeWhatsapp(telefono)).toBeNull();
  });
});
