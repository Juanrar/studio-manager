import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Pago, RegistrarPagoInput } from '@studio/shared';
import { api } from '../../lib/api.ts';

export function usePagosDeAlumno(alumnoId: number) {
  return useQuery({
    queryKey: ['pagos', alumnoId],
    queryFn: async () => (await api.get<{ items: Pago[] }>(`/pagos?alumnoId=${alumnoId}`)).items,
  });
}

// Un pago cambia el estado del pack: se recargan sus pagos y las consultas de alumnos (lista, ficha y actividad).
function recargarDespuesDeUnPago(clienteQuery: QueryClient, alumnoId: number) {
  return Promise.all([
    clienteQuery.invalidateQueries({ queryKey: ['pagos', alumnoId] }),
    clienteQuery.invalidateQueries({ queryKey: ['alumnos'] }),
  ]);
}

export function useRegistrarPago() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: RegistrarPagoInput) => api.post<Pago>('/pagos', datos),
    onSuccess: (pago) => recargarDespuesDeUnPago(clienteQuery, pago.alumnoId),
  });
}

export function useAnularPago(alumnoId: number) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: ({ pagoId, motivo }: { pagoId: number; motivo: string }) =>
      api.post<Pago>(`/pagos/${pagoId}/anular`, { motivo }),
    onSuccess: () => recargarDespuesDeUnPago(clienteQuery, alumnoId),
  });
}
