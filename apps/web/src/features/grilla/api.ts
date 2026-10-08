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

// Las clases de un rango de días, también las canceladas. La grilla pide una semana, un día o un mes.
export function useClasesDelRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['grilla', desde, hasta],
    queryFn: () => api.get<ClasesDelRango>(conQuery('/clases', { desde, hasta })),
    // Al pasar de semana, la flecha y el tope del horizonte siguen con los datos de la anterior hasta que llegan.
    placeholderData: keepPreviousData,
  });
}

// Un cambio en la grilla cambia también la agenda, la pantalla de la clase, los horarios y la carga de
// cada profesor.
function useRecargar() {
  const clienteQuery = useQueryClient();
  return () =>
    Promise.all(
      ['grilla', 'agenda', 'clases', 'horarios', 'profesores'].map((clave) =>
        clienteQuery.invalidateQueries({ queryKey: [clave] }),
      ),
    );
}

// Cambia una clase sola. La grilla la muestra cambiada en el momento y vuelve atrás si la API lo rechaza:
// sin esto, una clase arrastrada salta a su lugar viejo hasta que llega la respuesta.
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

// "Aplicar a todas las semanas" y "Quitar de todas las semanas": cambia el horario desde una semana.
export function useCambiarHorario() {
  const recargar = useRecargar();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarHorarioInput }) => api.patch<Horario>(`/horarios/${id}`, datos),
    onSettled: recargar,
  });
}

// "Agregar a todas las semanas": un horario nuevo que adopta la clase única como su primera clase.
export function useCrearHorario() {
  const recargar = useRecargar();
  return useMutation({
    mutationFn: (datos: CrearHorarioInput) => api.post<Horario>('/horarios', datos),
    onSettled: recargar,
  });
}
