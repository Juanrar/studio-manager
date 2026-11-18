import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Liquidacion, TableroDelMes, TableroDelProfesor } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useTablero(periodo: string) {
  return useQuery({
    queryKey: ['tablero', periodo],
    queryFn: () => api.get<TableroDelMes>(conQuery('/tablero', { periodo })),
  });
}

export function useTableroDelProfesor(profesorId: number, periodo: string) {
  return useQuery({
    queryKey: ['tablero', periodo, 'profesor', profesorId],
    queryFn: () => api.get<TableroDelProfesor>(conQuery(`/tablero/profesores/${profesorId}`, { periodo })),
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
