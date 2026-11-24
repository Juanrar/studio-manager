import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, type Page } from '@playwright/test';
import { periodoDe } from '@studio/shared';
import { buscarDatosDeEjemplo, cargarDatosDeEjemplo, entrarALaApi, RECEPCION_DE_EJEMPLO, type DatosDeEjemplo } from './datos-de-ejemplo.ts';
import { ADMIN_E2E, URL_BASE_E2E } from './entorno.ts';
import { prepararBase } from './preparar.ts';

const PUERTO_MIRAR = 3101;
const URL_BASE = `http://127.0.0.1:${PUERTO_MIRAR}`;
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CAPTURAS = fileURLToPath(new URL('capturas', import.meta.url));
const ESPERA_DE_LA_API_MS = 60_000;

const USO = `Uso: pnpm mirar <ruta> [<ruta>...] [--rol admin|recepcion] [--ancho <px>] [--sin-preparar]

Las rutas aceptan :alumno, :alumno-sin-pack, :profesor y :clase, que se cambian por los ids de los datos de ejemplo,
y :periodo, que se cambia por el mes de hoy (AAAA-MM).
Ejemplo: pnpm mirar /alumnos /alumnos/:alumno "/liquidaciones?periodo=:periodo" --rol admin`;

type Rol = 'admin' | 'recepcion';

type Opciones = { rutas: string[]; rol: Rol; ancho: number; sinPreparar: boolean };

type ResultadoDeRuta = {
  pedida: string;
  final: string;
  titulo: string | null;
  capturas: string[];
  errores: string[];
};

function salirConUso(motivo: string): never {
  console.error(`${motivo}\n\n${USO}`);
  process.exit(2);
}

function leerOpciones(): Opciones {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rol: { type: 'string', default: 'admin' },
      ancho: { type: 'string', default: '1280' },
      'sin-preparar': { type: 'boolean', default: false },
    },
  });
  const rutas = positionals.filter((argumento) => argumento !== '--');
  if (rutas.length === 0) salirConUso('Falta al menos una ruta.');
  for (const ruta of rutas) {
    if (/^[A-Za-z]:[\\/]/.test(ruta)) {
      salirConUso(`"${ruta}" parece una ruta de Windows: Git Bash convirtió la ruta. Corré con MSYS_NO_PATHCONV=1 o escribila sin la barra inicial.`);
    }
  }
  if (values.rol !== 'admin' && values.rol !== 'recepcion') salirConUso(`El rol "${values.rol}" no existe.`);
  const ancho = Number(values.ancho);
  if (!Number.isInteger(ancho) || ancho < 320) salirConUso(`El ancho "${values.ancho}" tiene que ser un entero de 320 o más.`);
  return { rutas: rutas.map((ruta) => (ruta.startsWith('/') ? ruta : `/${ruta}`)), rol: values.rol, ancho, sinPreparar: values['sin-preparar'] };
}

function reemplazarMarcas(ruta: string, datos: DatosDeEjemplo): string {
  const valores: Record<string, string | number | null> = {
    ':periodo': periodoDe(datos.hoy),
    ':alumno-sin-pack': datos.alumnos.sinPack,
    ':alumno': datos.alumnos.conPackX8,
    ':profesor': datos.profesorId,
    ':clase': datos.claseDeHoyId,
  };
  let resultado = ruta;
  for (const [marca, valor] of Object.entries(valores)) {
    if (!resultado.includes(marca)) continue;
    if (valor === null) throw new Error(`La ruta ${ruta} usa ${marca}, pero la base no tiene una clase de ejemplo para hoy. Corré sin --sin-preparar.`);
    resultado = resultado.replaceAll(marca, String(valor));
  }
  return resultado;
}

