import { crearClaseUnicaSchema, crearHorarioSchema } from '@studio/shared';
import { db } from '../../db/client.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import type { Herramienta } from './herramientas.ts';

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
