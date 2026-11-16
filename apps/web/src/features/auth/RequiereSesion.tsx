import { Navigate, Outlet } from 'react-router';
import { Layout } from '../../components/Layout.tsx';
import { Aviso, Cargando } from '../../components/ui/index.tsx';
import { ProveedorDeConversacion } from '../asistente/ConversacionDelAsistente.tsx';
import { useSesion } from './api.ts';

export function RequiereSesion() {
  const sesion = useSesion();
  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Aviso>No se pudo conectar con el servidor. Probá recargar la página.</Aviso>;
  if (sesion.data === null) return <Navigate to="/login" replace />;
  return (
    <Layout usuario={sesion.data}>
      <ProveedorDeConversacion key={sesion.data.id}>
        <Outlet />
      </ProveedorDeConversacion>
    </Layout>
  );
}

export function SoloAdmin() {
  const sesion = useSesion();
  if (sesion.data?.rol !== 'admin') {
    return (
      <div className="p-4">
        <Aviso>No tenés permiso para ver esta pantalla.</Aviso>
      </div>
    );
  }
  return <Outlet />;
}