async function apiResponde(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${URL_BASE}/api/health`);
    return respuesta.ok;
  } catch {
    return false;
  }
}

function levantarApi(salida: string[]): ChildProcess {
  const enWindows = process.platform === 'win32';
  const api = spawn('pnpm --filter @studio/api start', {
    cwd: RAIZ,
    shell: true,
    detached: !enWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATABASE_URL: URL_BASE_E2E, PORT: String(PUERTO_MIRAR), WEB_DIST: '../web/dist' },
  });
  const guardar = (parte: Buffer) => salida.push(...parte.toString().split(/\r?\n/).filter((linea) => linea.length > 0));
  api.stdout?.on('data', guardar);
  api.stderr?.on('data', guardar);
  return api;
}

function cerrarApi(api: ChildProcess | null): void {
  if (api === null || api.pid === undefined) return;
  try {
    if (process.platform !== 'win32') process.kill(-api.pid, 'SIGTERM');
    else if (api.exitCode === null) execSync(`taskkill /pid ${api.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    return;
  }
}

async function esperarApi(api: ChildProcess, salida: string[]): Promise<void> {
  const limite = Date.now() + ESPERA_DE_LA_API_MS;
  while (Date.now() < limite) {
    if (api.exitCode !== null) throw new Error(`La API terminó antes de responder:\n${salida.slice(-30).join('\n')}`);
    if (await apiResponde()) return;
    await new Promise((listo) => setTimeout(listo, 250));
  }
  throw new Error(`La API no respondió en ${ESPERA_DE_LA_API_MS / 1000} s:\n${salida.slice(-30).join('\n')}`);
}

function nombreDeCaptura(rol: Rol, ruta: string, sufijo = ''): string {
  const limpia = ruta.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inicio';
  return `${CAPTURAS}/${rol}-${limpia}${sufijo}.png`;
}

async function bajarHastaElFinal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const conScroll = [...document.querySelectorAll<HTMLElement>('.overflow-auto')].filter(
      (elemento) => elemento.scrollHeight > elemento.clientHeight + 1,
    );
    for (const elemento of conScroll) elemento.scrollTop = elemento.scrollHeight;
    return conScroll.length > 0;
  });
}

async function mirarRutas(opciones: Opciones, datos: DatosDeEjemplo): Promise<ResultadoDeRuta[]> {
  const navegador = await chromium.launch();
  try {
    const contexto = await navegador.newContext({
      baseURL: URL_BASE,
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
      viewport: { width: opciones.ancho, height: 800 },
    });
    const credenciales = opciones.rol === 'admin' ? ADMIN_E2E : RECEPCION_DE_EJEMPLO;
    const login = await contexto.request.post('/api/auth/login', { data: { email: credenciales.email, password: credenciales.password } });
    if (!login.ok()) throw new Error(`No se pudo entrar como ${opciones.rol}: ${login.status()}`);

    const page = await contexto.newPage();
    let errores: string[] = [];
    const primeraLinea = (texto: string) => texto.split('\n')[0] ?? texto;
    page.on('pageerror', (error) => errores.push(`error de página: ${primeraLinea(error.message)}`));
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error' && !mensaje.text().startsWith('Failed to load resource')) errores.push(`consola: ${primeraLinea(mensaje.text())}`);
    });
    page.on('requestfailed', (pedido) => {
      const url = new URL(pedido.url());
      errores.push(`pedido fallido: ${pedido.method()} ${url.pathname}${url.search} (${pedido.failure()?.errorText ?? 'sin detalle'})`);
    });
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400) {
        const url = new URL(respuesta.url());
        errores.push(`respuesta ${respuesta.status()}: ${respuesta.request().method()} ${url.pathname}${url.search}`);
      }
    });

    const resultados: ResultadoDeRuta[] = [];
    for (const pedida of opciones.rutas) {
      errores = [];
      const ruta = reemplazarMarcas(pedida, datos);
      await page.goto(ruta, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const url = new URL(page.url());
      const titulo = await page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => null);
      const capturas = [nombreDeCaptura(opciones.rol, ruta)];
      await page.screenshot({ path: capturas[0]!, fullPage: true });
      if (await bajarHastaElFinal(page)) {
        const abajo = nombreDeCaptura(opciones.rol, ruta, '-abajo');
        await page.screenshot({ path: abajo, fullPage: true });
        capturas.push(abajo);
      }
      resultados.push({ pedida: ruta, final: `${url.pathname}${url.search}`, titulo: titulo?.trim() ?? null, capturas, errores });
    }
    return resultados;
  } finally {
    await navegador.close();
  }
}

