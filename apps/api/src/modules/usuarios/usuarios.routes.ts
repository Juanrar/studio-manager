import type { FastifyInstance } from 'fastify';
import { actualizarUsuarioSchema, crearUsuarioSchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarUsuario, crearUsuario, listarUsuarios } from './usuarios.service.ts';

export async function rutasUsuarios(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('admin'));

  app.get('/api/usuarios', async () => ({ items: await listarUsuarios() }));

  app.post('/api/usuarios', async (request, reply) => {
    const datos = crearUsuarioSchema.parse(request.body);
    return reply.status(201).send(await crearUsuario(datos));
  });

  app.patch('/api/usuarios/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const datos = actualizarUsuarioSchema.parse(request.body);
    return actualizarUsuario(id, datos);
  });
}
