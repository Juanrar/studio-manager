import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actualizarProfesorSchema,
  crearProfesorSchema,
  listadoQuerySchema,
  nuevoPorcentajeSchema,
} from '@studio/shared';
import { config } from '../../config.ts';
import { hoyEnEstudio } from '../../lib/fechas.ts';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import {
  actualizarProfesor,
  agregarPorcentaje,
  crearProfesor,
  listarPorcentajes,
  listarProfesores,
  obtenerProfesor,
} from './profesores.service.ts';

export async function rutasProfesores(app: FastifyInstance): Promise<void> {
  const hoy = (request: FastifyRequest) => hoyEnEstudio(request.server.reloj(), config.tzEstudio);

  app.get('/api/profesores', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { incluirInactivos } = listadoQuerySchema.parse(request.query);
    return { items: await listarProfesores(incluirInactivos, hoy(request)) };
  });

  app.get('/api/profesores/:id', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerProfesor(id, hoy(request));
  });

  app.post('/api/profesores', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const datos = crearProfesorSchema.parse(request.body);
    return reply.status(201).send(await crearProfesor(datos, hoy(request)));
  });

  app.patch('/api/profesores/:id', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarProfesor(id, actualizarProfesorSchema.parse(request.body), hoy(request));
  });

  app.get('/api/profesores/:id/porcentajes', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return { items: await listarPorcentajes(id) };
  });

  app.post('/api/profesores/:id/porcentajes', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const datos = nuevoPorcentajeSchema.parse(request.body);
    return reply.status(201).send(await agregarPorcentaje(id, datos));
  });
}
