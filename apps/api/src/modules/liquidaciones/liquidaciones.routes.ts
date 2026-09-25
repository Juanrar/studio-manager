import type { FastifyInstance } from 'fastify';
import {
  cerrarLiquidacionSchema,
  detalleLiquidacionQuerySchema,
  periodoQuerySchema,
} from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import {
  cerrarLiquidacion,
  detalleDelPeriodo,
  marcarPagada,
  resumenDelPeriodo,
} from './liquidaciones.service.ts';

export async function rutasLiquidaciones(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('admin'));

  app.get('/api/liquidaciones', async (request) => {
    const { periodo } = periodoQuerySchema.parse(request.query);
    return resumenDelPeriodo(periodo, app.hoy());
  });

  app.get('/api/liquidaciones/detalle', async (request) => {
    const { profesorId, periodo } = detalleLiquidacionQuerySchema.parse(request.query);
    return { items: await detalleDelPeriodo(profesorId, periodo) };
  });

  app.post('/api/liquidaciones', async (request, reply) => {
    const { profesorId, periodo } = cerrarLiquidacionSchema.parse(request.body);
    const liquidacion = await cerrarLiquidacion(profesorId, periodo, request.usuario!.id, app.hoy());
    return reply.status(201).send(liquidacion);
  });

  app.post('/api/liquidaciones/:id/pagar', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return marcarPagada(id, app.reloj());
  });
}
