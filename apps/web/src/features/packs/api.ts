import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarPackInput, CrearPackInput, Pack } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function usePacks({ incluirInactivos = false }: { incluirInactivos?: boolean } = {}) {
  return useQuery({
    queryKey: ['packs', { incluirInactivos }],
    queryFn: async () =>
      (await api.get<{ items: Pack[] }>(conQuery('/packs', { incluirInactivos: incluirInactivos || undefined })))
        .items,
  });
}

export function useCrearPack() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearPackInput) => api.post<Pack>('/packs', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['packs'] }),
  });
}

export function useActualizarPack() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarPackInput }) => api.patch<Pack>(`/packs/${id}`, datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['packs'] }),
  });
}
