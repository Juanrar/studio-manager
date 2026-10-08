import { Link, useNavigate, useSearchParams } from 'react-router';
import type { HorarioDelDia, EstadoClase } from '@studio/shared';
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
import { useAbrirClase, useAgenda } from './api.ts';

type Tono = 'gris' | 'verde' | 'rojo';

// Sin clase, el horario todavía no se abrió ese día. `dictada` existe en el esquema, pero la API aún no la asigna.
const ESTADOS: Record<EstadoClase, { texto: string; tono: Tono }> = {
  programada: { texto: 'Abierta', tono: 'verde' },
  dictada: { texto: 'Dictada', tono: 'gris' },
  cancelada: { texto: 'Cancelada', tono: 'rojo' },
};

export function AgendaPage() {
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const fecha = parametros.get('fecha') ?? undefined;
  const agenda = useAgenda(fecha);
  const abrir = useAbrirClase();
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
          {agenda.data.items.map((horario) => (
            <FilaDeClase
              key={horario.horarioId}
              horario={horario}
              abriendo={abrir.isPending}
              alTomarAsistencia={() =>
                abrir.mutate(
                  { horarioId: horario.horarioId, fecha: agenda.data.fecha },
                  { onSuccess: (abierta) => navegar(`/clases/${abierta.id}`) },
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
  horario,
  abriendo,
  alTomarAsistencia,
}: {
  horario: HorarioDelDia;
  abriendo: boolean;
  alTomarAsistencia: () => void;
}) {
  const { clase } = horario;
  const profesor = clase?.profesor ?? horario.profesorTitular;
  const esSuplente = clase !== null && clase.profesor.id !== horario.profesorTitular.id;
  const estado = clase === null ? { texto: 'Sin abrir', tono: 'gris' as const } : ESTADOS[clase.estado];

  return (
    <tr>
      <Celda>
        {horario.horaInicio} a {horario.horaFin}
      </Celda>
      <Celda className="font-medium">{horario.estilo}</Celda>
      <Celda>{horario.nivel ?? '—'}</Celda>
      <Celda>
        {profesor.nombre} {profesor.apellido}
        {esSuplente && ' (suplente)'}
      </Celda>
      <Celda>{clase === null ? '—' : clase.asistentes}</Celda>
      <Celda>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </Celda>
      <CeldaDeAcciones>
        {clase === null ? (
          <Boton disabled={abriendo} onClick={alTomarAsistencia}>
            Tomar asistencia
          </Boton>
        ) : (
          <Link to={`/clases/${clase.id}`} className={claseDeBoton('secundario')}>
            Ver asistencia
          </Link>
        )}
      </CeldaDeAcciones>
    </tr>
  );
}
