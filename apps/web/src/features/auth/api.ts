import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, UsuarioPublico } from '@studio/shared';
import { api, ErrorDeApi } from '../../lib/api.ts';

const CLAVE_SESION = ['sesion'] as const;

// Un 401 no es un error: significa que no hay nadie logueado.
export function useSesion() {
  return useQuery({
    queryKey: CLAVE_SESION,
    queryFn: async (): Promise<UsuarioPublico | null> => {
      try {
        return await api.get<UsuarioPublico>('/auth/yo');
      } catch (error) {
        if (error instanceof ErrorDeApi && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLogin() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: LoginInput) => api.post<UsuarioPublico>('/auth/login', datos),
    onSuccess: (usuario) => clienteQuery.setQueryData(CLAVE_SESION, usuario),
  });
}

export function useLogout() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => {
      // Se descarta todo lo cargado: el próximo usuario no tiene que ver datos del anterior.
      clienteQuery.clear();
      clienteQuery.setQueryData(CLAVE_SESION, null);
    },
  });
}
