import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizarUsuarioInput, CrearUsuarioInput, UsuarioPublico } from '@studio/shared';
import { api } from '../../lib/api.ts';

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get<{ items: UsuarioPublico[] }>('/usuarios')).items,
  });
}

export function useCrearUsuario() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearUsuarioInput) => api.post<UsuarioPublico>('/usuarios', datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useActualizarUsuario() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarUsuarioInput }) =>
      api.patch<UsuarioPublico>(`/usuarios/${id}`, datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
