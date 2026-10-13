import type { PointerEvent, RefObject } from 'react';
import type { Clase } from '@studio/shared';
import { colorDeNombre } from '../../components/ui/index.tsx';
import { abreviaturaDelDia, diaDeLaSemana, nombreDelDia } from '../../lib/formato.ts';
import { acomodarEnCascada, type Lugar } from './cascada.ts';
import { FIN_GRILLA, INICIO_GRILLA, PX_POR_MINUTO, aHora, aMinutos } from './minutos.ts';
import type { Fantasma } from './useArrastre.ts';

// La grilla de horas: una columna por día y cada clase ubicada por su horario, con el aspecto de DayFlow.
// Sirve para la semana (siete columnas) y para un día (una columna ancha). Los días que ya pasaron se ven
// igual pero no se editan.

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

export type InteraccionesDeLaGrilla = {
  columnas: RefObject<HTMLDivElement | null>;
  fantasma: Fantasma | null;
  idElegido: number | null;
  alApretarClase: (evento: PointerEvent, clase: Clase) => void;
  alEstirarClase: (evento: PointerEvent, clase: Clase) => void;
  alApretarHueco: (evento: PointerEvent, fecha: string) => void;
};

// Sin `incrustada` es la grilla de la página, editable. Con `incrustada` es de solo lectura, con ese rango de horas
// (minutos desde las 00:00), para mostrarla dentro de otra pantalla.
type PropsDeVistaDeSemana = { fechas: string[]; clases: Clase[]; hoy: string } & (
  | { interacciones: InteraccionesDeLaGrilla; incrustada?: undefined }
  | { incrustada: { inicio: number; fin: number }; interacciones?: undefined }
);

