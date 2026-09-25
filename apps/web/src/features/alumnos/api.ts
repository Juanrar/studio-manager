import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarAlumnoInput, Alumno, CrearAlumnoInput, Listado } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export type FiltrosAlumnos = { q: string; pagina: number; incluirInactivos: boolean };

export function useAlumnos(filtros: FiltrosAlumnos) {
  return useQuery({
    queryKey: ['alumnos', 'listado', filtros],
    queryFn: () =>
      api.get<Listado<Alumno>>(
        conQuery('/alumnos', {
          q: filtros.q,
          pagina: filtros.pagina,
          incluirInactivos: filtros.incluirInactivos || undefined,
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAlumno(id: number) {
  return useQuery({ queryKey: ['alumnos', id], queryFn: () => api.get<Alumno>(`/alumnos/${id}`) });
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
