import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';
import { Icono, type NombreIcono } from './Icono.tsx';

export { Icono, type NombreIcono } from './Icono.tsx';
export { Flotante, type Ancla } from './Flotante.tsx';
export { SelectorDeHora } from './SelectorDeHora.tsx';
export { Barras, BarrasConLinea } from './Graficos.tsx';

type VarianteBoton = 'primario' | 'secundario' | 'peligro';

const estilosBoton: Record<VarianteBoton, string> = {
  primario: 'bg-acento text-white hover:bg-acento/85',
  secundario: 'border border-borde-fuerte bg-panel text-tenue hover:bg-resalte hover:text-texto',
  peligro: 'border border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25',
};

export const enfoque = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

export function claseDeBoton(variante: VarianteBoton = 'primario') {
  return `inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${enfoque} ${estilosBoton[variante]}`;
}

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return <button type={type} className={`${claseDeBoton(variante)} ${className}`} {...props} />;
}

export function BotonIcono({
  icono,
  etiqueta,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icono: NombreIcono; etiqueta: string }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={`grid size-8 flex-none place-items-center rounded-md text-tenue hover:bg-resalte hover:text-texto ${enfoque} ${className}`}
      {...props}
    >
      <Icono nombre={icono} />
    </button>
  );
}

const estiloEntrada =
  'w-full rounded-md border border-borde-fuerte bg-elevado px-2.5 py-1.5 text-texto placeholder:text-apagado focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento';

export function Campo({
  etiqueta,
  error,
  children,
}: {
  etiqueta: string;
  error?: string | undefined;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-tenue">
        {etiqueta}
      </label>
      {children(id)}
      {error !== undefined && <p className="text-red-400">{error}</p>}
    </div>
  );
}

