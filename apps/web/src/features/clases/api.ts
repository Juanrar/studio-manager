import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarClaseInput, Clase, CrearClaseInput } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

// Sin `profesorId` trae el horario de todo el estudio; con él, solo las clases de ese profesor.
export function useClases({
  incluirInactivas = false,
  profesorId,
}: { incluirInactivas?: boolean; profesorId?: number | undefined } = {}) {
  return useQuery({
    queryKey: ['clases', { incluirInactivas, profesorId }],
    queryFn: async () =>
      (
        await api.get<{ items: Clase[] }>(
          conQuery('/clases', { profesorId, incluirInactivos: incluirInactivas || undefined }),
        )
      ).items,
  });
}

// El horario cambia la agenda y el listado de profesores, que cuenta sus clases por semana: se recargan los tres.
function useRecargarHorario() {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['clases'] }),
      clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
      clienteQuery.invalidateQueries({ queryKey: ['profesores'] }),
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
