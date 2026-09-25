import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarClaseInput, Clase, CrearClaseInput } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useClases({ incluirInactivas = false }: { incluirInactivas?: boolean } = {}) {
  return useQuery({
    queryKey: ['clases', { incluirInactivas }],
    queryFn: async () =>
      (await api.get<{ items: Clase[] }>(conQuery('/clases', { incluirInactivos: incluirInactivas || undefined })))
        .items,
  });
}

// El horario cambia la agenda: se recargan las dos.
function useRecargarHorario() {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['clases'] }),
      clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
    ]);
}

export function useCrearClase() {
  const recargar = useRecargarHorario();
  return useMutation({ mutationFn: (datos: CrearClaseInput) => api.post<Clase>('/clases', datos), onSuccess: recargar });
}

export function useActualizarClase() {
  const recargar = useRecargarHorario();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarClaseInput }) => api.patch<Clase>(`/clases/${id}`, datos),
    onSuccess: recargar,
  });
}
