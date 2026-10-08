import type { FastifyInstance } from 'fastify';
import { abrirClaseSchema, actualizarClaseSchema, agendaQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { abrirClase, actualizarClase, agendaDelDia, obtenerDetalleDeClase } from './clases.service.ts';

export async function rutasClases(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('recepcion'));

  app.get('/api/clases/dia', async (request) => {
    const { fecha } = agendaQuerySchema.parse(request.query);
    return agendaDelDia(fecha ?? app.hoy());
  });

  app.get('/api/clases/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerDetalleDeClase(id);
  });

  app.post('/api/clases', async (request, reply) => {
    const { horarioId, fecha } = abrirClaseSchema.parse(request.body);
    const { clase, creada } = await abrirClase(horarioId, fecha);
    return reply.status(creada ? 201 : 200).send(clase);
  });

  app.patch('/api/clases/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarClase(id, actualizarClaseSchema.parse(request.body));
  });
}
