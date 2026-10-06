import { Navigate, type RouteObject } from 'react-router';
import { AgendaPage } from './features/agenda/AgendaPage.tsx';
import { SesionPage } from './features/agenda/SesionPage.tsx';
import { AlumnosPage } from './features/alumnos/AlumnosPage.tsx';
import { FichaAlumnoPage } from './features/alumnos/FichaAlumnoPage.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RequiereSesion, SoloAdmin } from './features/auth/RequiereSesion.tsx';
import { ClasesPage } from './features/clases/ClasesPage.tsx';
import { LiquidacionesPage } from './features/liquidaciones/LiquidacionesPage.tsx';
import { PacksPage } from './features/packs/PacksPage.tsx';
import { FichaProfesorPage } from './features/profesores/FichaProfesorPage.tsx';
import { ProfesoresPage } from './features/profesores/ProfesoresPage.tsx';
import { UsuariosPage } from './features/usuarios/UsuariosPage.tsx';

export const rutas: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequiereSesion />,
    children: [
      { index: true, element: <Navigate to="/agenda" replace /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'sesiones/:id', element: <SesionPage /> },
      // La ficha se abre en un panel encima de la lista, que sigue montada con su búsqueda.
      { path: 'alumnos', element: <AlumnosPage />, children: [{ path: ':id', element: <FichaAlumnoPage /> }] },
      {
        element: <SoloAdmin />,
        children: [
          { path: 'packs', element: <PacksPage /> },
          { path: 'profesores', element: <ProfesoresPage /> },
          // Hermana y no hija del listado: la ficha es una página entera, no un panel encima de la lista.
          { path: 'profesores/:id', element: <FichaProfesorPage /> },
          { path: 'clases', element: <ClasesPage /> },
          { path: 'usuarios', element: <UsuariosPage /> },
          { path: 'liquidaciones', element: <LiquidacionesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
