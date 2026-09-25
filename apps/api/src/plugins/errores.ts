import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { esErrorDeDominio } from '../lib/errores.ts';

// Con `sirveFrontend`, una ruta desconocida fuera de /api/ devuelve index.html: la resuelve el router del frontend.
export function registrarManejoDeErrores(app: FastifyInstance, { sirveFrontend = false } = {}): void {
  app.setErrorHandler((error, request, reply) => {
    if (esErrorDeDominio(error)) {
      return reply
        .status(error.codigoHttp)
        .send(error.codigo === undefined ? { error: error.message } : { error: error.message, codigo: error.codigo });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Datos inválidos',
        detalles: error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
    }

    // Errores propios de Fastify con código 4xx: JSON mal formado, cuerpo demasiado grande.
    const codigo = (error as { statusCode?: unknown }).statusCode;
    if (typeof codigo === 'number' && codigo >= 400 && codigo < 500) {
      return reply.status(codigo).send({ error: (error as Error).message });
    }

    request.log.error(error);
    return reply.status(500).send({ error: 'Error interno del servidor' });
  });

  app.setNotFoundHandler((request, reply) => {
    if (sirveFrontend && request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: 'Ruta no encontrada' });
  });
}
