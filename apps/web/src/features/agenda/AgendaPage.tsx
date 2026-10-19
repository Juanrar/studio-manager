import { Fragment, useEffect, useRef, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Clase } from '@studio/shared';
import {
  Aviso,
  Avatar,
  Boton,
  BotonIcono,
  Cargando,
  Icono,
  Insignia,
  Pagina,
  colorDeNombre,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga, horaEnEstudio, hoyEnEstudio, sumarDias } from '../../lib/formato.ts';
import { useAhora } from '../../lib/useAhora.ts';
import { useAgenda } from './api.ts';
import { agruparPorHora, type GrupoDeClases } from './grupos.ts';

export function AgendaPage() {
  const [parametros, setParametros] = useSearchParams();
  const fecha = parametros.get('fecha') ?? undefined;
  const agenda = useAgenda(fecha);
  const irA = (nueva: string | undefined) => setParametros(nueva === undefined ? {} : { fecha: nueva });
  // La API decide cuál es el día cuando la dirección no trae fecha: el de hoy en el estudio.
  const dia = agenda.data?.desde;
  const ahora = useAhora();
  // El ahora solo cuenta si el día que se ve es hoy; si no, la hora es null y no se marca nada.
  const esHoy = dia !== undefined && dia === hoyEnEstudio(ahora);
  const hora = esHoy ? horaEnEstudio(ahora) : null;
  const hayClases = agenda.data !== undefined && agenda.data.items.length > 0;
  const lineaDeAhora = useRef<HTMLLIElement>(null);
  // Baja hasta la línea cuando llegan las clases de hoy. No depende de la hora: el cambio de minuto no mueve la pantalla.
  useEffect(() => {
    if (esHoy && hayClases) lineaDeAhora.current?.scrollIntoView?.({ block: 'center' }); // jsdom no lo implementa
  }, [esHoy, hayClases, dia]);
  const fueraDelHorizonte = agenda.data !== undefined && agenda.data.desde > agenda.data.finDelHorizonte;

  return (
    <Pagina
      titulo="Agenda"
      acciones={
        dia !== undefined && (
          <>
            <BotonIcono icono="anterior" etiqueta="Día anterior" onClick={() => irA(sumarDias(dia, -1))} />
            <Boton variante="secundario" onClick={() => irA(undefined)}>
              Hoy
            </Boton>
            <BotonIcono icono="siguiente" etiqueta="Día siguiente" onClick={() => irA(sumarDias(dia, 1))} />
          </>
        )
      }
      barra={dia !== undefined && <p className="font-medium first-letter:uppercase">{formatearFechaLarga(dia)}</p>}
    >
      {agenda.isPending && <Cargando />}
      {agenda.isError && <Aviso>{mensajeDeError(agenda.error)}</Aviso>}
      {fueraDelHorizonte && <p className="text-apagado">La grilla de ese día todavía no está armada.</p>}
      {agenda.data && !fueraDelHorizonte && agenda.data.items.length === 0 && (
        <p className="text-apagado">No hay clases este día.</p>
      )}
      {agenda.data && agenda.data.items.length > 0 && (
        <ol aria-label="Clases del día">
          {renglonesDelDia(agruparPorHora(agenda.data.items), hora, lineaDeAhora)}
        </ol>
      )}
    </Pagina>
  );
}

// Los renglones de la lista. Con `hora` (el día es hoy), la línea va antes del primer grupo con alguna clase que no terminó.
function renglonesDelDia(grupos: GrupoDeClases[], hora: string | null, referenciaDeLinea: RefObject<HTMLLIElement | null>) {
  const posicionDeLinea =
    hora === null ? -1 : grupos.findIndex((grupo) => grupo.clases.some((clase) => !terminada(clase, hora)));
  const renglones = grupos.map((grupo, i) => (
    <Fragment key={`${grupo.horaInicio}-${grupo.horaFin}`}>
      {i === posicionDeLinea && <LineaDeAhora referencia={referenciaDeLinea} />}
      <RenglonDeGrupo grupo={grupo} hora={hora} />
    </Fragment>
  ));
  if (hora !== null && posicionDeLinea === -1) renglones.push(<LineaDeAhora key="ahora" referencia={referenciaDeLinea} />);
  return renglones;
}

const terminada = (clase: Clase, hora: string) => clase.horaFin <= hora;
const enCurso = (clase: Clase, hora: string) =>
  clase.estado !== 'cancelada' && clase.horaInicio <= hora && hora < clase.horaFin;

function LineaDeAhora({ referencia }: { referencia: RefObject<HTMLLIElement | null> }) {
  return (
    <li ref={referencia} className="flex items-center gap-3 py-2">
      <Insignia tono="verde">Ahora</Insignia>
      <span aria-hidden="true" className="h-0.5 flex-1 bg-green-500" />
    </li>
  );
}

function RenglonDeGrupo({ grupo, hora }: { grupo: GrupoDeClases; hora: string | null }) {
  const activo = hora !== null && grupo.clases.some((clase) => enCurso(clase, hora));
  return (
    <li
      className={`flex gap-4 py-3 ${activo ? '-mx-3 rounded-lg bg-elevado px-3' : 'border-b border-borde last:border-b-0'}`}
    >
      <div className="w-14 flex-none">
        <p className="text-[15px] font-semibold tabular-nums">{grupo.horaInicio}</p>
        <p className="text-xs text-apagado">a {grupo.horaFin}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {grupo.clases.map((clase) => (
          <ClaseDeLista key={clase.id} clase={clase} hora={hora} />
        ))}
      </div>
    </li>
  );
}

function ClaseDeLista({ clase, hora }: { clase: Clase; hora: string | null }) {
  const esSuplente = clase.profesorTitular !== null && clase.profesor.id !== clase.profesorTitular.id;
  const cancelada = clase.estado === 'cancelada';
  const tachado = cancelada ? 'line-through text-apagado' : '';
  const nombreDelProfesor = `${clase.profesor.nombre} ${clase.profesor.apellido}`;

  return (
    <Link
      to={`/clases/${clase.id}`}
      className={`flex items-stretch gap-3 ${hora !== null && terminada(clase, hora) ? 'opacity-40' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`w-[3px] flex-none rounded-full ${cancelada ? 'bg-borde-fuerte' : ''}`}
        style={cancelada ? undefined : { backgroundColor: colorDeNombre(clase.estilo) }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[15px] font-semibold ${tachado}`}>{clase.estilo}</span>
        <span className="flex items-center gap-1.5 text-tenue">
          <Avatar nombre={clase.profesor.nombre} />
          <span className={tachado}>{nombreDelProfesor}</span>
          {esSuplente && <Insignia tono="ambar">suplente</Insignia>}
          {cancelada && <Insignia tono="rojo">cancelada</Insignia>}
        </span>
      </span>
      {hora !== null && enCurso(clase, hora) && (
        <span className="flex items-center">
          <Insignia tono="verde">en curso</Insignia>
        </span>
      )}
      <span className="flex items-center text-apagado">
        <Icono nombre="siguiente" />
      </span>
    </Link>
  );
}
