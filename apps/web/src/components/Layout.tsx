import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { Rol, UsuarioPublico } from '@studio/shared';
import { useLogout } from '../features/auth/api.ts';
import { Boton } from './ui/index.tsx';

const MENU: { ruta: string; texto: string; rol: Rol }[] = [
  { ruta: '/agenda', texto: 'Agenda', rol: 'recepcion' },
  { ruta: '/alumnos', texto: 'Alumnos', rol: 'recepcion' },
  { ruta: '/packs', texto: 'Packs', rol: 'admin' },
  { ruta: '/profesores', texto: 'Profesores', rol: 'admin' },
  { ruta: '/clases', texto: 'Clases', rol: 'admin' },
  { ruta: '/usuarios', texto: 'Usuarios', rol: 'admin' },
  { ruta: '/liquidaciones', texto: 'Liquidaciones', rol: 'admin' },
];

export function Layout({ usuario, children }: { usuario: UsuarioPublico; children: ReactNode }) {
  const navegar = useNavigate();
  const logout = useLogout();
  const opciones = MENU.filter((opcion) => opcion.rol === 'recepcion' || usuario.rol === 'admin');

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold text-violet-800">Studio Manager</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {opciones.map((opcion) => (
              <NavLink
                key={opcion.ruta}
                to={opcion.ruta}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-violet-100 text-violet-900' : 'text-stone-600 hover:bg-stone-100'}`
                }
              >
                {opcion.texto}
              </NavLink>
            ))}
          </nav>
          <span className="text-sm text-stone-600">{usuario.nombre}</span>
          <Boton
            variante="secundario"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navegar('/login', { replace: true }) })}
          >
            Cerrar sesión
          </Boton>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
