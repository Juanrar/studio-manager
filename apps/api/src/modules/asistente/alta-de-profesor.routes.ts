import type { FastifyInstance } from 'fastify';
import { altaDeProfesorSchema } from '@studio/shared';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { darDeAltaProfesor } from './alta-de-profesor.service.ts';

// No usa el modelo: funciona aunque falte GEMINI_API_KEY.
export async function rutasAltaDeProfesor(app: FastifyInstance): Promise<void> {
  app.post('/api/asistente/altas-de-profesor', { preHandler: requerirRol('admin') }, async (request, reply) => {
    const datos = altaDeProfesorSchema.parse(request.body);
    const profesor = await darDeAltaProfesor(datos, app.hoy());
    return reply.status(201).send(profesor);
  });
}
