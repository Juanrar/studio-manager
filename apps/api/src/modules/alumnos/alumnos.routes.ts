import type { FastifyInstance } from 'fastify';
import { actualizarAlumnoSchema, crearAlumnoSchema, listadoQuerySchema } from '@studio/shared';
import { idParamSchema } from '../../lib/validacion.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { actualizarAlumno, crearAlumno } from './alumnos.service.ts';
import { actividadDelAlumno, obtenerFicha } from './ficha.service.ts';
import { listarAlumnos } from './listado.service.ts';

export async function rutasAlumnos(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requerirRol('recepcion'));

  app.get('/api/alumnos', async (request) => listarAlumnos(listadoQuerySchema.parse(request.query), app.hoy()));

  app.get('/api/alumnos/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerFicha(id, app.hoy());
  });

  app.get('/api/alumnos/:id/actividad', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return { items: await actividadDelAlumno(id, app.hoy()) };
  });

  app.post('/api/alumnos', async (request, reply) => {
    const datos = crearAlumnoSchema.parse(request.body);
    return reply.status(201).send(await crearAlumno(datos, app.reloj()));
  });

  app.patch('/api/alumnos/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return actualizarAlumno(id, actualizarAlumnoSchema.parse(request.body), request.usuario!.id, app.reloj());
  });
}
