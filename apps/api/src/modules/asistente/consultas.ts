import { z } from 'zod';
import { fechaDiaSchema } from '@studio/shared';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { sumarDias } from '../../lib/fechas.ts';
import { listarClases } from '../clases/clases.service.ts';
import { listarProfesores } from '../profesores/profesores.service.ts';
import type { Herramienta } from './herramientas.ts';

const DIAS_MAXIMOS = 31;

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Solo id, nombre y apellido: el plan gratuito de Gemini no puede recibir datos personales.
export const buscarProfesores: Herramienta = {
  nombre: 'buscar_profesores',
  descripcion: 'Busca profesores activos por nombre, apellido o los dos. Devuelve su id, que piden las demás funciones.',
  parametros: {
    type: 'object',
    properties: { texto: { type: 'string', description: 'Nombre, apellido o los dos, por ejemplo "Martín" o "Gómez"' } },
    required: ['texto'],
  },
  soloAdmin: false,
  async ejecutar(argumentos, { hoy }) {
    const buscado = sinTildes(z.object({ texto: z.string().trim().min(1) }).parse(argumentos).texto);
    const profesores = (await listarProfesores(false, hoy))
      .filter(
        (p) => sinTildes(`${p.nombre} ${p.apellido}`).includes(buscado) || sinTildes(`${p.apellido} ${p.nombre}`).includes(buscado),
      )
      .map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));
    return { resultado: { profesores } };
  },
};

export const listarClasesDelRango: Herramienta = {
  nombre: 'listar_clases',
  descripcion: `Lista las clases entre dos fechas, de hasta ${DIAS_MAXIMOS} días, con horario, estilo, profesor y estado.`,
  parametros: {
    type: 'object',
    properties: {
      desde: { type: 'string', description: 'Primer día, AAAA-MM-DD' },
      hasta: { type: 'string', description: 'Último día, AAAA-MM-DD, igual o posterior a desde' },
    },
    required: ['desde', 'hasta'],
  },
  soloAdmin: false,
  async ejecutar(argumentos, { hoy }) {
    const { desde, hasta } = z.object({ desde: fechaDiaSchema, hasta: fechaDiaSchema }).parse(argumentos);
    if (hasta < desde) throw new ReglaDeNegocioError('hasta tiene que ser igual o posterior a desde');
    if (hasta > sumarDias(desde, DIAS_MAXIMOS - 1)) throw new ReglaDeNegocioError(`El rango es de ${DIAS_MAXIMOS} días como máximo`);
    const { items, finDelHorizonte } = await listarClases(desde, hasta, hoy);
    const clases = items.map((clase) => ({
      id: clase.id,
      fecha: clase.fecha,
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      estilo: clase.estilo,
      nivel: clase.nivel,
      profesor: `${clase.profesor.nombre} ${clase.profesor.apellido}`,
      estado: clase.estado,
      repiteCadaSemana: clase.horarioId !== null,
    }));
    return { resultado: { finDelHorizonte, clases } };
  },
};
