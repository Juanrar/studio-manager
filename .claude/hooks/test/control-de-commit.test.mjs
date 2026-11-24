import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { controlarCommit } from '../control-de-commit.mjs';
import {
  RAIZ,
  carpetaTemporal,
  entradaBash,
  escribirEstadoDeSesion,
  escribirModo,
  leerEstadoDeSesion,
  leerRegistro,
} from './ayudantes.mjs';

const CAMBIO = '2026-11-21T10:00:00.000Z';
const ANTES = '2026-11-21T09:00:00.000Z';
const DESPUES = '2026-11-21T11:00:00.000Z';
const AHORA = '2026-11-21T12:00:00.000Z';

const COMMIT_VERIFICADO = `git commit -F - <<'EOF'
feat(pagos): algo

Verificado: pnpm test, pnpm typecheck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF`;

function preparar({ modo = 'observar', estado, enStage = [], cambiados = [] } = {}) {
  const carpeta = carpetaTemporal();
  const archivoDeModo = escribirModo(carpeta, modo);
  if (estado) escribirEstadoDeSesion(carpeta, 'sesion-1', estado);
  const controlar = (comando) =>
    controlarCommit(entradaBash(comando), {
      carpeta,
      archivoDeModo,
      raiz: RAIZ,
      ahora: () => AHORA,
      archivosEnStage: () => enStage,
      archivosCambiados: () => cambiados,
    });
  return { carpeta, controlar };
}

function estadoCon(comandos, bloqueos = 0) {
  return { ultimoCambioDeCodigo: CAMBIO, comandos, bloqueos };
}

test('deja pasar un commit con Verificado: y tests y typecheck posteriores al último cambio', () => {
  const { carpeta, controlar } = preparar({
    modo: 'bloquear',
    estado: estadoCon({ test: DESPUES, typecheck: DESPUES }),
    enStage: ['apps/api/src/modules/pagos/pagos.service.ts'],
  });

  assert.deepEqual(controlar(COMMIT_VERIFICADO), { codigo: 0 });

  assert.deepEqual(leerRegistro(carpeta), [
    {
      hora: AHORA,
      sesion: 'sesion-1',
      agente: null,
      modo: 'bloquear',
      resultado: 'verificado',
      verificado: 'pnpm test, pnpm typecheck',
      faltas: [],
      archivos: ['apps/api/src/modules/pagos/pagos.service.ts'],
    },
  ]);
});

test('marca un commit cuyo pnpm test es anterior al último cambio de código', () => {
  const { carpeta, controlar } = preparar({
    estado: estadoCon({ test: ANTES, typecheck: DESPUES }),
    enStage: ['packages/shared/src/fechas.ts'],
  });

  assert.deepEqual(controlar(COMMIT_VERIFICADO), { codigo: 0 });

  assert.deepEqual(leerRegistro(carpeta), [
    {
      hora: AHORA,
      sesion: 'sesion-1',
      agente: null,
      modo: 'observar',
      resultado: 'observado',
      verificado: 'pnpm test, pnpm typecheck',
      faltas: ['pnpm test no corrió después del último cambio de código'],
      archivos: ['packages/shared/src/fechas.ts'],
    },
  ]);
});

test('marca un commit con código en stage si pnpm test y pnpm typecheck no corrieron nunca', () => {
  const { carpeta, controlar } = preparar({ enStage: ['e2e/mirar.ts'] });

  controlar(COMMIT_VERIFICADO);

  assert.deepEqual(leerRegistro(carpeta)[0].faltas, [
    'pnpm test no corrió después del último cambio de código',
    'pnpm typecheck no corrió después del último cambio de código',
  ]);
});

test('un pnpm --filter X test no reemplaza a pnpm test', () => {
  const { carpeta, controlar } = preparar({
    estado: estadoCon({ 'test --filter @studio/api': DESPUES, typecheck: DESPUES }),
    enStage: ['apps/api/src/app.ts'],
  });

  controlar(COMMIT_VERIFICADO);

  assert.deepEqual(leerRegistro(carpeta)[0].faltas, [
    'pnpm test no corrió después del último cambio de código',
  ]);
});

