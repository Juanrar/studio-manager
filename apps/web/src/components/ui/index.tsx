import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';

type VarianteBoton = 'primario' | 'secundario' | 'peligro';

const estilosBoton: Record<VarianteBoton, string> = {
  primario: 'bg-violet-700 text-white hover:bg-violet-800',
  secundario: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
};

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      type={type}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${estilosBoton[variante]} ${className}`}
      {...props}
    />
  );
}

const estiloEntrada =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600';

// Etiqueta, control y mensaje de error. El control recibe el id para que la etiqueta lo nombre.
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
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {etiqueta}
      </label>
      {children(id)}
      {error !== undefined && <p className="text-sm text-red-600">{error}</p>}
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

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'exito'; children: ReactNode }) {
  const estilo = tipo === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800';
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${estilo}`}>
      {children}
    </div>
  );
}

export function Tabla({ columnas, children }: { columnas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-100 text-stone-600">
          <tr>
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="px-3 py-2 font-medium">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Celda({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id={idTitulo} className="mb-4 text-lg font-semibold">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Titulo({ children, acciones }: { children: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {acciones !== undefined && <div className="flex gap-2">{acciones}</div>}
    </div>
  );
}

export function Cargando() {
  return <p className="text-sm text-stone-500">Cargando…</p>;
}

export function Insignia({ children, tono = 'gris' }: { children: ReactNode; tono?: 'gris' | 'verde' | 'rojo' | 'ambar' }) {
  const estilos = {
    gris: 'bg-stone-100 text-stone-700',
    verde: 'bg-green-100 text-green-800',
    rojo: 'bg-red-100 text-red-800',
    ambar: 'bg-amber-100 text-amber-800',
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${estilos[tono]}`}>{children}</span>;
}