export function VistaDeSemana({ fechas, clases, hoy, interacciones, incrustada }: PropsDeVistaDeSemana) {
  const inicioDelRango = incrustada?.inicio ?? INICIO_GRILLA;
  const finDelRango = incrustada?.fin ?? FIN_GRILLA;
  const alto = (finDelRango - inicioDelRango) * PX_POR_MINUTO;
  const horas = Array.from({ length: (finDelRango - inicioDelRango) / 60 + 1 }, (_, i) => inicioDelRango + i * 60);
  const ancha = fechas.length === 1;
  const lugares = acomodarEnCascada(
    clases.map((clase) => ({ id: clase.id, fecha: clase.fecha, inicio: aMinutos(clase.horaInicio), fin: aMinutos(clase.horaFin) })),
  );
  const columnas = { gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` };
  const fantasma = interacciones?.fantasma ?? null;
  // La etiqueta roja de la hora actual tapa la hora en punto que tenga cerca: esa no se escribe.
  const ahora = !incrustada && fechas.includes(hoy) ? minutosDeAhora() : null;
  const horasConEtiqueta = horas.filter((minutos) => ahora === null || Math.abs(minutos - ahora) >= 15);

  return (
    <div className={incrustada ? 'flex flex-col' : '-m-4 flex h-[calc(100%+2rem)] flex-col'}>
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

      <div className={incrustada ? undefined : 'min-h-0 flex-1 overflow-auto'}>
        <div className={`grid grid-cols-[64px_minmax(0,1fr)] pt-2 ${incrustada ? 'pb-2' : 'pb-16'}`}>
          <div className="relative" style={{ height: alto }}>
            {horasConEtiqueta.map((minutos) => (
              <span
                key={minutos}
                className="absolute right-2 -translate-y-1/2 text-xs font-medium text-tenue tabular-nums"
                style={{ top: (minutos - inicioDelRango) * PX_POR_MINUTO }}
              >
                {aHora(minutos)}
              </span>
            ))}
            {!incrustada && fechas.includes(hoy) && <EtiquetaDeAhora />}
          </div>
          <div ref={interacciones?.columnas} className="relative grid select-none" style={{ ...columnas, height: alto }}>
            {horas.map((minutos) => (
              <div
                key={minutos}
                className="pointer-events-none absolute inset-x-0 border-t border-borde"
                style={{ top: (minutos - inicioDelRango) * PX_POR_MINUTO }}
              />
            ))}
            {fechas.map((fecha, indice) => (
              <div
                key={fecha}
                role="group"
                aria-label={`${nombreDelDia(diaDeLaSemana(fecha))} ${Number(fecha.slice(8))}`}
                className="relative border-l border-borde"
                // Crear en un hueco solo con el mouse: con el dedo, apretar un hueco es empezar a desplazarse.
                onPointerDown={
                  interacciones
                    ? (evento) => {
                        if (evento.pointerType === 'mouse' && fecha >= hoy) interacciones.alApretarHueco(evento, fecha);
                      }
                    : undefined
                }
              >
                {clases
                  .filter((clase) => clase.fecha === fecha)
                  .map((clase) => (
                    <ClaseEnLaGrilla
                      key={clase.id}
                      clase={clase}
                      lugar={lugares.get(clase.id)!}
                      ancha={ancha}
                      inicioDelRango={inicioDelRango}
                      editable={fecha >= hoy}
                      atenuada={fantasma?.id === clase.id}
                      {...(interacciones
                        ? {
                            elegida: interacciones.idElegido === clase.id,
                            alApretar: (evento: PointerEvent) => interacciones.alApretarClase(evento, clase),
                            alEstirar: (evento: PointerEvent) => interacciones.alEstirarClase(evento, clase),
                          }
                        : { soloLectura: true })}
                    />
                  ))}
                {fantasma && fantasma.dia === indice + 1 && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded border border-dashed border-acento/70 bg-acento/15 px-2 py-1 text-xs font-medium"
                    style={{
                      top: (fantasma.inicio - inicioDelRango) * PX_POR_MINUTO,
                      height: (fantasma.fin - fantasma.inicio) * PX_POR_MINUTO - 2,
                    }}
                  >
                    {aHora(fantasma.inicio)} - {aHora(fantasma.fin)}
                  </div>
                )}
                {!incrustada && fecha === hoy && <LineaDeAhora />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaseEnLaGrilla({
  clase,
  lugar,
  ancha,
  inicioDelRango,
  editable,
  atenuada,
  ...resto
}: {
  clase: Clase;
  lugar: Lugar;
  ancha: boolean;
  inicioDelRango: number;
  editable: boolean;
  atenuada: boolean;
} & (
  | { soloLectura?: undefined; elegida: boolean; alApretar: (evento: PointerEvent) => void; alEstirar: (evento: PointerEvent) => void }
  | { soloLectura: true; elegida?: undefined; alApretar?: undefined; alEstirar?: undefined }
)) {
  const color = colorDeNombre(clase.estilo);
  const inicio = aMinutos(clase.horaInicio);
  const alto = (aMinutos(clase.horaFin) - inicio) * PX_POR_MINUTO - 2;
  const corrimiento = lugar.sangria * SANGRIA;
  const cancelada = clase.estado === 'cancelada';
  const profesor = `${clase.profesor.nombre} ${clase.profesor.apellido}`;
  const { soloLectura, elegida, alApretar, alEstirar } = resto;
  const arrastrable = !soloLectura && editable && !cancelada;

  return (
    <div
      {...(soloLectura ? {} : { role: 'button', tabIndex: 0 })}
      aria-label={nombreDeLaClase(clase)}
      data-clase={clase.id}
      onPointerDown={soloLectura ? undefined : alApretar}
      className={`absolute overflow-hidden rounded py-1 pr-1.5 pl-2.5 text-xs leading-snug ${
        cancelada ? 'line-through opacity-50 hover:opacity-80' : soloLectura ? '' : 'hover:brightness-125'
      } ${arrastrable ? 'cursor-grab touch-none active:cursor-grabbing' : !soloLectura && editable ? 'cursor-pointer' : ''} ${
        atenuada ? 'opacity-30' : ''
      } ${elegida ? 'ring-1 ring-white/50' : ''}`}
      style={{
        top: (inicio - inicioDelRango) * PX_POR_MINUTO + 1,
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
      {arrastrable && alEstirar && <div onPointerDown={alEstirar} className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" />}
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
