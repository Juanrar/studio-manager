import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Pago, RegistrarPagoInput } from '@studio/shared';
import { api } from '../../lib/api.ts';

export function usePagosDeAlumno(alumnoId: number) {
  return useQuery({
    queryKey: ['pagos', alumnoId],
    queryFn: async () => (await api.get<{ items: Pago[] }>(`/pagos?alumnoId=${alumnoId}`)).items,
  });
}

export function useRegistrarPago() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: RegistrarPagoInput) => api.post<Pago>('/pagos', datos),
    onSuccess: (pago) => clienteQuery.invalidateQueries({ queryKey: ['pagos', pago.alumnoId] }),
  });
}

export function useAnularPago(alumnoId: number) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: ({ pagoId, motivo }: { pagoId: number; motivo: string }) =>
      api.post<Pago>(`/pagos/${pagoId}/anular`, { motivo }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['pagos', alumnoId] }),
  });
}
