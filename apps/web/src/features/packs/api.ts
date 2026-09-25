import { useQuery } from '@tanstack/react-query';
import type { Pack } from '@studio/shared';
import { api, conQuery } from '../../lib/api.ts';

export function usePacks({ incluirInactivos = false }: { incluirInactivos?: boolean } = {}) {
  return useQuery({
    queryKey: ['packs', { incluirInactivos }],
    queryFn: async () =>
      (await api.get<{ items: Pack[] }>(conQuery('/packs', { incluirInactivos: incluirInactivos || undefined })))
        .items,
  });
}
