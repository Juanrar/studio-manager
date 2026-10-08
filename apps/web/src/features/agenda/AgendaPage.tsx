import { Link, useNavigate, useSearchParams } from 'react-router';
import type { HorarioDelDia, EstadoSesion } from '@studio/shared';
import {
  Aviso,
  Boton,
  BotonIcono,
  Cargando,
  Celda,
  CeldaDeAcciones,
  Insignia,
  Pagina,
  Tabla,
  claseDeBoton,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga, sumarDias } from '../../lib/formato.ts';
import { useAbrirSesion, useAgenda } from './api.ts';

type Tono = 'gris' | 'verde' | 'rojo';

// Sin sesión, la clase todavía no se abrió. `dictada` existe en el esquema, pero la API aún no la asigna.
const ESTADOS: Record<EstadoSesion, { texto: string; tono: Tono }> = {
  programada: { texto: 'Abierta', tono: 'verde' },
  dictada: { texto: 'Dictada', tono: 'gris' },
  cancelada: { texto: 'Cancelada', tono: 'rojo' },
};

export function AgendaPage() {
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const fecha = parametros.get('fecha') ?? undefined;
  const agenda = useAgenda(fecha);
  const abrir = useAbrirSesion();
  const irA = (nueva: string | undefined) => setParametros(nueva === undefined ? {} : { fecha: nueva });

  return (
    <Pagina
      titulo="Agenda"
      acciones={
        agenda.data && (
          <>
            <BotonIcono icono="anterior" etiqueta="Día anterior" onClick={() => irA(sumarDias(agenda.data.fecha, -1))} />
            <Boton variante="secundario" onClick={() => irA(undefined)}>
              Hoy
            </Boton>
            <BotonIcono icono="siguiente" etiqueta="Día siguiente" onClick={() => irA(sumarDias(agenda.data.fecha, 1))} />
          </>
        )
      }
      barra={agenda.data && <p className="font-medium first-letter:uppercase">{formatearFechaLarga(agenda.data.fecha)}</p>}
    >
      {agenda.isPending && <Cargando />}
      {agenda.isError && <Aviso>{mensajeDeError(agenda.error)}</Aviso>}
      {abrir.isError && <Aviso>{mensajeDeError(abrir.error)}</Aviso>}
      {agenda.data && agenda.data.items.length === 0 && <p className="text-apagado">No hay clases este día.</p>}
      {agenda.data && agenda.data.items.length > 0 && (
        <Tabla columnas={['Horario', 'Clase', 'Nivel', 'Profesor', 'Asistentes', 'Estado', '']}>
          {agenda.data.items.map((clase) => (
            <FilaDeClase
              key={clase.horarioId}
              clase={clase}
              abriendo={abrir.isPending}
              alTomarAsistencia={() =>
                abrir.mutate(
                  { horarioId: clase.horarioId, fecha: agenda.data.fecha },
                  { onSuccess: (abierta) => navegar(`/sesiones/${abierta.id}`) },
                )
              }
            />
          ))}
        </Tabla>
      )}
    </Pagina>
  );
}

function FilaDeClase({
  clase,
  abriendo,
  alTomarAsistencia,
}: {
  clase: HorarioDelDia;
  abriendo: boolean;
  alTomarAsistencia: () => void;
}) {
  const { sesion } = clase;
  const profesor = sesion?.profesor ?? clase.profesorTitular;
  const esSuplente = sesion !== null && sesion.profesor.id !== clase.profesorTitular.id;
  const estado = sesion === null ? { texto: 'Sin abrir', tono: 'gris' as const } : ESTADOS[sesion.estado];

  return (
    <tr>
      <Celda>
        {clase.horaInicio} a {clase.horaFin}
      </Celda>
      <Celda className="font-medium">{clase.estilo}</Celda>
      <Celda>{clase.nivel ?? '—'}</Celda>
      <Celda>
        {profesor.nombre} {profesor.apellido}
        {esSuplente && ' (suplente)'}
      </Celda>
      <Celda>{sesion === null ? '—' : sesion.asistentes}</Celda>
      <Celda>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </Celda>
      <CeldaDeAcciones>
        {sesion === null ? (
          <Boton disabled={abriendo} onClick={alTomarAsistencia}>
            Tomar asistencia
          </Boton>
        ) : (
          <Link to={`/sesiones/${sesion.id}`} className={claseDeBoton('secundario')}>
            Ver asistencia
          </Link>
        )}
      </CeldaDeAcciones>
    </tr>
  );
}
