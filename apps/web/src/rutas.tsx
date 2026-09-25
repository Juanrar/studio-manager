import { Navigate, type RouteObject } from 'react-router';
import { Proximamente } from './components/Layout.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RequiereSesion, SoloAdmin } from './features/auth/RequiereSesion.tsx';

export const rutas: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequiereSesion />,
    children: [
      { index: true, element: <Navigate to="/agenda" replace /> },
      { path: 'agenda', element: <Proximamente titulo="Agenda del día" /> },
      { path: 'alumnos', element: <Proximamente titulo="Alumnos" /> },
      {
        element: <SoloAdmin />,
        children: [
          { path: 'packs', element: <Proximamente titulo="Packs" /> },
          { path: 'profesores', element: <Proximamente titulo="Profesores" /> },
          { path: 'clases', element: <Proximamente titulo="Clases" /> },
          { path: 'usuarios', element: <Proximamente titulo="Usuarios" /> },
          { path: 'liquidaciones', element: <Proximamente titulo="Liquidaciones" /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