function imprimirResumen(opciones: Opciones, datos: DatosDeEjemplo, resultados: ResultadoDeRuta[], inicio: number): void {
  const { alumnos } = datos;
  console.log(`\nDatos de ejemplo (hoy ${datos.hoy}): profesora Fernández ${datos.profesorId}; alumnos García ${alumnos.conPackX8} (Pack x8), López ${alumnos.conPackX4} (Pack x4), Pérez ${alumnos.sinPackConClaseSuelta} (clase suelta), Díaz ${alumnos.sinPack} (sin pack); clase de hoy ${datos.claseDeHoyId ?? 'ninguna'}`);
  console.log(`Rol ${opciones.rol}, ancho ${opciones.ancho} px\n`);
  for (const resultado of resultados) {
    const estado = resultado.errores.length === 0 ? 'OK   ' : 'ERROR';
    const redirige = resultado.final === resultado.pedida ? '' : ` -> redirigió a ${resultado.final}`;
    console.log(`${estado} ${resultado.pedida}${redirige}  título: ${resultado.titulo ?? '(sin h1)'}`);
    for (const captura of resultado.capturas) console.log(`      captura: ${relative(RAIZ, captura).replaceAll('\\', '/')}`);
    for (const error of resultado.errores) console.log(`      ${error}`);
  }
  const conErrores = resultados.filter((resultado) => resultado.errores.length > 0).length;
  console.log(`\n${resultados.length} rutas, ${conErrores} con errores, ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
}

function vaciarCapturas(): void {
  mkdirSync(CAPTURAS, { recursive: true });
  for (const archivo of readdirSync(CAPTURAS)) rmSync(`${CAPTURAS}/${archivo}`, { force: true });
}

async function obtenerDatosDeEjemplo(opciones: Opciones): Promise<DatosDeEjemplo> {
  try {
    const admin = await entrarALaApi(URL_BASE, ADMIN_E2E);
    return (await buscarDatosDeEjemplo(admin)) ?? (await cargarDatosDeEjemplo(URL_BASE));
  } catch (error) {
    if (!opciones.sinPreparar) throw error;
    const motivo = error instanceof Error ? error.message : String(error);
    throw new Error(`${motivo}\nLa base puede tener datos de ejemplo a medio cargar. Corré sin --sin-preparar para recrearla.`);
  }
}

async function main(): Promise<number> {
  const inicio = Date.now();
  const opciones = leerOpciones();
  if (await apiResponde()) throw new Error(`El puerto ${PUERTO_MIRAR} ya responde. Buscá el proceso con netstat -ano y cerralo si es de este proyecto.`);

  if (!opciones.sinPreparar) await prepararBase({ compilarWeb: true });
  vaciarCapturas();

  const salida: string[] = [];
  let api: ChildProcess | null = null;
  const alInterrumpir = (senal: NodeJS.Signals) => {
    cerrarApi(api);
    process.exit(senal === 'SIGINT' ? 130 : 143);
  };
  const senales: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const senal of senales) process.on(senal, alInterrumpir);
  try {
    api = levantarApi(salida);
    await esperarApi(api, salida);
    const datos = await obtenerDatosDeEjemplo(opciones);
    const resultados = await mirarRutas(opciones, datos);
    imprimirResumen(opciones, datos, resultados, inicio);
    return resultados.some((resultado) => resultado.errores.length > 0) ? 1 : 0;
  } finally {
    cerrarApi(api);
    for (const senal of senales) process.off(senal, alInterrumpir);
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
