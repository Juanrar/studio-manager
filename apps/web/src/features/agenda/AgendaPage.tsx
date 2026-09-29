import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ClaseDelDia } from '@studio/shared';
import { Aviso, Boton, BotonIcono, Cargando, Insignia, Pagina } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga, sumarDias } from '../../lib/formato.ts';
import { useAbrirSesion, useAgenda } from './api.ts';

export function AgendaPage() {
  const [parametros, setParametros] = useSearchParams();
  const fecha = parametros.get('fecha') ?? undefined;
  const agenda = useAgenda(fecha);
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
      {agenda.data && (
        <>
          {agenda.data.items.length === 0 && <p className="text-apagado">No hay clases este día.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agenda.data.items.map((clase) => (
              <TarjetaDeClase key={clase.claseId} clase={clase} fecha={agenda.data.fecha} />
            ))}
          </div>
        </>
      )}
    </Pagina>
  );
}

function TarjetaDeClase({ clase, fecha }: { clase: ClaseDelDia; fecha: string }) {
  const navegar = useNavigate();
  const abrir = useAbrirSesion();
  const { sesion } = clase;
  const profesor = sesion?.profesor ?? clase.profesorTitular;
  const esSuplente = sesion !== null && sesion.profesor.id !== clase.profesorTitular.id;

  return (
    <article
      aria-label={`${clase.estilo} ${clase.horaInicio}`}
      className="flex flex-col gap-2 rounded-lg border border-borde bg-elevado p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-apagado">
            {clase.horaInicio} a {clase.horaFin}
          </p>
          <h2 className="text-lg font-semibold">{clase.estilo}</h2>
          {clase.nivel !== null && <p className="text-apagado">{clase.nivel}</p>}
        </div>
        {sesion?.estado === 'cancelada' && <Insignia tono="rojo">Cancelada</Insignia>}
      </div>
      <p className="text-sm">
        {profesor.nombre} {profesor.apellido}
        {esSuplente && ' (suplente)'}
      </p>
      {sesion !== null && (
        <p className="text-apagado">
          {sesion.asistentes} {sesion.asistentes === 1 ? 'asistente' : 'asistentes'}
        </p>
      )}
      {abrir.isError && <Aviso>{mensajeDeError(abrir.error)}</Aviso>}
      <div className="mt-auto">
        {sesion === null ? (
          <Boton
            disabled={abrir.isPending}
            onClick={() =>
              abrir.mutate({ claseId: clase.claseId, fecha }, { onSuccess: (abierta) => navegar(`/sesiones/${abierta.id}`) })
            }
          >
            Tomar asistencia
          </Boton>
        ) : (
          <Link to={`/sesiones/${sesion.id}`} className="font-medium text-acento hover:underline">
            Ver asistencia
          </Link>
        )}
      </div>
    </article>
  );
}
