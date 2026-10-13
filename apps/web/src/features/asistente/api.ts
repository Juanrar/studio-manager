import { useMutation } from '@tanstack/react-query';
import type { MensajeAlAsistenteInput, RespuestaDelAsistente } from '@studio/shared';
import { api } from '../../lib/api.ts';

export function useConversar() {
  return useMutation({
    mutationFn: (entrada: MensajeAlAsistenteInput) => api.post<RespuestaDelAsistente>('/asistente/mensajes', entrada),
  });
}
