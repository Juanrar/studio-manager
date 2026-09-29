import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarAlumnoInput,
  Alumno,
  CrearAlumnoInput,
  EventoDeAlumno,
  FichaDeAlumno,
  ListadoDeAlumnos,
} from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export type FiltrosAlumnos = { q: string; pagina: number; incluirInactivos: boolean };

export function useAlumnos(filtros: FiltrosAlumnos, { habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    enabled: habilitado,
    queryKey: ['alumnos', 'listado', filtros],
    queryFn: () =>
      api.get<ListadoDeAlumnos>(
        conQuery('/alumnos', {
          q: filtros.q,
          pagina: filtros.pagina,
          incluirInactivos: filtros.incluirInactivos || undefined,
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useFichaDeAlumno(id: number) {
  return useQuery({ queryKey: ['alumnos', id], queryFn: () => api.get<FichaDeAlumno>(`/alumnos/${id}`) });
}

// Va debajo de la ficha en la clave: lo que recarga las consultas de alumnos también la recarga.
export function useActividadDeAlumno(id: number) {
  return useQuery({
    queryKey: ['alumnos', id, 'actividad'],
    queryFn: async () => (await api.get<{ items: EventoDeAlumno[] }>(`/alumnos/${id}/actividad`)).items,
  });
}

export function useCrearAlumno() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearAlumnoInput) => api.post<Alumno>('/alumnos', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['alumnos'] }),
  });
}

export function useActualizarAlumno(id: number) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarAlumnoInput) => api.patch<Alumno>(`/alumnos/${id}`, datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['alumnos'] }),
  });
}