test('marca un commit sin línea Verificado:', () => {
  const { carpeta, controlar } = preparar({ enStage: ['docs/features/pagos.md'] });

  controlar('git commit -m "docs(pagos): corregir el plan"');

  assert.deepEqual(leerRegistro(carpeta), [
    {
      hora: AHORA,
      sesion: 'sesion-1',
      agente: null,
      modo: 'observar',
      resultado: 'observado',
      verificado: null,
      faltas: ['falta la línea Verificado:'],
      archivos: ['docs/features/pagos.md'],
    },
  ]);
});

test('un commit sin código en stage solo necesita la línea Verificado:', () => {
  const { carpeta, controlar } = preparar({
    modo: 'bloquear',
    enStage: ['docs/features/pagos.md', 'REVIEW.md'],
  });

  assert.deepEqual(
    controlar('git commit -m "docs: algo" -m "Verificado: lectura del diff"'),
    { codigo: 0 },
  );
  assert.equal(leerRegistro(carpeta)[0].resultado, 'verificado');
});

test('deja pasar Verificado: ninguno (motivo) y lo registra', () => {
  const { carpeta, controlar } = preparar({
    modo: 'bloquear',
    enStage: ['apps/web/src/features/agenda/Agenda.tsx'],
  });

  const resultado = controlar(`git commit -F - <<'EOF'
fix(agenda): algo

Verificado: ninguno (Docker no arranca en esta máquina)
EOF`);

  assert.deepEqual(resultado, { codigo: 0 });
  assert.deepEqual(leerRegistro(carpeta), [
    {
      hora: AHORA,
      sesion: 'sesion-1',
      agente: null,
      modo: 'bloquear',
      resultado: 'sin verificar',
      verificado: 'ninguno (Docker no arranca en esta máquina)',
      faltas: [],
      archivos: ['apps/web/src/features/agenda/Agenda.tsx'],
    },
  ]);
});

test('con archivos de apps/web/ en stage, pide pnpm mirar o pnpm e2e posterior al último cambio', () => {
  const enStage = ['apps/web/src/features/agenda/Agenda.tsx'];
  const sinMirar = preparar({ estado: estadoCon({ test: DESPUES, typecheck: DESPUES, mirar: ANTES }), enStage });
  sinMirar.controlar(COMMIT_VERIFICADO);
  assert.deepEqual(leerRegistro(sinMirar.carpeta)[0].faltas, [
    'hay archivos de apps/web/ en stage y ni pnpm mirar ni pnpm e2e corrieron después del último cambio de código',
  ]);

  const conMirar = preparar({ estado: estadoCon({ test: DESPUES, typecheck: DESPUES, mirar: DESPUES }), enStage });
  conMirar.controlar(COMMIT_VERIFICADO);
  assert.deepEqual(leerRegistro(conMirar.carpeta)[0].faltas, []);

  const conE2e = preparar({ estado: estadoCon({ test: DESPUES, typecheck: DESPUES, e2e: DESPUES }), enStage });
  conE2e.controlar(COMMIT_VERIFICADO);
  assert.deepEqual(leerRegistro(conE2e.carpeta)[0].faltas, []);
});

test('en modo observar sale con 0 y escribe en registro.jsonl', () => {
  const { carpeta, controlar } = preparar({ modo: 'observar', enStage: ['apps/api/src/app.ts'] });

  assert.deepEqual(controlar('git commit -m "feat: algo"'), { codigo: 0 });
  assert.equal(leerRegistro(carpeta).length, 1);
});

test('en modo bloquear sale con 2 y explica qué falta', () => {
  const { carpeta, controlar } = preparar({ modo: 'bloquear', enStage: ['apps/api/src/app.ts'] });

  assert.deepEqual(controlar('git commit -m "feat: algo"'), {
    codigo: 2,
    mensaje: [
      'Commit sin verificar (bloqueo 1 de 2 en esta sesión):',
      '- falta la línea Verificado:',
      '- pnpm test no corrió después del último cambio de código',
      '- pnpm typecheck no corrió después del último cambio de código',
      'Corré lo que falta y agregá al mensaje la línea "Verificado: <lo que corriste>", o "Verificado: ninguno (motivo)" si no se puede verificar.',
      'Después de 2 bloqueos en la sesión, el commit siguiente pasa y queda registrado como liberado.',
    ].join('\n'),
  });
  assert.equal(leerRegistro(carpeta)[0].resultado, 'bloqueado');
});

