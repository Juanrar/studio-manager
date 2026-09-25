import type { FastifyInstance } from 'fastify';
import {
  anularPagoSchema,
  extenderVencimientoSchema,
  pagosQuerySchema,
  periodoQuerySchema,
  registrarPagoSchema,
} from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import {
  anularPago,
  extenderVencimiento,
  ingresosDelPeriodo,
  listarPagosDeAlumno,
  registrarPago,
} from './pagos.service.ts';

export async function rutasPagos(app: FastifyInstance): Promise<void> {
  app.get('/api/pagos', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { alumnoId } = pagosQuerySchema.parse(request.query);
    return { items: await listarPagosDeAlumno(alumnoId, app.hoy()) };
  });

  app.get('/api/pagos/ingresos', { preHandler: requerirRol('admin') }, async (request) => {
    const { periodo } = periodoQuerySchema.parse(request.query);
    return ingresosDelPeriodo(periodo);
  });

  app.post('/api/pagos', { preHandler: requerirRol('recepcion') }, async (request, reply) => {
    const datos = registrarPagoSchema.parse(request.body);
    const pago = await registrarPago(datos, request.usuario!.id, app.reloj(), app.hoy());
    return reply.status(201).send(pago);
  });

  app.post('/api/pagos/:id/anular', { preHandler: requerirRol('recepcion') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { motivo } = anularPagoSchema.parse(request.body);
    return anularPago(id, motivo, app.reloj(), app.hoy());
  });

  app.patch('/api/pagos/:id/vencimiento', { preHandler: requerirRol('admin') }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { venceEl } = extenderVencimientoSchema.parse(request.body);
    return extenderVencimiento(id, venceEl, app.hoy());
  });
}
