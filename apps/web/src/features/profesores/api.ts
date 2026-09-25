import { useQuery } from '@tanstack/react-query';
import type { Profesor } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function useProfesores({ incluirInactivos = false }: { incluirInactivos?: boolean } = {}) {
  return useQuery({
    queryKey: ['profesores', { incluirInactivos }],
    queryFn: async () =>
      (await api.get<{ items: Profesor[] }>(conQuery('/profesores', { incluirInactivos: incluirInactivos || undefined })))
        .items,
  });
}
