import { z } from 'zod';
import { altaDeProfesorSchema, crearClaseUnicaSchema, crearHorarioSchema } from '@studio/shared';
import { db } from '../../db/client.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { buscarHomonimo, verificarProfesorActivo } from '../profesores/profesores.service.ts';
import type { Herramienta } from './herramientas.ts';
import type { EsquemaDeObjeto } from './modelo.ts';

export const PROPUESTA_MOSTRADA = {
  estado: 'propuesta mostrada al usuario',
  siguientePaso: 'El usuario la confirma con el botón Crear. Todavía no se creó nada.',
};

const CAMPOS_DE_UNA_CLASE = {
  horaInicio: { type: 'string', description: 'Hora de inicio, HH:MM de 24 horas' },
  horaFin: { type: 'string', description: 'Hora de fin, HH:MM, posterior a horaInicio' },
  estilo: { type: 'string', description: 'Estilo de danza, por ejemplo "Hip-Hop"' },
  nivel: { type: 'string', description: 'Opcional, por ejemplo "Inicial"' },
  profesorId: { type: 'integer', description: 'El id que devuelve buscar_profesores' },
} as const;

export const proponerClaseUnica: Herramienta = {
  nombre: 'proponer_clase_unica',
  descripcion:
    'Propone una clase de una sola fecha, como un workshop o una recuperación. No crea nada: el usuario la ve en una tarjeta y la confirma.',
  parametros: {
    type: 'object',
    properties: { fecha: { type: 'string', description: 'Día de la clase, AAAA-MM-DD, de hoy en adelante' }, ...CAMPOS_DE_UNA_CLASE },
    required: ['fecha', 'horaInicio', 'horaFin', 'estilo', 'profesorId'],
  },
  soloAdmin: true,
  async ejecutar(argumentos, { hoy }) {
    const datos = crearClaseUnicaSchema.parse(argumentos);
    if (datos.fecha < hoy) throw new ReglaDeNegocioError(`El ${datos.fecha} ya pasó: una clase nueva va de hoy en adelante`);
    const profesor = await verificarProfesorActivo(db, datos.profesorId);
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'claseUnica', datos, profesor } };
  },
};

export const proponerHorario: Herramienta = {
  nombre: 'proponer_horario',
  descripcion:
    'Propone una clase que se repite todas las semanas desde esta semana. No crea nada: el usuario la ve en una tarjeta y la confirma.',
  parametros: {
    type: 'object',
    properties: { diaSemana: { type: 'integer', description: 'Día de la semana: 1 es lunes y 7 es domingo' }, ...CAMPOS_DE_UNA_CLASE },
    required: ['diaSemana', 'horaInicio', 'horaFin', 'estilo', 'profesorId'],
  },
  soloAdmin: true,
  async ejecutar(argumentos) {
    // Desde qué semana rige no lo elige el modelo: desde esta.
    const { desde: _desde, claseId: _claseId, ...datos } = crearHorarioSchema.parse(argumentos);
    const profesor = await verificarProfesorActivo(db, datos.profesorId);
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'horario', datos, profesor } };
  },
};

const HORARIO_DEL_ALTA: EsquemaDeObjeto = {
  type: 'object',
  properties: {
    estilo: { type: 'string', description: 'Estilo de danza, por ejemplo "Contemporáneo"' },
    nivel: { type: 'string', description: 'Opcional, por ejemplo "Inicial"' },
    diaSemana: { type: 'integer', description: 'Día de la semana: 1 es lunes y 7 es domingo' },
    horaInicio: { type: 'string', description: 'HH:MM de 24 horas' },
    horaFin: { type: 'string', description: 'HH:MM, posterior a horaInicio' },
  },
  required: ['estilo', 'diaSemana', 'horaInicio', 'horaFin'],
};

const argumentosDelAltaSchema = z.object({
  nombre: z.string(),
  apellido: z.string(),
  porcentaje: z.number().int('El porcentaje va sin decimales').min(1).max(100),
  horarios: z.array(z.unknown()),
});

export const proponerAltaDeProfesor: Herramienta = {
  nombre: 'proponer_alta_de_profesor',
  descripcion:
    'Propone sumar un profesor nuevo con sus clases semanales. No crea nada: el usuario ve la semana en una tarjeta, completa sus datos personales ahí y confirma.',
  parametros: {
    type: 'object',
    properties: {
      nombre: { type: 'string' },
      apellido: { type: 'string' },
      porcentaje: { type: 'integer', description: 'Porcentaje que cobra el profesor de cada clase, de 1 a 100' },
      horarios: { type: 'array', description: 'Las clases que da cada semana', items: HORARIO_DEL_ALTA },
    },
    required: ['nombre', 'apellido', 'porcentaje', 'horarios'],
  },
  soloAdmin: true,
  async ejecutar(argumentos, { hoy }) {
    const { nombre, apellido, porcentaje, horarios } = argumentosDelAltaSchema.parse(argumentos);
    // Los porcentajes se guardan en puntos básicos: 50% es 5000.
    const datos = altaDeProfesorSchema.parse({ profesor: { nombre, apellido, porcentajeBp: porcentaje * 100 }, horarios });
    const repetido = await buscarHomonimo(db, datos.profesor.nombre, datos.profesor.apellido, hoy);
    if (repetido !== null) {
      throw new ReglaDeNegocioError(
        `Ya existe ${repetido.nombre} ${repetido.apellido} (id ${repetido.id}). Preguntá si es la misma persona. Si es otra, se da de alta desde Profesores; si es la misma y está dada de baja, se reactiva desde su ficha.`,
      );
    }
    return { resultado: PROPUESTA_MOSTRADA, propuesta: { tipo: 'altaDeProfesor', datos } };
  },
};
