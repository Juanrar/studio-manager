import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODOS = ['apagado', 'observar', 'bloquear'];
export const COMANDOS_DE_VERIFICACION = ['test', 'typecheck', 'e2e', 'mirar'];
const CARPETAS_DE_CODIGO = ['apps', 'packages', 'e2e'];

function estadoVacio() {
  return { ultimoCambioDeCodigo: null, comandos: {}, bloqueos: 0 };
}

function archivoDeSesion(carpeta, sesion) {
  const nombre = String(sesion ?? 'sin-sesion').replace(/[^A-Za-z0-9_-]/g, '_');
  return join(carpeta, `${nombre}.json`);
}

export function leerEstado(carpeta, sesion) {
  const archivo = archivoDeSesion(carpeta, sesion);
  if (!existsSync(archivo)) return estadoVacio();
  try {
    return { ...estadoVacio(), ...JSON.parse(readFileSync(archivo, 'utf8')) };
  } catch {
    return estadoVacio();
  }
}

export function guardarEstado(carpeta, sesion, estado) {
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(archivoDeSesion(carpeta, sesion), `${JSON.stringify(estado, null, 2)}\n`);
}

export function leerModo(archivo) {
  try {
    const { modo } = JSON.parse(readFileSync(archivo, 'utf8'));
    return MODOS.includes(modo) ? modo : 'observar';
  } catch {
    return 'observar';
  }
}

export function agregarAlRegistro(carpeta, entrada) {
  mkdirSync(carpeta, { recursive: true });
  appendFileSync(join(carpeta, 'registro.jsonl'), `${JSON.stringify(entrada)}\n`);
}

function normalizarRuta(ruta) {
  return ruta.replace(/\\/g, '/').replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\/+$/, '');
}

function esAbsoluta(ruta) {
  return ruta.startsWith('/') || /^[a-zA-Z]:\//.test(ruta);
}

export function rutaRelativa(raiz, archivo) {
  const ruta = normalizarRuta(archivo);
  if (!esAbsoluta(ruta)) return ruta.replace(/^(\.\/)+/, '');
  const base = `${normalizarRuta(raiz)}/`;
  if (!ruta.toLowerCase().startsWith(base.toLowerCase())) return null;
  return ruta.slice(base.length);
}

export function esRutaDeCodigo(relativa) {
  return CARPETAS_DE_CODIGO.includes(relativa.split('/')[0]);
}

export function esRutaDeWeb(relativa) {
  const [primera, segunda] = relativa.split('/');
  return primera === 'apps' && segunda === 'web';
}

function esSeparador(texto, i) {
  const c = texto[i];
  if (c === ';' || c === '\n' || c === '|') return true;
  return c === '&';
}

