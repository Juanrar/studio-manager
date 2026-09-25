import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarProfesorInput,
  CrearProfesorInput,
  NuevoPorcentajeInput,
  PorcentajeProfesor,
  Profesor,
} from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useProfesores({ incluirInactivos = false }: { incluirInactivos?: boolean } = {}) {
  return useQuery({
    queryKey: ['profesores', { incluirInactivos }],
    queryFn: async () =>
      (await api.get<{ items: Profesor[] }>(conQuery('/profesores', { incluirInactivos: incluirInactivos || undefined })))
        .items,
  });
}

export function useCrearProfesor() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearProfesorInput) => api.post<Profesor>('/profesores', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['profesores'] }),
  });
}

export function useActualizarProfesor() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarProfesorInput }) =>
      api.patch<Profesor>(`/profesores/${id}`, datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['profesores'] }),
  });
}

export function usePorcentajes(profesorId: number) {
  return useQuery({
    queryKey: ['profesores', profesorId, 'porcentajes'],
    queryFn: async () =>
      (await api.get<{ items: PorcentajeProfesor[] }>(`/profesores/${profesorId}/porcentajes`)).items,
  });
}

export function useAgregarPorcentaje(profesorId: number) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoPorcentajeInput) =>
      api.post<PorcentajeProfesor>(`/profesores/${profesorId}/porcentajes`, datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['profesores'] }),
  });
}
