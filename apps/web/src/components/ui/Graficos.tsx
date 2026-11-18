const ANCHO = 600;
const ALTO = 160;
const MARGEN = 8;
const ALTO_UTIL = ALTO - MARGEN * 2;

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

type DatoDeBarra = { etiqueta: string; barra: number };

function RectasDeBarras<Dato extends DatoDeBarra>({
  datos,
  texto,
}: {
  datos: readonly Dato[];
  texto: (dato: Dato) => string;
}) {
  const ranura = ANCHO / Math.max(datos.length, 1);
  const maximo = Math.max(...datos.map((dato) => dato.barra), 0) || 1;
  return datos.map((dato, indice) => {
    const alto = redondear((dato.barra / maximo) * ALTO_UTIL);
    return (
      <rect
        key={indice}
        x={redondear(ranura * indice + ranura * 0.2)}
        y={redondear(ALTO - MARGEN - alto)}
        width={redondear(ranura * 0.6)}
        height={alto}
        className="fill-acento/50"
      >
        <title>{`${dato.etiqueta}: ${texto(dato)}`}</title>
      </rect>
    );
  });
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
  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="group" aria-label={etiqueta} className="h-auto w-full">
      <line x1="0" x2={ANCHO} y1={ALTO - MARGEN} y2={ALTO - MARGEN} className="stroke-borde-fuerte" />
      <RectasDeBarras datos={datos} texto={(dato) => textoBarra(dato.barra)} />
    </svg>
  );
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
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="group" aria-label={etiqueta} className="h-auto w-full">
      <line x1="0" x2={ANCHO} y1={ALTO - MARGEN} y2={ALTO - MARGEN} className="stroke-borde-fuerte" />
      <RectasDeBarras datos={datos} texto={(dato) => `${dato.barra} ${unidadBarra}, ${textoLinea(dato.linea)}`} />
      <polyline
        points={puntos.join(' ')}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-texto"
      />
    </svg>
  );
}

export type TonoDeSegmento = 'verde' | 'ambar' | 'rojo' | 'neutro';

const rellenos: Record<TonoDeSegmento, string> = {
  verde: 'fill-green-500',
  ambar: 'fill-amber-500',
  rojo: 'fill-red-500',
  neutro: 'fill-apagado',
};

const puntos: Record<TonoDeSegmento, string> = {
  verde: 'bg-green-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
  neutro: 'bg-apagado',
};

export type Segmento = { etiqueta: string; valor: number; tono: TonoDeSegmento };

export function BarraApilada({ etiqueta, segmentos }: { etiqueta: string; segmentos: readonly Segmento[] }) {
  const total = segmentos.reduce((suma, segmento) => suma + segmento.valor, 0);
  let acumulado = 0;

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${ANCHO} 24`} role="group" aria-label={etiqueta} className="h-auto w-full">
        <rect x="0" y="0" width={ANCHO} height="24" rx="4" className="fill-elevado" />
        {segmentos.map((segmento) => {
          const ancho = total === 0 ? 0 : redondear((segmento.valor / total) * ANCHO);
          const x = redondear(acumulado);
          acumulado += ancho;
          return (
            <rect key={segmento.etiqueta} x={x} y="0" width={ancho} height="24" className={rellenos[segmento.tono]}>
              <title>{`${segmento.etiqueta}: ${segmento.valor}`}</title>
            </rect>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-tenue">
        {segmentos.map((segmento) => (
          <li key={segmento.etiqueta} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-full ${puntos[segmento.tono]}`} />
            {`${segmento.etiqueta}: ${segmento.valor}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
