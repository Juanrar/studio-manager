import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AbrirClaseInput,
  ActualizarClaseInput,
  AgendaDelDia,
  Asistencia,
  RegistrarAsistenciaInput,
  Clase,
  ClaseDetalle,
} from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

// Sin fecha, la API devuelve la agenda de hoy en la zona del estudio.
export function useAgenda(fecha: string | undefined) {
  return useQuery({
    queryKey: ['agenda', fecha ?? 'hoy'],
    queryFn: () => api.get<AgendaDelDia>(conQuery('/clases/dia', { fecha })),
  });
}

export function useAbrirClase() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: AbrirClaseInput) => api.post<Clase>('/clases', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
  });
}

export function useDetalleDeClase(id: number) {
  return useQuery({ queryKey: ['clases', id], queryFn: () => api.get<ClaseDetalle>(`/clases/${id}`) });
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
