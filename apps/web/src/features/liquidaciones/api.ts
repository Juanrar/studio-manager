import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DetalleDeClase, Liquidacion, TableroDelMes } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useTablero(periodo: string) {
  return useQuery({
    queryKey: ['tablero', periodo],
    queryFn: () => api.get<TableroDelMes>(conQuery('/tablero', { periodo })),
  });
}

export function useDetalleDeSueldo(profesorId: number, periodo: string) {
  return useQuery({
    queryKey: ['liquidaciones', periodo, 'detalle', profesorId],
    queryFn: async () =>
      (await api.get<{ items: DetalleDeClase[] }>(conQuery('/liquidaciones/detalle', { profesorId, periodo }))).items,
  });
}

export function useCerrarLiquidacion(periodo: string) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (profesorId: number) => api.post<Liquidacion>('/liquidaciones', { profesorId, periodo }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['tablero', periodo] }),
  });
}

export function useMarcarPagada(periodo: string) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (liquidacionId: number) => api.post<Liquidacion>(`/liquidaciones/${liquidacionId}/pagar`),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['tablero', periodo] }),
  });
}
