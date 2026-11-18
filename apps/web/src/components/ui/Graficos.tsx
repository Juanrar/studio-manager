import { useState, type ReactNode } from 'react';

const ANCHO = 600;
const ALTO = 160;
const MARGEN = 8;
const ALTO_UTIL = ALTO - MARGEN * 2;

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

type DatoDeBarra = { etiqueta: string; barra: number };

function DetalleFlotante({ titulo, lineas, posicion }: { titulo: string; lineas: readonly string[]; posicion: number }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-borde-fuerte bg-elevado px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: `${posicion * 100}%`, transform: `translateX(-${posicion * 100}%)` }}
    >
      <p className="font-medium text-texto">{titulo}</p>
      {lineas.map((linea) => (
        <p key={linea} className="text-tenue">
          {linea}
        </p>
      ))}
    </div>
  );
}

function GraficoDeBarras<Dato extends DatoDeBarra>({
  etiqueta,
  datos,
  detalle,
  children,
}: {
  etiqueta: string;
  datos: readonly Dato[];
  detalle: (dato: Dato) => string[];
  children?: ReactNode;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const ranura = ANCHO / Math.max(datos.length, 1);
  const maximo = Math.max(...datos.map((dato) => dato.barra), 0) || 1;
  const datoActivo = activo === null ? undefined : datos[activo];

  return (
    <div className="relative" onMouseLeave={() => setActivo(null)}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="group" aria-label={etiqueta} className="h-auto w-full">
        <line x1="0" x2={ANCHO} y1={ALTO - MARGEN} y2={ALTO - MARGEN} className="stroke-borde-fuerte" />
        {datos.map((dato, indice) => {
          const alto = redondear((dato.barra / maximo) * ALTO_UTIL);
          return (
            <g key={indice} onMouseEnter={() => setActivo(indice)}>
              <rect
                aria-label={`${dato.etiqueta}: ${detalle(dato).join(', ')}`}
                x={redondear(ranura * indice + ranura * 0.2)}
                y={redondear(ALTO - MARGEN - alto)}
                width={redondear(ranura * 0.6)}
                height={alto}
                className={indice === activo ? 'fill-acento' : 'fill-acento/50'}
              />
              <rect x={redondear(ranura * indice)} y="0" width={redondear(ranura)} height={ALTO} className="fill-transparent" />
            </g>
          );
        })}
        {children}
      </svg>
      {activo !== null && datoActivo && (
        <DetalleFlotante
          titulo={datoActivo.etiqueta}
          lineas={detalle(datoActivo)}
          posicion={(ranura * activo + ranura / 2) / ANCHO}
        />
      )}
    </div>
  );
}

export function Barras({
  etiqueta,
  datos,
  textoBarra,
}: {
  etiqueta: string;
  datos: readonly DatoDeBarra[];
  textoBarra: (valor: number) => string;
}) {
  return <GraficoDeBarras etiqueta={etiqueta} datos={datos} detalle={(dato) => [textoBarra(dato.barra)]} />;
}

export type DatoDelDia = { etiqueta: string; barra: number; linea: number };

export function BarrasConLinea({
  etiqueta,
  datos,
  unidadBarra,
  textoLinea,
}: {
  etiqueta: string;
  datos: readonly DatoDelDia[];
  unidadBarra: string;
  textoLinea: (valor: number) => string;
}) {
  const ranura = ANCHO / Math.max(datos.length, 1);
  const maximoLinea = Math.max(...datos.map((dato) => dato.linea), 0) || 1;
  const centro = (indice: number) => redondear(ranura * indice + ranura / 2);
  const alturaLinea = (valor: number) => redondear(ALTO - MARGEN - (valor / maximoLinea) * ALTO_UTIL);
  const puntos = datos.map((dato, indice) => `${centro(indice)},${alturaLinea(dato.linea)}`);

  return (
    <GraficoDeBarras
      etiqueta={etiqueta}
      datos={datos}
      detalle={(dato) => [`${dato.barra} ${unidadBarra}`, textoLinea(dato.linea)]}
    >
      <polyline
        points={puntos.join(' ')}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="pointer-events-none stroke-texto"
      />
    </GraficoDeBarras>
  );
}
