import type { FastifyInstance } from 'fastify';
import { abrirSesionSchema, actualizarSesionSchema, agendaQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { abrirSesion, actualizarSesion, agendaDelDia, obtenerDetalleDeSesion } from './sesiones.service.ts';

export async function rutasSesiones(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('recepcion'));

  app.get('/api/sesiones/dia', async (request) => {
    const { fecha } = agendaQuerySchema.parse(request.query);
    return agendaDelDia(fecha ?? app.hoy());
  });

  app.get('/api/sesiones/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerDetalleDeSesion(id);
  });

  app.post('/api/sesiones', async (request, reply) => {
    const { claseId, fecha } = abrirSesionSchema.parse(request.body);
    const { sesion, creada } = await abrirSesion(claseId, fecha);
    return reply.status(creada ? 201 : 200).send(sesion);
  });

  app.patch('/api/sesiones/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarSesion(id, actualizarSesionSchema.parse(request.body));
  });
}
