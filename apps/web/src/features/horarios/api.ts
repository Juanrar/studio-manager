import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarHorarioInput, Horario, CrearHorarioInput } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

// Sin `profesorId` trae el horario de todo el estudio; con él, solo los horarios de ese profesor.
export function useHorarios({
  incluirInactivos = false,
  profesorId,
}: { incluirInactivos?: boolean; profesorId?: number | undefined } = {}) {
  return useQuery({
    queryKey: ['horarios', { incluirInactivos, profesorId }],
    queryFn: async () =>
      (
        await api.get<{ items: Horario[] }>(
          conQuery('/horarios', { profesorId, incluirInactivos: incluirInactivos || undefined }),
        )
      ).items,
    // Al marcar "Mostrar dadas de baja" la clave cambia y todavía no hay datos: sin esto el horario pasa a
    // "Cargando…" y se desmonta la fila que se estaba editando, con lo que tenía escrito.
    placeholderData: keepPreviousData,
  });
}

// El horario cambia la agenda y el listado de profesores, que cuenta sus clases por semana: se recargan los tres.
function useRecargarHorario() {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['horarios'] }),
      clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
      clienteQuery.invalidateQueries({ queryKey: ['profesores'] }),
    ]);
}

export function useCrearHorario() {
  const recargar = useRecargarHorario();
  return useMutation({ mutationFn: (datos: CrearHorarioInput) => api.post<Horario>('/horarios', datos), onSuccess: recargar });
}

export function useActualizarHorario() {
  const recargar = useRecargarHorario();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarHorarioInput }) => api.patch<Horario>(`/horarios/${id}`, datos),
    onSuccess: recargar,
  });
}
