import { Navigate, Outlet } from 'react-router';
import { Layout } from '../../components/Layout.tsx';
import { Aviso, Cargando } from '../../components/ui/index.tsx';
import { useSesion } from './api.ts';

export function RequiereSesion() {
  const sesion = useSesion();
  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Aviso>No se pudo conectar con el servidor. Probá recargar la página.</Aviso>;
  if (sesion.data === null) return <Navigate to="/login" replace />;
  return (
    <Layout usuario={sesion.data}>
      <Outlet />
    </Layout>
  );
}

// La API ya rechaza a recepción en estas rutas; esto evita mostrarle una pantalla que no puede usar.
export function SoloAdmin() {
  const sesion = useSesion();
  if (sesion.data?.rol !== 'admin') return <Aviso>No tenés permiso para ver esta pantalla.</Aviso>;
  return <Outlet />;
}
