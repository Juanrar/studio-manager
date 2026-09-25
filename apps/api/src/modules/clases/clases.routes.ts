import type { FastifyInstance } from 'fastify';
import { actualizarClaseSchema, crearClaseSchema, listadoQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarClase, crearClase, listarClases } from './clases.service.ts';

export async function rutasClases(app: FastifyInstance): Promise<void> {
  app.get('/api/clases', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { incluirInactivos } = listadoQuerySchema.parse(request.query);
    return { items: await listarClases(incluirInactivos) };
  });

  app.post('/api/clases', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const datos = crearClaseSchema.parse(request.body);
    return reply.status(201).send(await crearClase(datos));
  });

  app.patch('/api/clases/:id', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarClase(id, actualizarClaseSchema.parse(request.body));
  });
}