export function partirEnComandos(texto) {
  const segmentos = [];
  let palabras = [];
  let heredocs = [];
  let palabra = '';
  let enPalabra = false;
  let pendientes = [];
  let i = 0;

  const cerrarPalabra = () => {
    if (enPalabra) palabras.push(palabra);
    palabra = '';
    enPalabra = false;
  };
  const cerrarSegmento = () => {
    cerrarPalabra();
    if (palabras.length > 0 || heredocs.length > 0) segmentos.push({ palabras, heredocs });
    palabras = [];
    heredocs = [];
  };
  const leerCuerpos = () => {
    for (const { delimitador, recortar, destino } of pendientes) {
      const lineas = [];
      while (i < texto.length) {
        const fin = texto.indexOf('\n', i);
        const linea = texto.slice(i, fin === -1 ? texto.length : fin).replace(/\r$/, '');
        i = fin === -1 ? texto.length : fin + 1;
        if ((recortar ? linea.replace(/^\t+/, '') : linea) === delimitador) break;
        lineas.push(linea);
      }
      destino.push(lineas.join('\n'));
    }
    pendientes = [];
  };

  while (i < texto.length) {
    const c = texto[i];
    if (c === "'") {
      const fin = texto.indexOf("'", i + 1);
      palabra += texto.slice(i + 1, fin === -1 ? texto.length : fin);
      enPalabra = true;
      i = fin === -1 ? texto.length : fin + 1;
    } else if (c === '"') {
      i++;
      while (i < texto.length && texto[i] !== '"') {
        if (texto[i] === '\\' && i + 1 < texto.length && '"\\$`'.includes(texto[i + 1])) i++;
        palabra += texto[i];
        i++;
      }
      enPalabra = true;
      i++;
    } else if (c === '\\') {
      if (texto[i + 1] !== '\n') {
        palabra += texto[i + 1] ?? '';
        enPalabra = true;
      }
      i += 2;
    } else if (c === '#' && !enPalabra) {
      while (i < texto.length && texto[i] !== '\n') i++;
    } else if (c === '<' && texto[i + 1] === '<' && texto[i + 2] !== '<') {
      cerrarPalabra();
      i += 2;
      const recortar = texto[i] === '-';
      if (recortar) i++;
      while (texto[i] === ' ' || texto[i] === '\t') i++;
      let delimitador = '';
      while (i < texto.length && !/[\s;&|<>]/.test(texto[i])) {
        if (texto[i] !== "'" && texto[i] !== '"') delimitador += texto[i];
        i++;
      }
      pendientes.push({ delimitador, recortar, destino: heredocs });
    } else if (c === '&' && (palabra.endsWith('>') || palabra.endsWith('<'))) {
      palabra += c;
      i++;
    } else if (esSeparador(texto, i)) {
      const esNuevaLinea = c === '\n';
      i += texto[i + 1] === c && c !== '\n' && c !== ';' ? 2 : 1;
      if (esNuevaLinea && pendientes.length > 0) {
        cerrarPalabra();
        leerCuerpos();
      }
      cerrarSegmento();
    } else if (c === ' ' || c === '\t' || c === '\r') {
      cerrarPalabra();
      i++;
    } else {
      palabra += c;
      enPalabra = true;
      i++;
    }
  }
  if (pendientes.length > 0) {
    cerrarPalabra();
    leerCuerpos();
  }
  cerrarSegmento();
  return segmentos;
}

export function sinAsignaciones(palabras) {
  let i = 0;
  while (i < palabras.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(palabras[i])) i++;
  return palabras.slice(i);
}

const OPCIONES_DE_PNPM_CON_VALOR = ['--filter', '-F', '-C', '--dir'];

function comandoDePnpm(palabras) {
  if (palabras[0] !== 'pnpm') return null;
  const filtros = [];
  let recursivo = false;
  let script = null;
  for (let i = 1; i < palabras.length; i++) {
    const palabra = palabras[i];
    if (OPCIONES_DE_PNPM_CON_VALOR.includes(palabra)) {
      filtros.push(palabra === '-C' || palabra === '--dir' ? `--dir ${palabras[i + 1]}` : `--filter ${palabras[i + 1]}`);
      i++;
    } else if (palabra.startsWith('--filter=') || palabra.startsWith('--dir=')) {
      const [opcion, valor] = palabra.split(/=(.*)/);
      filtros.push(`${opcion} ${valor}`);
    } else if (palabra === '-r' || palabra === '--recursive') {
      recursivo = true;
    } else if (palabra === '--') {
      if (script) break;
    } else if (palabra.startsWith('-')) {
      continue;
    } else if (script === null && palabra === 'run') {
      continue;
    } else if (script === null) {
      script = palabra;
    }
  }
  if (!COMANDOS_DE_VERIFICACION.includes(script)) return null;
  return [script, ...filtros, ...(recursivo ? ['-r'] : [])].join(' ');
}

export function comandosDeVerificacion(texto) {
  return partirEnComandos(texto)
    .map(({ palabras }) => comandoDePnpm(sinAsignaciones(palabras)))
    .filter((comando) => comando !== null);
}

export function correrHook(url, hook) {
  const llamado = process.argv[1];
  if (!llamado) return;
  const igualar = (ruta) => resolve(ruta).replace(/\\/g, '/').toLowerCase();
  if (igualar(llamado) !== igualar(fileURLToPath(url))) return;
  let entrada = {};
  try {
    entrada = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    entrada = {};
  }
  const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
  const { codigo, mensaje } = hook(entrada, raiz);
  if (mensaje) process.stderr.write(`${mensaje}\n`);
  process.exitCode = codigo;
}

export function carpetaDeEstado(raiz) {
  return join(raiz, '.claude', 'verificacion');
}

export function archivoDeModo(raiz) {
  return join(raiz, '.claude', 'verificacion.json');
}

export function ahoraIso() {
  return new Date().toISOString();
}