test('en modo apagado no escribe nada', () => {
  const { carpeta, controlar } = preparar({ modo: 'apagado', enStage: ['apps/api/src/app.ts'] });

  assert.deepEqual(controlar('git commit -m "feat: algo"'), { codigo: 0 });
  assert.equal(existsSync(join(carpeta, 'registro.jsonl')), false);
  assert.equal(existsSync(join(carpeta, 'sesion-1.json')), false);
});

test('sin archivo de modo, el control observa', () => {
  const carpeta = carpetaTemporal();
  const resultado = controlarCommit(entradaBash('git commit -m "x"'), {
    carpeta,
    archivoDeModo: join(carpeta, 'no-existe.json'),
    raiz: RAIZ,
    ahora: () => AHORA,
    archivosEnStage: () => [],
    archivosCambiados: () => [],
  });

  assert.deepEqual(resultado, { codigo: 0 });
  assert.equal(leerRegistro(carpeta)[0].modo, 'observar');
});

test('en modo bloquear, el tercer commit de la sesión después de dos bloqueos pasa y queda registrado como liberado', () => {
  const { carpeta, controlar } = preparar({ modo: 'bloquear', enStage: ['apps/api/src/app.ts'] });
  const comando = 'git commit -m "feat: algo" -m "Verificado: pnpm test"';

  assert.equal(controlar(comando).codigo, 2);
  assert.equal(controlar(comando).codigo, 2);
  assert.deepEqual(controlar(comando), { codigo: 0 });

  assert.deepEqual(
    leerRegistro(carpeta).map((entrada) => entrada.resultado),
    ['bloqueado', 'bloqueado', 'liberado'],
  );
  assert.equal(leerEstadoDeSesion(carpeta, 'sesion-1').bloqueos, 0);
  assert.equal(controlar(comando).codigo, 2);
});

test('un commit verificado vuelve a cero los bloqueos', () => {
  const { carpeta, controlar } = preparar({
    modo: 'bloquear',
    estado: estadoCon({ test: DESPUES, typecheck: DESPUES }, 1),
    enStage: ['apps/api/src/app.ts'],
  });

  assert.deepEqual(controlar(COMMIT_VERIFICADO), { codigo: 0 });
  assert.equal(leerEstadoDeSesion(carpeta, 'sesion-1').bloqueos, 0);
});

test('lee el mensaje de git commit -F archivo', () => {
  const { carpeta, controlar } = preparar({ modo: 'bloquear', enStage: ['README.md'] });
  const archivo = join(carpeta, 'mensaje.txt');
  writeFileSync(archivo, 'docs: algo\n\nVerificado: ninguno (solo documentación)\n');

  assert.deepEqual(controlar(`git commit -F "${archivo}"`), { codigo: 0 });
  assert.equal(leerRegistro(carpeta)[0].verificado, 'ninguno (solo documentación)');
});

test('suma los archivos de un git add del mismo comando, y con git add -A usa git status', () => {
  const conRutas = preparar({ enStage: ['README.md'] });
  conRutas.controlar('git add apps/web/src/x.tsx docs/x.md && git commit -m "x" -m "Verificado: ninguno (prueba)"');
  assert.deepEqual(leerRegistro(conRutas.carpeta)[0].archivos, [
    'README.md',
    'apps/web/src/x.tsx',
    'docs/x.md',
  ]);

  const conTodo = preparar({ enStage: [], cambiados: ['apps/api/src/app.ts', 'docs/x.md'] });
  conTodo.controlar('git add -A; git commit -m "x" -m "Verificado: ninguno (prueba)"');
  assert.deepEqual(leerRegistro(conTodo.carpeta)[0].archivos, ['apps/api/src/app.ts', 'docs/x.md']);

  const conA = preparar({ enStage: [], cambiados: ['apps/api/src/app.ts'] });
  conA.controlar('git commit -am "x"');
  assert.deepEqual(leerRegistro(conA.carpeta)[0].archivos, ['apps/api/src/app.ts']);
});

test('ignora comandos que no son un commit', () => {
  const { carpeta, controlar } = preparar({ modo: 'bloquear', enStage: ['apps/api/src/app.ts'] });

  assert.deepEqual(controlar('git status && git log --oneline -5'), { codigo: 0 });
  assert.deepEqual(controlar('echo "git commit -m x"'), { codigo: 0 });
  assert.deepEqual(controlar('git commit-tree abc'), { codigo: 0 });
  assert.equal(existsSync(join(carpeta, 'registro.jsonl')), false);
});
