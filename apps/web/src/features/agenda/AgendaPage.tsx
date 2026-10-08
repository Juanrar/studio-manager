import { Link, useSearchParams } from 'react-router';
import type { Clase, EstadoClase } from '@studio/shared';
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
import { useAgenda } from './api.ts';

type Tono = 'gris' | 'rojo';

// Toda clase ya existe: se crea por adelantado. `dictada` existe en el esquema, pero la API aún no la asigna.
const ESTADOS: Record<EstadoClase, { texto: string; tono: Tono }> = {
  programada: { texto: 'Programada', tono: 'gris' },
  dictada: { texto: 'Dictada', tono: 'gris' },
  cancelada: { texto: 'Cancelada', tono: 'rojo' },
};

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
        <Tabla columnas={['Horario', 'Clase', 'Nivel', 'Profesor', 'Asistentes', 'Estado', '']}>
          {agenda.data.items.map((clase) => (
            <FilaDeClase key={clase.id} clase={clase} />
          ))}
        </Tabla>
      )}
    </Pagina>
  );
}

function FilaDeClase({ clase }: { clase: Clase }) {
  const esSuplente = clase.profesorTitular !== null && clase.profesor.id !== clase.profesorTitular.id;
  const estado = ESTADOS[clase.estado];
  // Una clase sin nadie anotado todavía espera la asistencia; con asistentes o cancelada, se va a mirar.
  const porTomar = clase.estado === 'programada' && clase.asistentes === 0;

  return (
    <tr>
      <Celda>
        {clase.horaInicio} a {clase.horaFin}
      </Celda>
      <Celda className="font-medium">{clase.estilo}</Celda>
      <Celda>{clase.nivel ?? '—'}</Celda>
      <Celda>
        {clase.profesor.nombre} {clase.profesor.apellido}
        {esSuplente && ' (suplente)'}
      </Celda>
      <Celda>{clase.asistentes}</Celda>
      <Celda>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </Celda>
      <CeldaDeAcciones>
        <Link to={`/clases/${clase.id}`} className={claseDeBoton(porTomar ? 'primario' : 'secundario')}>
          {porTomar ? 'Tomar asistencia' : 'Ver asistencia'}
        </Link>
      </CeldaDeAcciones>
    </tr>
  );
}
