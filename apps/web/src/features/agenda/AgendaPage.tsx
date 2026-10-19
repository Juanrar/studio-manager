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
import { formatearFechaLarga, sumarDias } from '../../lib/formato.ts';
import { useAgenda } from './api.ts';
import { agruparPorHora, type GrupoDeClases } from './grupos.ts';

export function AgendaPage() {
  const [parametros, setParametros] = useSearchParams();
  const fecha = parametros.get('fecha') ?? undefined;
  const agenda = useAgenda(fecha);
  const irA = (nueva: string | undefined) => setParametros(nueva === undefined ? {} : { fecha: nueva });
  // La API decide cuál es el día cuando la dirección no trae fecha: el de hoy en el estudio.
  const dia = agenda.data?.desde;
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
          {agruparPorHora(agenda.data.items).map((grupo) => (
            <RenglonDeGrupo key={`${grupo.horaInicio}-${grupo.horaFin}`} grupo={grupo} />
          ))}
        </ol>
      )}
    </Pagina>
  );
}

function RenglonDeGrupo({ grupo }: { grupo: GrupoDeClases }) {
  return (
    <li className="flex gap-4 border-b border-borde py-3 last:border-b-0">
      <div className="w-14 flex-none">
        <p className="text-[15px] font-semibold tabular-nums">{grupo.horaInicio}</p>
        <p className="text-xs text-apagado">a {grupo.horaFin}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {grupo.clases.map((clase) => (
          <ClaseDeLista key={clase.id} clase={clase} />
        ))}
      </div>
    </li>
  );
}

function ClaseDeLista({ clase }: { clase: Clase }) {
  const esSuplente = clase.profesorTitular !== null && clase.profesor.id !== clase.profesorTitular.id;
  const cancelada = clase.estado === 'cancelada';
  const tachado = cancelada ? 'line-through text-apagado' : '';
  const nombreDelProfesor = `${clase.profesor.nombre} ${clase.profesor.apellido}`;

  return (
    <Link to={`/clases/${clase.id}`} className="flex items-stretch gap-3">
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
      <span className="flex items-center text-apagado">
        <Icono nombre="siguiente" />
      </span>
    </Link>
  );
}
