import { spawnSync } from 'node:child_process';
import { archivosCambiadosDeGit } from './control-de-commit.mjs';
import { correrHook, esRutaDeCodigo } from './estado.mjs';

const LINEAS_DE_SALIDA = 40;

export function alTerminar(entrada, { archivosCambiados, correrTypecheck }) {
  if (entrada.stop_hook_active === true) return { codigo: 0 };
  if (!archivosCambiados().some(esRutaDeCodigo)) return { codigo: 0 };
  const { codigo, salida } = correrTypecheck();
  if (codigo === 0) return { codigo: 0 };
  const ultimas = salida.replace(/\s+$/, '').split(/\r?\n/).slice(-LINEAS_DE_SALIDA);
  return { codigo: 2, mensaje: ['pnpm typecheck falla. Arreglalo antes de terminar:', ...ultimas].join('\n') };
}

function correrTypecheckEn(raiz) {
  const resultado = spawnSync('pnpm', ['typecheck'], {
    cwd: raiz,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { codigo: resultado.status ?? 1, salida: `${resultado.stdout ?? ''}${resultado.stderr ?? ''}` };
}

correrHook(import.meta.url, (entrada, raiz) =>
  alTerminar(entrada, {
    archivosCambiados: () => archivosCambiadosDeGit(raiz),
    correrTypecheck: () => correrTypecheckEn(raiz),
  }),
);
