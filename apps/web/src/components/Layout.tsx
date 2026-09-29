import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { Rol, UsuarioPublico } from '@studio/shared';
import { useLogout } from '../features/auth/api.ts';
import { NOMBRES_ROL } from '../lib/formato.ts';
import { BotonIcono, Icono, type NombreIcono } from './ui/index.tsx';

type Opcion = { ruta: string; texto: string; icono: NombreIcono };

const SECCIONES: { titulo: string; rol: Rol; opciones: Opcion[] }[] = [
  {
    titulo: 'Recepción',
    rol: 'recepcion',
    opciones: [
      { ruta: '/agenda', texto: 'Agenda', icono: 'agenda' },
      { ruta: '/alumnos', texto: 'Alumnos', icono: 'alumnos' },
    ],
  },
  {
    titulo: 'Administración',
    rol: 'admin',
    opciones: [
      { ruta: '/packs', texto: 'Packs', icono: 'packs' },
      { ruta: '/profesores', texto: 'Profesores', icono: 'profesores' },
      { ruta: '/clases', texto: 'Clases', icono: 'clases' },
      { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuarios' },
      { ruta: '/liquidaciones', texto: 'Liquidaciones', icono: 'liquidaciones' },
    ],
  },
];

export function Layout({ usuario, children }: { usuario: UsuarioPublico; children: ReactNode }) {
  const navegar = useNavigate();
  const logout = useLogout();
  const secciones = SECCIONES.filter((seccion) => seccion.rol === 'recepcion' || usuario.rol === 'admin');

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <aside className="flex flex-none flex-col gap-1 p-2 md:w-56 md:pt-3">
        <p className="flex items-center gap-2 px-2 py-1 font-semibold">
          <span className="grid size-5 place-items-center rounded bg-acento text-[11px] text-white">S</span>
          Studio Manager
        </p>
        <nav aria-label="Menú" className="flex flex-wrap gap-0.5 md:flex-col">
          {secciones.map((seccion) => (
            <div key={seccion.titulo} className="contents">
              <p className="hidden px-2 pt-4 pb-1 text-xs font-semibold text-apagado md:block">{seccion.titulo}</p>
              {seccion.opciones.map((opcion) => (
                <NavLink
                  key={opcion.ruta}
                  to={opcion.ruta}
                  className={({ isActive }) =>
                    `flex h-7 items-center gap-2 rounded-md px-2 font-medium ${isActive ? 'bg-resalte text-texto' : 'text-tenue hover:bg-elevado hover:text-texto'}`
                  }
                >
                  <Icono nombre={opcion.icono} />
                  {opcion.texto}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-borde px-2 pt-2 md:mt-auto">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{usuario.nombre}</p>
            <p className="text-xs text-apagado">{NOMBRES_ROL[usuario.rol]}</p>
          </div>
          <BotonIcono
            icono="salir"
            etiqueta="Cerrar sesión"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navegar('/login', { replace: true }) })}
          />
        </div>
      </aside>
      <main className="relative m-2 mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-borde-fuerte bg-panel md:m-3 md:ml-0">
        {children}
      </main>
    </div>
  );
}
