import type { FastifyInstance } from 'fastify';
import { actualizarHorarioSchema, horariosQuerySchema, crearHorarioSchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarHorario, crearHorario, listarHorarios } from './horarios.service.ts';

export async function rutasHorarios(app: FastifyInstance): Promise<void> {
  app.get('/api/horarios', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { incluirInactivos, profesorId } = horariosQuerySchema.parse(request.query);
    return { items: await listarHorarios({ incluirInactivos: incluirInactivos, profesorId }) };
  });

  app.post('/api/horarios', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const datos = crearHorarioSchema.parse(request.body);
    return reply.status(201).send(await crearHorario(datos));
  });

  app.patch('/api/horarios/:id', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarHorario(id, actualizarHorarioSchema.parse(request.body));
  });
}
