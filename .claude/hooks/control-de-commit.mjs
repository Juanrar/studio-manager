import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  agregarAlRegistro,
  ahoraIso,
  archivoDeModo,
  carpetaDeEstado,
  correrHook,
  esRutaDeCodigo,
  esRutaDeWeb,
  guardarEstado,
  leerEstado,
  leerModo,
  partirEnComandos,
  rutaRelativa,
  sinAsignaciones,
} from './estado.mjs';

const BLOQUEOS_ANTES_DE_LIBERAR = 2;
const OPCIONES_GLOBALES_DE_GIT_CON_VALOR = ['-C', '-c', '--git-dir', '--work-tree', '--namespace'];
const OPCIONES_DE_COMMIT_CON_VALOR = ['-C', '-c', '-t', '--template', '--author', '--date', '--fixup', '--squash', '--cleanup'];
const ADD_DE_TODO = ['-A', '--all', '.', '-u', '--update', ':/'];

function subcomandoDeGit(palabras) {
  if (palabras[0] !== 'git') return null;
  let i = 1;
  while (i < palabras.length && palabras[i].startsWith('-')) {
    i += OPCIONES_GLOBALES_DE_GIT_CON_VALOR.includes(palabras[i]) ? 2 : 1;
  }
  return i < palabras.length ? { nombre: palabras[i], argumentos: palabras.slice(i + 1) } : null;
}

function leerCommit(argumentos) {
  const mensajes = [];
  const rutas = [];
  let archivo = null;
  let todos = false;
  for (let i = 0; i < argumentos.length; i++) {
    const argumento = argumentos[i];
    if (argumento === '--') {
      rutas.push(...argumentos.slice(i + 1));
      break;
    }
    if (argumento === '--message' || argumento === '--file') {
      if (argumento === '--message') mensajes.push(argumentos[i + 1] ?? '');
      else archivo = argumentos[i + 1] ?? null;
      i++;
    } else if (argumento.startsWith('--message=')) {
      mensajes.push(argumento.slice('--message='.length));
    } else if (argumento.startsWith('--file=')) {
      archivo = argumento.slice('--file='.length);
    } else if (argumento === '--all') {
      todos = true;
    } else if (OPCIONES_DE_COMMIT_CON_VALOR.includes(argumento)) {
      i++;
    } else if (/^-[a-zA-Z]+$/.test(argumento)) {
      const letras = argumento.slice(1);
      if (letras.includes('a')) todos = true;
      const ultima = letras[letras.length - 1];
      if (ultima === 'm') {
        mensajes.push(argumentos[i + 1] ?? '');
        i++;
      } else if (ultima === 'F') {
        archivo = argumentos[i + 1] ?? null;
        i++;
      }
    } else if (!argumento.startsWith('-')) {
      rutas.push(argumento);
    }
  }
  return { mensajes, archivo, todos, rutas };
}

function leerAdd(argumentos) {
  const todos = argumentos.some((argumento) => ADD_DE_TODO.includes(argumento) || argumento.includes('*'));
  const rutas = argumentos.filter((argumento) => !argumento.startsWith('-'));
  return { todos, rutas };
}

export function buscarCommit(comando) {
  const segmentos = partirEnComandos(comando);
  const agregados = { todos: false, rutas: [] };
  for (const segmento of segmentos) {
    const subcomando = subcomandoDeGit(sinAsignaciones(segmento.palabras));
    if (subcomando?.nombre === 'add') {
      const add = leerAdd(subcomando.argumentos);
      agregados.todos ||= add.todos;
      agregados.rutas.push(...add.rutas);
    }
    if (subcomando?.nombre === 'commit') {
      return { ...leerCommit(subcomando.argumentos), heredocs: segmento.heredocs, agregados };
    }
  }
  return null;
}

function mensajeDelCommit(commit, comando, raiz, leerArchivo) {
  if (commit.archivo === '-') return commit.heredocs.length > 0 ? commit.heredocs.join('\n') : comando;
  if (commit.archivo) {
    try {
      return leerArchivo(isAbsolute(commit.archivo) ? commit.archivo : join(raiz, commit.archivo));
    } catch {
      return '';
    }
  }
  return commit.mensajes.join('\n\n');
}

export function lineaVerificado(mensaje) {
  const encontrada = mensaje.match(/^[ \t]*Verificado:[ \t]*(.*?)[ \t]*$/m);
  return encontrada && encontrada[1] !== '' ? encontrada[1] : null;
}

function archivosDelCommit(commit, raiz, archivosEnStage, archivosCambiados) {
  const todos = commit.todos || commit.agregados.todos;
  const rutas = [
    ...archivosEnStage(),
    ...[...commit.agregados.rutas, ...commit.rutas].map((ruta) => rutaRelativa(raiz, ruta)).filter(Boolean),
    ...(todos ? archivosCambiados() : []),
  ];
  return [...new Set(rutas)];
}

