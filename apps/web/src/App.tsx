import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { crearClienteQuery } from './lib/query.ts';
import { rutas } from './rutas.tsx';

const clienteQuery = crearClienteQuery();
const router = createBrowserRouter(rutas);

export function App() {
  return (
    <QueryClientProvider client={clienteQuery}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
