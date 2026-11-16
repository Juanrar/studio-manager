import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarClaseInput,
  ActualizarHorarioInput,
  Clase,
  ClasesDelRango,
  CrearClaseUnicaInput,
  CrearHorarioInput,
  Horario,
} from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useClasesDelRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['grilla', desde, hasta],
    queryFn: () => api.get<ClasesDelRango>(conQuery('/clases', { desde, hasta })),
    placeholderData: keepPreviousData,
  });
}

function useRecargar() {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all(
      ['grilla', 'agenda', 'clases', 'horarios', 'profesores'].map((clave) =>
        clienteQuery.invalidateQueries({ queryKey: [clave] }),
      ),
    );
}

export function useCambiarClase() {
  const clienteQuery = useQueryClient();
  const recargar = useRecargar();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarClaseInput }) => api.patch<Clase>(`/clases/${id}`, datos),
    onMutate: async ({ id, datos }) => {
      await clienteQuery.cancelQueries({ queryKey: ['grilla'] });
      const antes = clienteQuery.getQueriesData<ClasesDelRango>({ queryKey: ['grilla'] });
      const cambios = Object.fromEntries(Object.entries(datos).filter(([, valor]) => valor !== undefined));
      clienteQuery.setQueriesData<ClasesDelRango>({ queryKey: ['grilla'] }, (rango) =>
        rango && { ...rango, items: rango.items.map((clase) => (clase.id === id ? { ...clase, ...cambios } : clase)) },
      );
      return { antes };
    },
    onError: (_error, _variables, contexto) => {
      for (const [clave, datos] of contexto?.antes ?? []) clienteQuery.setQueryData(clave, datos);
    },
    onSettled: recargar,
  });
}

export function useCrearClaseUnica() {
  const recargar = useRecargar();
  return useMutation({
    mutationFn: (datos: CrearClaseUnicaInput) => api.post<Clase>('/clases', datos),
    onSettled: recargar,
  });
}

export function useBorrarClase() {
  const recargar = useRecargar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/clases/${id}`), onSettled: recargar });
}

export function useCambiarHorario() {
  const recargar = useRecargar();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarHorarioInput }) => api.patch<Horario>(`/horarios/${id}`, datos),
    onSettled: recargar,
  });
}

export function useCrearHorario() {
  const recargar = useRecargar();
  return useMutation({
    mutationFn: (datos: CrearHorarioInput) => api.post<Horario>('/horarios', datos),
    onSettled: recargar,
  });
}
