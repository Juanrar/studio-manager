import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarVerificacion } from '../registrar-verificacion.mjs';
import { comandosDeVerificacion } from '../estado.mjs';
import {
  RAIZ,
  carpetaTemporal,
  entradaBash,
  entradaEdicion,
  leerEstadoDeSesion,
} from './ayudantes.mjs';

const HORA = '2026-11-21T10:00:00.000Z';

function registrar(entrada, carpeta) {
  return registrarVerificacion(entrada, { carpeta, raiz: RAIZ, ahora: () => HORA });
}

test('guarda la hora de pnpm test y de pnpm --filter @studio/api test', () => {
  const carpeta = carpetaTemporal();

  assert.deepEqual(registrar(entradaBash('pnpm test'), carpeta), { codigo: 0 });
  registrar(entradaBash('pnpm --filter @studio/api test'), carpeta);

  assert.deepEqual(leerEstadoDeSesion(carpeta, 'sesion-1'), {
    ultimoCambioDeCodigo: null,
    comandos: {
      test: HORA,
      'test --filter @studio/api': HORA,
    },
    bloqueos: 0,
  });
});

test('no guarda pnpm test:watch, pnpm test:hooks ni un echo de pnpm test', () => {
  const carpeta = carpetaTemporal();

  registrar(entradaBash('pnpm test:watch'), carpeta);
  registrar(entradaBash('pnpm test:hooks'), carpeta);
  registrar(entradaBash('echo "pnpm test"'), carpeta);
  registrar(entradaBash("echo 'pnpm test && pnpm typecheck'"), carpeta);

  assert.deepEqual(leerEstadoDeSesion(carpeta, 'sesion-1'), {
    ultimoCambioDeCodigo: null,
    comandos: {},
    bloqueos: 0,
  });
});

test('reconoce los comandos dentro de cadenas, con variables delante y con run', () => {
  assert.deepEqual(comandosDeVerificacion('pnpm typecheck && pnpm test 2>&1 | tail -20'), [
    'typecheck',
    'test',
  ]);
  assert.deepEqual(comandosDeVerificacion('MSYS_NO_PATHCONV=1 pnpm mirar /alumnos /grilla; pnpm e2e'), [
    'mirar',
    'e2e',
  ]);
  assert.deepEqual(comandosDeVerificacion('cd /c/x && pnpm run test'), ['test']);
  assert.deepEqual(comandosDeVerificacion('pnpm -r test'), ['test -r']);
  assert.deepEqual(comandosDeVerificacion('pnpm --filter=@studio/web typecheck'), [
    'typecheck --filter @studio/web',
  ]);
  assert.deepEqual(comandosDeVerificacion('pnpm -F @studio/api test -- pagos'), [
    'test --filter @studio/api',
  ]);
  assert.deepEqual(comandosDeVerificacion('git commit -m "pnpm test"'), []);
});

test('guarda el último cambio de código para apps/web/src/x.tsx y lo ignora para docs/x.md', () => {
  const carpeta = carpetaTemporal();

  registrar(entradaEdicion(`${RAIZ}\\docs\\x.md`), carpeta);
  assert.deepEqual(leerEstadoDeSesion(carpeta, 'sesion-1'), {
    ultimoCambioDeCodigo: null,
    comandos: {},
    bloqueos: 0,
  });

  registrar(entradaEdicion(`${RAIZ}\\apps\\web\\src\\x.tsx`), carpeta);
  assert.deepEqual(leerEstadoDeSesion(carpeta, 'sesion-1'), {
    ultimoCambioDeCodigo: HORA,
    comandos: {},
    bloqueos: 0,
  });
});

test('cuenta como código packages/ y e2e/ con Write, también con otra forma de escribir la raíz', () => {
  const carpeta = carpetaTemporal();

  registrar(entradaEdicion('c:/proyecto/packages/shared/src/x.ts', 'sesion-2', 'Write'), carpeta);
  assert.equal(leerEstadoDeSesion(carpeta, 'sesion-2').ultimoCambioDeCodigo, HORA);

  registrar(entradaEdicion('C:\\proyecto\\e2e\\mirar.ts', 'sesion-3', 'MultiEdit'), carpeta);
  assert.equal(leerEstadoDeSesion(carpeta, 'sesion-3').ultimoCambioDeCodigo, HORA);

  registrar(entradaEdicion('C:\\otro\\apps\\web\\x.tsx', 'sesion-4'), carpeta);
  assert.equal(leerEstadoDeSesion(carpeta, 'sesion-4').ultimoCambioDeCodigo, null);
});

test('no guarda un pnpm test lanzado en segundo plano, que dispara PostToolUse al arrancar', () => {
  const carpeta = carpetaTemporal();
  const entrada = entradaBash('pnpm test && pnpm typecheck');
  entrada.tool_input.run_in_background = true;

  assert.deepEqual(registrar(entrada, carpeta), { codigo: 0 });
  registrar(entradaBash('pnpm e2e'), carpeta);

  assert.deepEqual(leerEstadoDeSesion(carpeta, 'sesion-1'), {
    ultimoCambioDeCodigo: null,
    comandos: { e2e: HORA },
    bloqueos: 0,
  });
});
