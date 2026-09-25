import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AbrirSesionInput,
  ActualizarSesionInput,
  AgendaDelDia,
  Asistencia,
  RegistrarAsistenciaInput,
  Sesion,
  SesionDetalle,
} from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

// Sin fecha, la API devuelve la agenda de hoy en la zona del estudio.
export function useAgenda(fecha: string | undefined) {
  return useQuery({
    queryKey: ['agenda', fecha ?? 'hoy'],
    queryFn: () => api.get<AgendaDelDia>(conQuery('/sesiones/dia', { fecha })),
  });
}

export function useAbrirSesion() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: AbrirSesionInput) => api.post<Sesion>('/sesiones', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
  });
}

export function useSesionDeClase(id: number) {
  return useQuery({ queryKey: ['sesiones', id], queryFn: () => api.get<SesionDetalle>(`/sesiones/${id}`) });
}

export function useAsistencias(sesionId: number) {
  return useQuery({
    queryKey: ['asistencias', sesionId],
    queryFn: async () => (await api.get<{ items: Asistencia[] }>(`/sesiones/${sesionId}/asistencias`)).items,
  });
}

// Una asistencia cambia la sesión (asistentes), la agenda y los pagos del alumno.
function useRecargarSesion(sesionId: number) {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['asistencias', sesionId] }),
      clienteQuery.invalidateQueries({ queryKey: ['sesiones', sesionId] }),
      clienteQuery.invalidateQueries({ queryKey: ['agenda'] }),
      clienteQuery.invalidateQueries({ queryKey: ['pagos'] }),
    ]);
}

export function useRegistrarAsistencia(sesionId: number) {
  const recargar = useRecargarSesion(sesionId);
  return useMutation({
    mutationFn: (datos: RegistrarAsistenciaInput) =>
      api.post<Asistencia>(`/sesiones/${sesionId}/asistencias`, datos),
    onSuccess: recargar,
  });
}

export function useQuitarAsistencia(sesionId: number) {
  const recargar = useRecargarSesion(sesionId);
  return useMutation({
    mutationFn: (asistenciaId: number) => api.delete(`/asistencias/${asistenciaId}`),
    onSuccess: recargar,
  });
}

export function useActualizarSesion(sesionId: number) {
  const recargar = useRecargarSesion(sesionId);
  return useMutation({
    mutationFn: (datos: ActualizarSesionInput) => api.patch<Sesion>(`/sesiones/${sesionId}`, datos),
    onSuccess: recargar,
  });
}
