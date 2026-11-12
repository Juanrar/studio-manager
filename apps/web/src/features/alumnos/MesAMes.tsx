import { useState } from 'react';
import type { ResumenDeAlumno } from '@studio/shared';
import { Insignia } from '../../components/ui/index.tsx';
import { formatearFecha, formatearMes, nombreDelMes } from '../../lib/formato.ts';

type Mes = ResumenDeAlumno['meses'][number];
type Compra = Mes['compras'][number];

const ALTO_DEL_GRAFICO = 120;
const ALTO_MINIMO = 2;

const textoDeCompra = ({ pack, veces }: Compra) => (veces > 1 ? `${veces} × ${pack}` : pack);
const textoDeCompras = (compras: Compra[]) => compras.map(textoDeCompra).join(', ');
const textoDeClases = (cantidad: number) => `${cantidad} ${cantidad === 1 ? 'clase tomada' : 'clases tomadas'}`;

// Los últimos meses del alumno: un gráfico a la izquierda y, a la derecha, el detalle del mes elegido.
// El mes elegido es estado local y empieza en el último.
export function MesAMes({ meses }: { meses: Mes[] }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const mes = meses.find((m) => m.mes === elegido) ?? meses[meses.length - 1];
  if (mes === undefined) return null;
  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)_19rem] gap-8 border-t border-borde pt-5">
      <section>
        <h3 className="mb-2.5 text-[15px] font-semibold">Mes a mes</h3>
        <GraficoPorMes meses={meses} elegido={mes.mes} alElegir={setElegido} />
      </section>
      <section
        aria-label={formatearMes(mes.mes)}
        className="max-h-64 overflow-auto rounded-md border border-borde p-3"
      >
        <ResumenDelMes mes={mes} />
        <div className="mt-2">
          <ClasesDelMes key={mes.mes} mes={mes} />
        </div>
      </section>
    </div>
  );
}

// Una barra por mes: las clases que tomó y, encima, las que se le vencieron. Debajo, lo que compró.
function GraficoPorMes({
  meses,
  elegido,
  alElegir,
}: {
  meses: Mes[];
  elegido: string;
  alElegir: (mes: string) => void;
}) {
  // Con todos los meses en cero no hay escala: se divide por 1 y cada barra queda en el mínimo.
  const maximo = Math.max(1, ...meses.map((mes) => mes.tomadas + mes.vencidas));
  return (
    <div>
      <div className="flex items-end gap-1.5">
        {meses.map((mes) => {
          const activo = mes.mes === elegido;
          return (
            <button
              key={mes.mes}
              type="button"
              aria-pressed={activo}
              aria-label={`${formatearMes(mes.mes)}: ${textoDeClases(mes.tomadas)}`}
              title={mes.compras.length > 0 ? textoDeCompras(mes.compras) : undefined}
              onClick={() => alElegir(mes.mes)}
              className={`group flex min-w-0 flex-1 flex-col items-center rounded-md px-0.5 pt-1 pb-1.5 ${activo ? 'bg-elevado' : 'hover:bg-elevado/60'}`}
            >
              <span className={`text-xs ${activo ? 'text-texto' : 'text-apagado'}`}>{mes.tomadas}</span>
              <span className="mt-1 flex w-full max-w-7 flex-col justify-end" style={{ height: ALTO_DEL_GRAFICO }}>
                {mes.vencidas > 0 && (
                  <span
                    className="mb-px rounded-t-sm bg-amber-400/60"
                    style={{ height: (mes.vencidas / maximo) * ALTO_DEL_GRAFICO }}
                  />
                )}
                <span
                  className={`${mes.vencidas > 0 ? '' : 'rounded-t-sm'} ${activo ? 'bg-acento' : 'bg-acento/50 group-hover:bg-acento/75'}`}
                  style={{ height: Math.max((mes.tomadas / maximo) * ALTO_DEL_GRAFICO, ALTO_MINIMO) }}
                />
              </span>
              <span className={`mt-1.5 text-xs ${activo ? 'font-medium text-texto' : 'text-tenue'}`}>
                {nombreDelMes(mes.mes).slice(0, 3)}
              </span>
              <span className="line-clamp-2 h-[2.5em] w-full break-words text-center text-[10px] leading-tight text-apagado">
                <ComprasDebajoDeLaBarra compras={mes.compras} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-apagado">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-acento" /> Clases tomadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-amber-400/60" /> Vencidas sin usar
        </span>
      </div>
    </div>
  );
}

function ComprasDebajoDeLaBarra({ compras }: { compras: Compra[] }) {
  const primera = compras[0];
  if (primera === undefined) return '—';
  return compras.length > 1 ? `${textoDeCompra(primera)} +${compras.length - 1}` : textoDeCompra(primera);
}

function ResumenDelMes({ mes }: { mes: Mes }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h4 className="font-semibold">{formatearMes(mes.mes)}</h4>
      {mes.compras.map((compra) => (
        <Insignia key={compra.pack} tono="violeta">
          {textoDeCompra(compra)}
        </Insignia>
      ))}
      <span className="text-tenue">{textoDeClases(mes.tomadas)}</span>
      {mes.vencidas > 0 && <Insignia tono="ambar">{mes.vencidas} sin usar</Insignia>}
    </div>
  );
}

function ClasesDelMes({ mes }: { mes: Mes }) {
  if (mes.clases.length === 0) return <p className="py-2 text-apagado">No tomó clases este mes.</p>;
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-apagado">
          <th className="h-7 w-20 pr-3 font-medium">Día</th>
          <th className="h-7 pr-3 font-medium">Clase</th>
          <th className="h-7 font-medium">Profesor</th>
        </tr>
      </thead>
      <tbody>
        {/* Dos clases pueden caer el mismo día: la fecha no sirve de clave. */}
        {mes.clases.map((clase, indice) => (
          <tr key={indice} className="border-t border-borde">
            <td className="h-7 pr-3 text-tenue">{formatearFecha(clase.fecha).slice(0, 5)}</td>
            <td className="h-7 pr-3">{clase.estilo}</td>
            <td className="h-7 text-tenue">
              {clase.profesor.nombre} {clase.profesor.apellido}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
