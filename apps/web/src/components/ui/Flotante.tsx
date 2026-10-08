import { useEffect, type ReactNode } from 'react';

// Un rectángulo de la pantalla junto al que se abre la caja: el de la clase que se tocó, por ejemplo.
export type Ancla = { left: number; right: number; top: number };

const MARGEN = 8;

// Una caja chica junto a algo de la pantalla, en lugar de un diálogo en el centro. Se abre a la derecha del
// ancla y se corre a la izquierda si no entra. Un clic afuera o Escape la cierran. Va en z-20, como un
// diálogo: la lista del selector de hora (z-30) se abre por encima.
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
