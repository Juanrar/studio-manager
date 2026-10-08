import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ClasesDelRango } from '@studio/shared';
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
