import { Navigate, type RouteObject } from 'react-router';
import { Proximamente } from './components/Layout.tsx';
import { AgendaPage } from './features/agenda/AgendaPage.tsx';
import { SesionPage } from './features/agenda/SesionPage.tsx';
import { AlumnosPage } from './features/alumnos/AlumnosPage.tsx';
import { FichaAlumnoPage } from './features/alumnos/FichaAlumnoPage.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RequiereSesion, SoloAdmin } from './features/auth/RequiereSesion.tsx';

export const rutas: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequiereSesion />,
    children: [
      { index: true, element: <Navigate to="/agenda" replace /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'sesiones/:id', element: <SesionPage /> },
      { path: 'alumnos', element: <AlumnosPage /> },
      { path: 'alumnos/:id', element: <FichaAlumnoPage /> },
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
