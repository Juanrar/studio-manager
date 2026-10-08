import type { Clase } from '@studio/shared';
import { colorDeNombre } from '../../components/ui/index.tsx';
import { abreviaturaDelDia, diaDeLaSemana, nombreDelDia } from '../../lib/formato.ts';
import { acomodarEnCascada, type Lugar } from './cascada.ts';
import { FIN_GRILLA, INICIO_GRILLA, aHora, aMinutos } from './minutos.ts';

// La grilla de horas: una columna por día y cada clase ubicada por su horario, con el aspecto de DayFlow.
// Sirve para la semana (siete columnas) y para un día (una columna ancha).

export const PX_POR_MINUTO = 1.05;
const ALTO = (FIN_GRILLA - INICIO_GRILLA) * PX_POR_MINUTO;
const HORAS = Array.from({ length: (FIN_GRILLA - INICIO_GRILLA) / 60 + 1 }, (_, i) => INICIO_GRILLA + i * 60);
const SANGRIA = 10;

// El texto en el color del estilo, más claro para que se lea sobre el fondo oscuro. El fondo se mezcla con
// el del panel y es opaco: una clase encima de otra no deja ver la de abajo.
const colorDeTexto = (color: string) => `color-mix(in oklab, ${color} 62%, white)`;
const colorDeFondo = (color: string) => `color-mix(in oklab, ${color} 17%, var(--color-panel))`;

export function nombreDeLaClase(clase: Clase): string {
  const estilo = clase.nivel === null ? clase.estilo : `${clase.estilo} ${clase.nivel}`;
  const partes = [estilo, `${clase.horaInicio} a ${clase.horaFin}`, `${clase.profesor.nombre} ${clase.profesor.apellido}`];
  if (clase.estado === 'cancelada') partes.push('cancelada');
  return partes.join(', ');
}

export function VistaDeSemana({ fechas, clases, hoy }: { fechas: string[]; clases: Clase[]; hoy: string }) {
  const ancha = fechas.length === 1;
  const lugares = acomodarEnCascada(
    clases.map((clase) => ({ id: clase.id, fecha: clase.fecha, inicio: aMinutos(clase.horaInicio), fin: aMinutos(clase.horaFin) })),
  );
  const columnas = { gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` };

  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] flex-col">
      <div className="grid flex-none grid-cols-[64px_minmax(0,1fr)] border-b border-borde">
        <div />
        <div className="grid" style={columnas}>
          {fechas.map((fecha) => (
            <div
              key={fecha}
              aria-hidden="true"
              className={`py-2.5 text-center ${fecha === hoy ? 'font-semibold text-texto' : 'text-apagado'}`}
            >
              {ancha ? nombreDelDia(diaDeLaSemana(fecha)) : abreviaturaDelDia(diaDeLaSemana(fecha))}
              <span className="ml-1.5">{Number(fecha.slice(8))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] pt-2 pb-16">
          <div className="relative" style={{ height: ALTO }}>
            {HORAS.map((minutos) => (
              <span
                key={minutos}
                className="absolute right-2 -translate-y-1/2 text-xs font-medium text-tenue tabular-nums"
                style={{ top: (minutos - INICIO_GRILLA) * PX_POR_MINUTO }}
              >
                {aHora(minutos)}
              </span>
            ))}
            {fechas.includes(hoy) && <EtiquetaDeAhora />}
          </div>
          <div className="relative grid select-none" style={{ ...columnas, height: ALTO }}>
            {HORAS.map((minutos) => (
              <div
                key={minutos}
                className="pointer-events-none absolute inset-x-0 border-t border-borde"
                style={{ top: (minutos - INICIO_GRILLA) * PX_POR_MINUTO }}
              />
            ))}
            {fechas.map((fecha) => (
              <div
                key={fecha}
                role="group"
                aria-label={`${nombreDelDia(diaDeLaSemana(fecha))} ${Number(fecha.slice(8))}`}
                className="relative border-l border-borde"
              >
                {clases
                  .filter((clase) => clase.fecha === fecha)
                  .map((clase) => (
                    <ClaseEnLaGrilla key={clase.id} clase={clase} lugar={lugares.get(clase.id)!} ancha={ancha} />
                  ))}
                {fecha === hoy && <LineaDeAhora />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaseEnLaGrilla({ clase, lugar, ancha }: { clase: Clase; lugar: Lugar; ancha: boolean }) {
  const color = colorDeNombre(clase.estilo);
  const inicio = aMinutos(clase.horaInicio);
  const alto = (aMinutos(clase.horaFin) - inicio) * PX_POR_MINUTO - 2;
  const corrimiento = lugar.sangria * SANGRIA;
  const cancelada = clase.estado === 'cancelada';
  const profesor = `${clase.profesor.nombre} ${clase.profesor.apellido}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={nombreDeLaClase(clase)}
      data-clase={clase.id}
      className={`absolute overflow-hidden rounded py-1 pr-1.5 pl-2.5 text-xs leading-snug ${cancelada ? 'line-through opacity-50' : 'hover:brightness-125'}`}
      style={{
        top: (inicio - INICIO_GRILLA) * PX_POR_MINUTO + 1,
        height: alto,
        left: `calc(${corrimiento}px + (100% - ${corrimiento}px) * ${lugar.carril / lugar.carriles} + 2px)`,
        width: `calc((100% - ${corrimiento}px) / ${lugar.carriles} - 4px)`,
        zIndex: lugar.sangria + 1,
        backgroundColor: colorDeFondo(color),
        color: colorDeTexto(color),
        // La barra de color a la izquierda, y un borde del color del panel que separa una clase de la que tiene abajo.
        boxShadow: `inset 3px 0 0 ${color}${lugar.sangria > 0 ? ', 0 0 0 1px var(--color-panel)' : ''}`,
      }}
    >
      {clase.tieneCambios && !cancelada && (
        <span title="Cambio solo de esta semana" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-400" />
      )}
      <p className="truncate font-medium">{clase.estilo}</p>
      {alto >= 34 && (
        <p className="truncate tabular-nums opacity-80">
          {clase.horaInicio} - {clase.horaFin}
          {ancha && ` · ${clase.nivel ?? ''} · ${profesor}`}
        </p>
      )}
      {!ancha && alto >= 64 && <p className="truncate opacity-70">{profesor}</p>}
    </div>
  );
}

// La hora de ahora en la zona del estudio, en minutos desde las 00:00.
function minutosDeAhora(): number {
  const [horas, minutos] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .split(':')
    .map(Number) as [number, number];
  return horas * 60 + minutos;
}

function LineaDeAhora() {
  const minutos = minutosDeAhora();
  if (minutos < INICIO_GRILLA || minutos > FIN_GRILLA) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-40" style={{ top: (minutos - INICIO_GRILLA) * PX_POR_MINUTO }}>
      <span className="absolute -top-[3.5px] -left-1 size-2 rounded-full bg-red-500" />
      <div className="h-px bg-red-500" />
    </div>
  );
}

function EtiquetaDeAhora() {
  const minutos = minutosDeAhora();
  if (minutos < INICIO_GRILLA || minutos > FIN_GRILLA) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute right-1 z-10 -translate-y-1/2 rounded bg-red-500 px-1 text-[11px] font-semibold text-white tabular-nums"
      style={{ top: (minutos - INICIO_GRILLA) * PX_POR_MINUTO }}
    >
      {aHora(minutos)}
    </span>
  );
}
