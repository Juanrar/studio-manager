import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
      { ruta: '/grilla', texto: 'Grilla', icono: 'grilla' },
      { ruta: '/alumnos', texto: 'Alumnos', icono: 'alumnos' },
      { ruta: '/asistente', texto: 'Asistente', icono: 'asistente' },
    ],
  },
  {
    titulo: 'Administración',
    rol: 'admin',
    opciones: [
      { ruta: '/packs', texto: 'Packs', icono: 'packs' },
      { ruta: '/profesores', texto: 'Profesores', icono: 'profesores' },
      { ruta: '/horarios', texto: 'Horarios', icono: 'horarios' },
      { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuarios' },
      { ruta: '/liquidaciones', texto: 'Liquidaciones', icono: 'liquidaciones' },
    ],
  },
];

function Marca() {
  return (
    <p className="flex items-center gap-2 px-2 py-1 font-semibold">
      <span className="grid size-5 place-items-center rounded bg-acento text-[11px] text-white">S</span>
      Studio Manager
    </p>
  );
}

function useMenuMovil() {
  const [abierto, setAbierto] = useState(false);
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  function abrir() {
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    botonAbrir.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    botonCerrar.current?.focus();
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false);
        botonAbrir.current?.focus();
      }
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return { abierto, abrir, cerrar, botonAbrir, botonCerrar };
}

export function Layout({ usuario, children }: { usuario: UsuarioPublico; children: ReactNode }) {
  const navegar = useNavigate();
  const logout = useLogout();
  const secciones = SECCIONES.filter((seccion) => seccion.rol === 'recepcion' || usuario.rol === 'admin');
  const menu = useMenuMovil();
  const idMenu = useId();

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <header className="flex h-12 flex-none items-center gap-1 px-2 md:hidden">
        <BotonIcono
          ref={menu.botonAbrir}
          icono="menu"
          etiqueta="Abrir menú"
          aria-expanded={menu.abierto}
          aria-controls={idMenu}
          className="size-10"
          onClick={menu.abrir}
        />
        <Marca />
      </header>
      {menu.abierto && (
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={menu.cerrar} />
      )}
      <aside
        id={idMenu}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-r border-borde-fuerte bg-fondo p-2 transition-[translate,visibility] duration-200 md:visible md:static md:z-auto md:w-56 md:max-w-none md:translate-x-0 md:overflow-visible md:border-r-0 md:pt-3 md:transition-none ${
          menu.abierto ? 'visible translate-x-0 shadow-2xl shadow-black/60' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Marca />
          <BotonIcono
            ref={menu.botonCerrar}
            icono="cerrar"
            etiqueta="Cerrar menú"
            className="size-10 md:hidden"
            onClick={menu.cerrar}
          />
        </div>
        <nav aria-label="Menú" className="flex flex-col gap-0.5">
          {secciones.map((seccion) => (
            <div key={seccion.titulo} className="contents">
              <p className="px-2 pt-4 pb-1 text-xs font-semibold text-apagado">{seccion.titulo}</p>
              {seccion.opciones.map((opcion) => (
                <NavLink
                  key={opcion.ruta}
                  to={opcion.ruta}
                  onClick={menu.cerrar}
                  className={({ isActive }) =>
                    `flex h-10 items-center gap-3 rounded-md px-2 font-medium md:h-7 md:gap-2 ${isActive ? 'bg-resalte text-texto' : 'text-tenue hover:bg-elevado hover:text-texto'}`
                  }
                >
                  <Icono nombre={opcion.icono} />
                  {opcion.texto}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-borde px-2 pt-2">
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
