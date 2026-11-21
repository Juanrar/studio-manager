import { ADMIN_E2E } from './entorno.ts';

export const RECEPCION_DE_EJEMPLO = { email: 'recepcion@estudio.test', password: 'clave-recepcion-segura', nombre: 'Recepción Ejemplo' };

export type DatosDeEjemplo = {
  hoy: string;
  profesorId: number;
  alumnos: { conPackX8: number; conPackX4: number; sinPackConClaseSuelta: number; sinPack: number };
  claseDeHoyId: number | null;
};

type Pedido = { metodo?: 'GET' | 'POST'; cuerpo?: unknown };

export type ClienteApi = <T>(ruta: string, pedido?: Pedido) => Promise<T>;

export async function entrarALaApi(urlBase: string, credenciales: { email: string; password: string }): Promise<ClienteApi> {
  const login = await fetch(`${urlBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credenciales),
  });
  if (!login.ok) throw new Error(`No se pudo entrar a la API como ${credenciales.email}: ${login.status} ${await login.text()}`);
  const cookie = login.headers.getSetCookie().map((valor) => valor.split(';')[0]).join('; ');

  return async <T>(ruta: string, { metodo = 'GET', cuerpo }: Pedido = {}): Promise<T> => {
    const respuesta = await fetch(`${urlBase}${ruta}`, {
      method: metodo,
      headers: { cookie, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
    if (!respuesta.ok) throw new Error(`${metodo} ${ruta} respondió ${respuesta.status}: ${await respuesta.text()}`);
    return (await respuesta.json()) as T;
  };
}

type ConId = { id: number };
type Pack = ConId & { nombre: string };
type Persona = ConId & { nombre: string; apellido: string };
type Clase = ConId & { fecha: string; estilo: string; profesor: Persona };

const PROFESOR = { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000, aliasCbu: 'lucia.fernandez.mp' };

const ALUMNOS = {
  conPackX8: { nombre: 'Martina', apellido: 'García', telefono: '11 5555-0101' },
  conPackX4: { nombre: 'Sofía', apellido: 'López', email: 'sofia.lopez@correo.test' },
  sinPackConClaseSuelta: { nombre: 'Joaquín', apellido: 'Pérez' },
  sinPack: { nombre: 'Tomás', apellido: 'Díaz' },
} as const;

const ESTILO_DE_HOY = 'Hip-Hop';

function diaSemanaIso(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const diaUtc = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaUtc === 0 ? 7 : diaUtc;
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

async function hoyDeLaApi(api: ClienteApi): Promise<string> {
  const { hoy } = await api<{ hoy: string }>('/api/alumnos?porPagina=1');
  return hoy;
}

async function claseDeHoy(api: ClienteApi, hoy: string, profesorId: number): Promise<number | null> {
  const { items } = await api<{ items: Clase[] }>(`/api/clases?desde=${hoy}&hasta=${hoy}`);
  return items.find((clase) => clase.estilo === ESTILO_DE_HOY && clase.profesor.id === profesorId)?.id ?? null;
}

async function buscarAlumno(api: ClienteApi, datos: { nombre: string; apellido: string }): Promise<number> {
  const { items } = await api<{ items: Persona[] }>(`/api/alumnos?q=${encodeURIComponent(datos.apellido)}&porPagina=100`);
  const alumno = items.find((item) => item.nombre === datos.nombre && item.apellido === datos.apellido);
  if (alumno === undefined) throw new Error(`Falta el alumno de ejemplo ${datos.nombre} ${datos.apellido}`);
  return alumno.id;
}

export async function buscarDatosDeEjemplo(api: ClienteApi): Promise<DatosDeEjemplo | null> {
  const { items } = await api<{ items: Persona[] }>('/api/profesores?incluirInactivos=true');
  const profesor = items.find((item) => item.nombre === PROFESOR.nombre && item.apellido === PROFESOR.apellido);
  if (profesor === undefined) return null;
  const hoy = await hoyDeLaApi(api);
  return {
    hoy,
    profesorId: profesor.id,
    alumnos: {
      conPackX8: await buscarAlumno(api, ALUMNOS.conPackX8),
      conPackX4: await buscarAlumno(api, ALUMNOS.conPackX4),
      sinPackConClaseSuelta: await buscarAlumno(api, ALUMNOS.sinPackConClaseSuelta),
      sinPack: await buscarAlumno(api, ALUMNOS.sinPack),
    },
    claseDeHoyId: await claseDeHoy(api, hoy, profesor.id),
  };
}

export async function cargarDatosDeEjemplo(urlBase: string): Promise<DatosDeEjemplo> {
  const api = await entrarALaApi(urlBase, ADMIN_E2E);
  const hoy = await hoyDeLaApi(api);

  await api('/api/usuarios', { metodo: 'POST', cuerpo: { ...RECEPCION_DE_EJEMPLO, rol: 'recepcion' } });

  const profesor = await api<ConId>('/api/profesores', { metodo: 'POST', cuerpo: PROFESOR });
  await api('/api/horarios', {
    metodo: 'POST',
    cuerpo: { estilo: ESTILO_DE_HOY, nivel: 'Inicial', diaSemana: diaSemanaIso(hoy), horaInicio: '19:00', horaFin: '20:30', profesorId: profesor.id },
  });
  await api('/api/horarios', {
    metodo: 'POST',
    cuerpo: { estilo: 'Contemporáneo', diaSemana: diaSemanaIso(sumarDias(hoy, 1)), horaInicio: '18:00', horaFin: '19:30', profesorId: profesor.id },
  });

  const { items: packs } = await api<{ items: Pack[] }>('/api/packs');
  const packLlamado = (nombre: string) => {
    const pack = packs.find((item) => item.nombre === nombre);
    if (pack === undefined) throw new Error(`Falta el pack ${nombre}: la base no tiene el seed`);
    return pack.id;
  };

  const crearAlumno = (datos: object) => api<ConId>('/api/alumnos', { metodo: 'POST', cuerpo: datos });
  const alumnos = {
    conPackX8: (await crearAlumno(ALUMNOS.conPackX8)).id,
    conPackX4: (await crearAlumno(ALUMNOS.conPackX4)).id,
    sinPackConClaseSuelta: (await crearAlumno(ALUMNOS.sinPackConClaseSuelta)).id,
    sinPack: (await crearAlumno(ALUMNOS.sinPack)).id,
  };

  await api('/api/pagos', { metodo: 'POST', cuerpo: { alumnoId: alumnos.conPackX8, packId: packLlamado('Pack x8'), medio: 'efectivo' } });
  await api('/api/pagos', { metodo: 'POST', cuerpo: { alumnoId: alumnos.conPackX4, packId: packLlamado('Pack x4'), medio: 'transferencia' } });

  const claseDeHoyId = await claseDeHoy(api, hoy, profesor.id);
  if (claseDeHoyId === null) throw new Error(`No se generó la clase de ${ESTILO_DE_HOY} del ${hoy}`);
  const anotar = (cuerpo: object) => api(`/api/clases/${claseDeHoyId}/asistencias`, { metodo: 'POST', cuerpo });
  await anotar({ alumnoId: alumnos.conPackX8 });
  await anotar({ alumnoId: alumnos.conPackX4 });
  await anotar({ alumnoId: alumnos.sinPackConClaseSuelta, cobrar: { packId: packLlamado('Clase suelta'), medio: 'mercado_pago' } });

  return { hoy, profesorId: profesor.id, alumnos, claseDeHoyId };
}
