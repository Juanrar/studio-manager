import type { Clase } from '@studio/shared';
import { colorDeNombre } from '../../components/ui/index.tsx';
import { abreviaturaDelDia, diaDeLaSemana, nombreDelDia, sumarDias } from '../../lib/formato.ts';

// El mes en semanas completas, de lunes a domingo. Cada día lista hasta 4 clases con su hora y su estilo;
// un clic en el día lo abre en la vista Día. Los días de los meses vecinos se ven apagados.

const POR_DIA = 4;

const cantidad = (n: number) => (n === 0 ? 'sin clases' : n === 1 ? '1 clase' : `${n} clases`);

export function VistaDelMes({
  semanas,
  mes,
  clases,
  hoy,
  alElegirDia,
}: {
  semanas: string[];
  mes: string;
  clases: Clase[];
  hoy: string;
  alElegirDia: (fecha: string) => void;
}) {
  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] flex-col">
      <div className="grid flex-none grid-cols-7 border-b border-borde">
        {[1, 2, 3, 4, 5, 6, 7].map((dia) => (
          <div key={dia} aria-hidden="true" className="py-2 text-center text-apagado">
            {abreviaturaDelDia(dia)}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${semanas.length}, minmax(112px, 1fr))` }}>
        {semanas.flatMap((lunes) =>
          [0, 1, 2, 3, 4, 5, 6].map((desplazamiento) => {
            const fecha = sumarDias(lunes, desplazamiento);
            const delDia = clases.filter((clase) => clase.fecha === fecha);
            const numero = Number(fecha.slice(8));
            return (
              <button
                key={fecha}
                type="button"
                aria-label={`${nombreDelDia(diaDeLaSemana(fecha))} ${numero}, ${cantidad(delDia.length)}`}
                onClick={() => alElegirDia(fecha)}
                className={`flex min-w-0 flex-col gap-0.5 overflow-hidden border-r border-b border-borde p-1.5 text-left hover:bg-elevado ${
                  fecha.slice(0, 7) === mes ? '' : 'opacity-40'
                }`}
              >
                <span
                  className={`mb-0.5 grid h-5 min-w-5 place-items-center self-start rounded-full px-1 text-xs ${
                    fecha === hoy ? 'bg-red-500 font-semibold text-white' : 'text-tenue'
                  }`}
                >
                  {numero}
                </span>
                <ul className="flex min-w-0 flex-col gap-0.5">
                  {delDia.slice(0, POR_DIA).map((clase) => {
                    const color = colorDeNombre(clase.estilo);
                    return (
                      <li
                        key={clase.id}
                        className={`flex items-center gap-1.5 truncate text-[11px] ${clase.estado === 'cancelada' ? 'line-through opacity-60' : ''}`}
                        style={{ color: `color-mix(in oklab, ${color} 62%, white)` }}
                      >
                        <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-apagado tabular-nums">{clase.horaInicio}</span> <span className="truncate">{clase.estilo}</span>
                      </li>
                    );
                  })}
                  {delDia.length > POR_DIA && <li className="pl-3 text-[11px] text-apagado">{delDia.length - POR_DIA} más</li>}
                </ul>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
