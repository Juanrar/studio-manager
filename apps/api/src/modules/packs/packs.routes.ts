import type { FastifyInstance } from 'fastify';
import { actualizarPackSchema, crearPackSchema, listadoQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarPack, crearPack, listarPacks } from './packs.service.ts';

export async function rutasPacks(app: FastifyInstance): Promise<void> {
  app.get('/api/packs', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { incluirInactivos } = listadoQuerySchema.parse(request.query);
    return { items: await listarPacks(incluirInactivos) };
  });

  app.post('/api/packs', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const datos = crearPackSchema.parse(request.body);
    return reply.status(201).send(await crearPack(datos));
  });

  app.patch('/api/packs/:id', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarPack(id, actualizarPackSchema.parse(request.body));
  });
}
