import { useEffect } from 'react';

// Lo que muestra el aviso de abajo después de un cambio en la grilla: qué pasó, y cómo llevarlo a todas
// las semanas o deshacerlo. Un error de la API también sale acá, con su motivo.
export type ContenidoDelAviso =
  | {
      tipo: 'cambio';
      texto: string;
      todas?: { etiqueta: string; hacer: () => void } | undefined;
      deshacer?: (() => void) | undefined;
    }
  | { tipo: 'error'; texto: string };

const DURACION = 8000;

export function AvisoDeCambio({ aviso, alCerrar }: { aviso: ContenidoDelAviso; alCerrar: () => void }) {
  useEffect(() => {
    const reloj = setTimeout(alCerrar, DURACION);
    return () => clearTimeout(reloj);
  }, [aviso, alCerrar]);

  const accion = 'rounded px-2 py-1 font-medium hover:bg-resalte';
  return (
    <div
      role={aviso.tipo === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border py-2 pr-2 pl-3 shadow-2xl shadow-black/60 ${
        aviso.tipo === 'error' ? 'border-red-500/30 bg-red-950 text-red-200' : 'border-borde-fuerte bg-elevado'
      }`}
    >
      <span>{aviso.texto}</span>
      {aviso.tipo === 'cambio' && aviso.todas && (
        <button
          type="button"
          className={`${accion} text-acento`}
          onClick={() => {
            aviso.todas!.hacer();
            alCerrar();
          }}
        >
          {aviso.todas.etiqueta}
        </button>
      )}
      {aviso.tipo === 'cambio' && aviso.deshacer && (
        <button
          type="button"
          className={`${accion} text-tenue hover:text-texto`}
          onClick={() => {
            aviso.deshacer!();
            alCerrar();
          }}
        >
          Deshacer
        </button>
      )}
      {aviso.tipo === 'error' && (
        <button type="button" className={accion} onClick={alCerrar}>
          Cerrar
        </button>
      )}
    </div>
  );
}