export function Entrada({
  ref,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={`${estiloEntrada} ${className}`} {...props} />;
}

export function Selector({
  ref,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={`${estiloEntrada} ${className}`} {...props} />;
}

export function AreaDeTexto({
  ref,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={`${estiloEntrada} ${className}`} rows={3} {...props} />;
}

export function Casilla({
  etiqueta,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { etiqueta: string }) {
  return (
    <label className="flex items-center gap-2 text-tenue">
      <input type="checkbox" {...props} />
      {etiqueta}
    </label>
  );
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'exito'; children: ReactNode }) {
  const estilo =
    tipo === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300';
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 ${estilo}`}>
      {children}
    </div>
  );
}

type Columna = string | { texto: string; icono: NombreIcono };

export function Tabla({
  columnas,
  anchos,
  children,
}: {
  columnas: readonly Columna[];
  anchos?: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-borde">
      <table className={`w-full border-collapse text-left ${anchos === undefined ? '' : 'min-w-3xl table-fixed'}`}>
        {anchos !== undefined && (
          <colgroup>
            {anchos.map((ancho, indice) => (
              <col key={indice} style={{ width: ancho }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {columnas.map((columna) => {
              const texto = typeof columna === 'string' ? columna : columna.texto;
              return (
                <th
                  key={texto}
                  scope="col"
                  className="h-8 border-r border-b border-borde px-2 font-medium whitespace-nowrap text-apagado last:border-r-0"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {typeof columna !== 'string' && <Icono nombre={columna.icono} className="size-3.5" />}
                    {texto}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:hover]:bg-elevado [&>tr:last-child>td]:border-b-0">{children}</tbody>
      </table>
    </div>
  );
}

const estiloCelda = 'h-8 border-r border-b border-borde px-2 whitespace-nowrap last:border-r-0';

export function Celda({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`${estiloCelda} ${className}`}>{children}</td>;
}

export function CeldaDeAcciones({ children }: { children: ReactNode }) {
  return (
    <td className={estiloCelda}>
      <div className="flex justify-end gap-1.5 [&>a]:h-6 [&>a]:px-2 [&>button]:h-6 [&>button]:px-2">{children}</div>
    </td>
  );
}

export function Dialogo({
  titulo,
  abierto,
  alCerrar,
  children,
}: {
  titulo: string;
  abierto: boolean;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const idTitulo = useId();
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="w-full max-w-lg rounded-lg border border-borde-fuerte bg-panel p-5 shadow-2xl shadow-black/60"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id={idTitulo} className="mb-4 text-base font-semibold">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

const hayAlgo = (nodo: ReactNode) => nodo !== undefined && nodo !== null && nodo !== false;

export function Pagina({
  titulo,
  volverA,
  acciones,
  barra,
  children,
}: {
  titulo: ReactNode;
  volverA?: { ruta: string; texto: string };
  acciones?: ReactNode;
  barra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 flex-none items-center gap-2 border-b border-borde px-4">
        {volverA !== undefined && (
          <Link to={volverA.ruta} className={`${claseDeBoton('secundario')} h-7 px-2`}>
            <Icono nombre="anterior" />
            {volverA.texto}
          </Link>
        )}
        <h1 className="truncate text-[15px] font-semibold">{titulo}</h1>
        {hayAlgo(acciones) && <div className="ml-auto flex items-center gap-2 pl-2">{acciones}</div>}
      </header>
      {hayAlgo(barra) && (
        <div className="flex min-h-11 flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-borde px-4 py-1.5">
          {barra}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}

export function Ventana({
  etiqueta,
  alCerrar,
  encabezado,
  children,
}: {
  etiqueta: string;
  alCerrar: () => void;
  encabezado: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    function alTeclear(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) alCerrar();
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  const empezoEnElFondo = useRef(false);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(evento) => {
        empezoEnElFondo.current = evento.target === evento.currentTarget;
      }}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && empezoEnElFondo.current) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        className="flex max-h-full w-full max-w-5xl flex-col rounded-lg border border-borde-fuerte bg-panel shadow-2xl shadow-black/60"
      >
        <div className="flex items-start gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">{encabezado}</div>
          <BotonIcono icono="cerrar" etiqueta="Cerrar" onClick={alCerrar} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export type Pestana<T extends string> = { id: T; texto: string; icono: NombreIcono };

const PASO_CON_FLECHA: Record<string, number | undefined> = { ArrowRight: 1, ArrowLeft: -1 };

export function Pestanas<T extends string>({
  pestanas,
  activa,
  alCambiar,
  children,
}: {
  pestanas: readonly Pestana<T>[];
  activa: T;
  alCambiar: (id: T) => void;
  children: ReactNode;
}) {
  const base = useId();
  const idDe = (id: T) => `${base}-${id}`;

  function moverConFlechas(evento: KeyboardEvent) {
    const paso = PASO_CON_FLECHA[evento.key];
    if (paso === undefined) return;
    const actual = pestanas.findIndex((pestana) => pestana.id === activa);
    const siguiente = pestanas[(actual + paso + pestanas.length) % pestanas.length]!;
    alCambiar(siguiente.id);
    document.getElementById(idDe(siguiente.id))?.focus();
  }

  return (
    <>
      <div role="tablist" className="flex gap-1 border-b border-borde px-4" onKeyDown={moverConFlechas}>
        {pestanas.map((pestana) => {
          const elegida = pestana.id === activa;
          return (
            <button
              key={pestana.id}
              id={idDe(pestana.id)}
              type="button"
              role="tab"
              aria-selected={elegida}
              aria-controls={`${base}-panel`}
              tabIndex={elegida ? 0 : -1}
              onClick={() => alCambiar(pestana.id)}
              className={`-mb-px flex items-center gap-1.5 border-b px-1.5 py-2.5 font-medium ${enfoque} ${elegida ? 'border-texto text-texto' : 'border-transparent text-apagado hover:text-texto'}`}
            >
              <Icono nombre={pestana.icono} />
              {pestana.texto}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={idDe(activa)}>
        {children}
      </div>
    </>
  );
}

export function Cargando() {
  return <p className="text-apagado">Cargando…</p>;
}

export type TonoInsignia = 'gris' | 'verde' | 'rojo' | 'ambar' | 'azul' | 'violeta';

const estilosInsignia: Record<TonoInsignia, string> = {
  gris: 'bg-neutral-500/20 text-neutral-300',
  verde: 'bg-green-500/15 text-green-300',
  rojo: 'bg-red-500/15 text-red-300',
  ambar: 'bg-amber-500/15 text-amber-300',
  azul: 'bg-blue-500/15 text-blue-300',
  violeta: 'bg-violet-500/15 text-violet-300',
};

export function Insignia({ children, tono = 'gris' }: { children: ReactNode; tono?: TonoInsignia }) {
  return (
    <span className={`inline-flex h-5 items-center rounded px-1.5 text-xs font-medium whitespace-nowrap ${estilosInsignia[tono]}`}>
      {children}
    </span>
  );
}

const COLORES_AVATAR = ['#e5484d', '#f76b15', '#d9a400', '#30a46c', '#12a594', '#0090ff', '#3e63dd', '#8e4ec6', '#d6409f', '#978365'];

export function colorDeNombre(nombre: string): string {
  const indice = [...nombre].reduce((suma, letra) => suma + letra.charCodeAt(0), 0) % COLORES_AVATAR.length;
  return COLORES_AVATAR[indice]!;
}

export function Avatar({ nombre, grande = false }: { nombre: string; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-full font-semibold text-white ${grande ? 'size-11 text-lg' : 'size-4 text-[9px]'}`}
      style={{ backgroundColor: colorDeNombre(nombre) }}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
