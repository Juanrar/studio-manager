import { useEffect, type ReactNode } from 'react';

export type Ancla = { left: number; right: number; top: number };

const MARGEN = 8;

export function Flotante({
  ancla,
  ancho,
  etiqueta,
  alCerrar,
  children,
}: {
  ancla: Ancla;
  ancho: number;
  etiqueta: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const alApretar = (evento: KeyboardEvent) => evento.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alApretar);
    return () => window.removeEventListener('keydown', alApretar);
  }, [alCerrar]);

  const entraALaDerecha = ancla.right + MARGEN + ancho <= window.innerWidth;
  const izquierda = entraALaDerecha ? ancla.right + MARGEN : Math.max(MARGEN, ancla.left - ancho - MARGEN);
  const arriba = Math.max(MARGEN, Math.min(ancla.top, window.innerHeight - 460));

  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={alCerrar} />
      <div
        role="dialog"
        aria-label={etiqueta}
        className="fixed z-20 rounded-lg border border-borde-fuerte bg-panel p-3 shadow-2xl shadow-black/60"
        style={{ left: izquierda, top: arriba, width: ancho }}
      >
        {children}
      </div>
    </>
  );
}
