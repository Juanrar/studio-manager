import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AltaDeProfesorInput, MensajeAlAsistenteInput, Profesor, RespuestaDelAsistente } from '@studio/shared';
import { api } from '../../lib/api.ts';

export function useConversar() {
  return useMutation({
    mutationFn: (entrada: MensajeAlAsistenteInput) => api.post<RespuestaDelAsistente>('/asistente/mensajes', entrada),
  });
}

export function useDarDeAltaProfesor() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: AltaDeProfesorInput) => api.post<Profesor>('/asistente/altas-de-profesor', datos),
    onSettled: () =>
      Promise.all(
        ['profesores', 'horarios', 'grilla', 'agenda', 'clases'].map((clave) =>
          clienteQuery.invalidateQueries({ queryKey: [clave] }),
        ),
      ),
  });
}
