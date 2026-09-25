import { QueryClient } from '@tanstack/react-query';

export function crearClienteQuery({ reintentos = true }: { reintentos?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: reintentos ? 1 : false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
