import type { FastifyInstance } from 'fastify';
import { periodoQuerySchema } from '@studio/shared';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { tableroDelMes } from './tablero.service.ts';

export async function rutasTablero(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('admin'));

  app.get('/api/tablero', async (request) => {
    const { periodo } = periodoQuerySchema.parse(request.query);
    return tableroDelMes(periodo, app.hoy());
  });
}
