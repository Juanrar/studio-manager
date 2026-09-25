import { randomBytes, scrypt as scryptConCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptConCallback) as (
  texto: string,
  sal: Buffer,
  largo: number,
  opciones: ScryptOptions,
) => Promise<Buffer>;

// Costo de scrypt. El formato guardado incluye los parámetros,
// así se pueden subir más adelante sin invalidar los hashes existentes.
const N = 32_768;
const R = 8;
const P = 1;
const LARGO_HASH = 64;
const MEMORIA_MAXIMA = 64 * 1024 * 1024;

export async function hashearContrasena(texto: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(texto, sal, LARGO_HASH, { N, r: R, p: P, maxmem: MEMORIA_MAXIMA });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

export async function verificarContrasena(texto: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, sal, hash] = partes as [string, string, string, string, string, string];
  const esperado = Buffer.from(hash, 'base64');
  const obtenido = await scrypt(texto, Buffer.from(sal, 'base64'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MEMORIA_MAXIMA,
  });

  return timingSafeEqual(obtenido, esperado);
}