function corrioDespues(estado, comandos) {
  const desde = estado.ultimoCambioDeCodigo;
  return comandos.some((comando) => {
    const hora = estado.comandos[comando];
    return hora !== undefined && (desde === null || hora > desde);
  });
}

function faltasDelCommit(verificado, archivos, estado) {
  const faltas = [];
  if (verificado === null) faltas.push('falta la línea Verificado:');
  if (archivos.some(esRutaDeCodigo)) {
    if (!corrioDespues(estado, ['test'])) faltas.push('pnpm test no corrió después del último cambio de código');
    if (!corrioDespues(estado, ['typecheck'])) faltas.push('pnpm typecheck no corrió después del último cambio de código');
  }
  if (archivos.some(esRutaDeWeb) && !corrioDespues(estado, ['mirar', 'e2e'])) {
    faltas.push('hay archivos de apps/web/ en stage y ni pnpm mirar ni pnpm e2e corrieron después del último cambio de código');
  }
  return faltas;
}

function explicacion(faltas, bloqueo) {
  return [
    `Commit sin verificar (bloqueo ${bloqueo} de ${BLOQUEOS_ANTES_DE_LIBERAR} en esta sesión):`,
    ...faltas.map((falta) => `- ${falta}`),
    'Corré lo que falta y agregá al mensaje la línea "Verificado: <lo que corriste>", o "Verificado: ninguno (motivo)" si no se puede verificar.',
    `Después de ${BLOQUEOS_ANTES_DE_LIBERAR} bloqueos en la sesión, el commit siguiente pasa y queda registrado como liberado.`,
  ].join('\n');
}

function decidir(modo, verificado, faltas, bloqueos) {
  if (verificado !== null && /^ninguno\b/i.test(verificado)) return 'sin verificar';
  if (faltas.length === 0) return 'verificado';
  if (modo === 'observar') return 'observado';
  return bloqueos >= BLOQUEOS_ANTES_DE_LIBERAR ? 'liberado' : 'bloqueado';
}

export function controlarCommit(
  entrada,
  { carpeta, archivoDeModo: archivoDelModo, raiz, ahora, archivosEnStage, archivosCambiados, leerArchivo = (ruta) => readFileSync(ruta, 'utf8') },
) {
  const comando = entrada.tool_input?.command ?? '';
  const commit = entrada.tool_name === 'Bash' ? buscarCommit(comando) : null;
  if (commit === null) return { codigo: 0 };
  const modo = leerModo(archivoDelModo);
  if (modo === 'apagado') return { codigo: 0 };

  const sesion = entrada.session_id;
  const estado = leerEstado(carpeta, sesion);
  const verificado = lineaVerificado(mensajeDelCommit(commit, comando, raiz, leerArchivo));
  const archivos = archivosDelCommit(commit, raiz, archivosEnStage, archivosCambiados);
  const faltas = faltasDelCommit(verificado, archivos, estado);
  const resultado = decidir(modo, verificado, faltas, estado.bloqueos);

  agregarAlRegistro(carpeta, {
    hora: ahora(),
    sesion: sesion ?? null,
    agente: entrada.agent_id ?? null,
    modo,
    resultado,
    verificado,
    faltas: resultado === 'sin verificar' ? [] : faltas,
    archivos,
  });

  if (resultado === 'bloqueado') {
    const bloqueos = estado.bloqueos + 1;
    guardarEstado(carpeta, sesion, { ...estado, bloqueos });
    return { codigo: 2, mensaje: explicacion(faltas, bloqueos) };
  }
  if (modo === 'bloquear' && estado.bloqueos !== 0 && resultado !== 'sin verificar') {
    guardarEstado(carpeta, sesion, { ...estado, bloqueos: 0 });
  }
  return { codigo: 0 };
}

function git(raiz, argumentos) {
  try {
    return execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

export function archivosEnStageDeGit(raiz) {
  return git(raiz, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
}

export function archivosCambiadosDeGit(raiz) {
  const partes = git(raiz, ['status', '--porcelain', '-z', '-uall']).split('\0').filter(Boolean);
  const rutas = [];
  for (let i = 0; i < partes.length; i++) {
    const estado = partes[i].slice(0, 2);
    rutas.push(partes[i].slice(3));
    if (estado.includes('R') || estado.includes('C')) i++;
  }
  return rutas;
}

correrHook(import.meta.url, (entrada, raiz) =>
  controlarCommit(entrada, {
    carpeta: carpetaDeEstado(raiz),
    archivoDeModo: archivoDeModo(raiz),
    raiz,
    ahora: ahoraIso,
    archivosEnStage: () => archivosEnStageDeGit(raiz),
    archivosCambiados: () => archivosCambiadosDeGit(raiz),
  }),
);
