import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DetalleSesion, IngresosDelPeriodo, Liquidacion, ResumenDelPeriodo } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useResumenDeSueldos(periodo: string) {
  return useQuery({
    queryKey: ['liquidaciones', periodo],
    queryFn: () => api.get<ResumenDelPeriodo>(conQuery('/liquidaciones', { periodo })),
  });
}

export function useIngresos(periodo: string) {
  return useQuery({
    queryKey: ['ingresos', periodo],
    queryFn: () => api.get<IngresosDelPeriodo>(conQuery('/pagos/ingresos', { periodo })),
  });
}

export function useDetalleDeSueldo(profesorId: number, periodo: string) {
  return useQuery({
    queryKey: ['liquidaciones', periodo, 'detalle', profesorId],
    queryFn: async () =>
      (await api.get<{ items: DetalleSesion[] }>(conQuery('/liquidaciones/detalle', { profesorId, periodo }))).items,
  });
}

export function useCerrarLiquidacion(periodo: string) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (profesorId: number) => api.post<Liquidacion>('/liquidaciones', { profesorId, periodo }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['liquidaciones', periodo] }),
  });
}

export function useMarcarPagada(periodo: string) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (liquidacionId: number) => api.post<Liquidacion>(`/liquidaciones/${liquidacionId}/pagar`),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['liquidaciones', periodo] }),
  });
}
