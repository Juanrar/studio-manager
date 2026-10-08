import type { FastifyInstance } from 'fastify';
import { registrarAsistenciaSchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import {
  borrarAsistencia,
  listarAsistenciasDeClase,
  registrarAsistencia,
} from './asistencias.service.ts';

export async function rutasAsistencias(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('recepcion'));

  app.get('/api/clases/:id/asistencias', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return { items: await listarAsistenciasDeClase(id) };
  });

  app.post('/api/clases/:id/asistencias', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const datos = registrarAsistenciaSchema.parse(request.body);
    const asistencia = await registrarAsistencia(id, datos, request.usuario!.id, app.reloj(), app.hoy());
    return reply.status(201).send(asistencia);
  });

  app.delete('/api/asistencias/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await borrarAsistencia(id);
    return reply.status(204).send();
  });
}
