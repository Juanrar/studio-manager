import type { FastifyInstance } from 'fastify';
import { CAMPOS_PARA_MOVER_UNA_CLASE, actualizarClaseSchema, clasesQuerySchema } from '@studio/shared';
import { SinPermisoError } from '../../lib/errores.ts';
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
    const datos = actualizarClaseSchema.parse(request.body);
    if (request.usuario?.rol !== 'admin' && CAMPOS_PARA_MOVER_UNA_CLASE.some((campo) => datos[campo] !== undefined)) {
      throw new SinPermisoError('Solo un administrador puede mover una clase o cambiarle la hora o el estilo');
    }
    await actualizarClase(id, datos, app.hoy());
    return obtenerClase(id, app.hoy());
  });
}
