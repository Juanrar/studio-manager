import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarClaseInput, Asistencia, Clase, ClasesDelRango, RegistrarAsistenciaInput } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

// Las clases de un día, ya creadas por adelantado. Sin fecha, la API usa el día de hoy en el estudio.
export function useAgenda(fecha: string | undefined) {
  return useQuery({
    queryKey: ['agenda', fecha ?? 'hoy'],
    queryFn: () => api.get<ClasesDelRango>(conQuery('/clases', { desde: fecha, hasta: fecha })),
  });
}

export function useDetalleDeClase(id: number) {
  return useQuery({ queryKey: ['clases', id], queryFn: () => api.get<Clase>(`/clases/${id}`) });
}

export function useAsistencias(claseId: number) {
  return useQuery({
    queryKey: ['asistencias', claseId],
    queryFn: async () => (await api.get<{ items: Asistencia[] }>(`/clases/${claseId}/asistencias`)).items,
  });
}

// Una asistencia cambia la clase (asistentes), la agenda y los pagos del alumno.
function useRecargarClase(claseId: number) {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['asistencias', claseId] }),
      clienteQuery.invalidateQueries({ queryKey: ['clases', claseId] }),
      clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
      clienteQuery.invalidateQueries({ queryKey: ['pagos'] }),
    ]);
}

export function useRegistrarAsistencia(claseId: number) {
  const recargar = useRecargarClase(claseId);
  return useMutation({
    mutationFn: (datos: RegistrarAsistenciaInput) =>
      api.post<Asistencia>(`/clases/${claseId}/asistencias`, datos),
    onSuccess: recargar,
  });
}

export function useQuitarAsistencia(claseId: number) {
  const recargar = useRecargarClase(claseId);
  return useMutation({
    mutationFn: (asistenciaId: number) => api.delete(`/asistencias/${asistenciaId}`),
    onSuccess: recargar,
  });
}

export function useActualizarClase(claseId: number) {
  const recargar = useRecargarClase(claseId);
  return useMutation({
    mutationFn: (datos: ActualizarClaseInput) => api.patch<Clase>(`/clases/${claseId}`, datos),
    onSuccess: recargar,
  });
}
