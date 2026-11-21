import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alTerminar } from '../al-terminar.mjs';

function entradaStop(activo) {
  return { session_id: 'sesion-1', cwd: 'C:\\proyecto', hook_event_name: 'Stop', stop_hook_active: activo };
}

function espias({ cambiados = [], typecheck = { codigo: 0, salida: '' } } = {}) {
  const llamadas = [];
  return {
    llamadas,
    dependencias: {
      archivosCambiados: () => {
        llamadas.push('git status');
        return cambiados;
      },
      correrTypecheck: () => {
        llamadas.push('pnpm typecheck');
        return typecheck;
      },
    },
  };
}

test('sale con 0 sin correr nada si stop_hook_active es true', () => {
  const { llamadas, dependencias } = espias({ cambiados: ['apps/api/src/app.ts'] });

  assert.deepEqual(alTerminar(entradaStop(true), dependencias), { codigo: 0 });
  assert.deepEqual(llamadas, []);
});

test('sale con 0 sin correr typecheck si no hay cambios en apps/, packages/ ni e2e/', () => {
  const { llamadas, dependencias } = espias({ cambiados: ['docs/features/pagos.md', 'REVIEW.md'] });

  assert.deepEqual(alTerminar(entradaStop(false), dependencias), { codigo: 0 });
  assert.deepEqual(llamadas, ['git status']);
});

test('con cambios de código y typecheck en verde sale con 0', () => {
  const { llamadas, dependencias } = espias({ cambiados: ['packages/shared/src/x.ts'] });

  assert.deepEqual(alTerminar(entradaStop(false), dependencias), { codigo: 0 });
  assert.deepEqual(llamadas, ['git status', 'pnpm typecheck']);
});

test('con typecheck en rojo sale con 2 y las últimas 40 líneas de la salida', () => {
  const lineas = Array.from({ length: 50 }, (_, i) => `línea ${i + 1}`);
  const { dependencias } = espias({
    cambiados: ['apps/web/src/x.tsx'],
    typecheck: { codigo: 2, salida: `${lineas.join('\n')}\n` },
  });

  assert.deepEqual(alTerminar(entradaStop(false), dependencias), {
    codigo: 2,
    mensaje: ['pnpm typecheck falla. Arreglalo antes de terminar:', ...lineas.slice(10)].join('\n'),
  });
});
