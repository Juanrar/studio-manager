import type { FastifyInstance } from 'fastify';
import { actualizarClaseSchema, clasesQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarClase, listarClases, obtenerClase } from './clases.service.ts';

export async function rutasClases(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('recepcion'));

  app.get('/api/clases', async (request) => {
    const { desde, hasta } = clasesQuerySchema.parse(request.query);
    const hoy = app.hoy();
    const inicio = desde ?? hoy;
    return listarClases(inicio, hasta ?? inicio, hoy);
  });

  app.get('/api/clases/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerClase(id, app.hoy());
  });

  app.patch('/api/clases/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    await actualizarClase(id, actualizarClaseSchema.parse(request.body));
    return obtenerClase(id, app.hoy());
  });
}
