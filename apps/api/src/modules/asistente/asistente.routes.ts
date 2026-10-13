import type { FastifyInstance } from 'fastify';
import { mensajeAlAsistenteSchema } from '@studio/shared';
import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import { requerirRol } from '../../plugins/autenticacion.ts';
import { conversar } from './asistente.service.ts';
import type { ModeloDeLenguaje } from './modelo.ts';

export async function rutasAsistente(app: FastifyInstance, { modelo }: { modelo: ModeloDeLenguaje | null }): Promise<void> {
  app.post('/api/asistente/mensajes', { preHandler: requerirRol('recepcion') }, async (request) => {
    const entrada = mensajeAlAsistenteSchema.parse(request.body);
    if (modelo === null) {
      throw new ServicioNoDisponibleError(
        'El asistente no está configurado: falta GEMINI_API_KEY en el .env de la API',
        'ASISTENTE_SIN_CONFIGURAR',
      );
    }
    const rol = request.usuario?.rol === 'admin' ? 'admin' : 'recepcion';
    return conversar(modelo, entrada, { hoy: app.hoy(), rol });
  });
}
