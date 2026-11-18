import type { FastifyInstance } from 'fastify';
import { periodoQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { tableroDelMes, tableroDelProfesor } from './tablero.service.ts';

export async function rutasTablero(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('admin'));

  app.get('/api/tablero', async (request) => {
    const { periodo } = periodoQuerySchema.parse(request.query);
    return tableroDelMes(periodo, app.hoy());
  });

  app.get('/api/tablero/profesores/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { periodo } = periodoQuerySchema.parse(request.query);
    return tableroDelProfesor(id, periodo, app.hoy());
  });
}
