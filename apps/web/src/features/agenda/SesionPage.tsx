import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { SesionDetalle } from '@studio/shared';
import { Aviso, Boton, Campo, Cargando, Celda, Insignia, Selector, Tabla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga } from '../../lib/formato.ts';
import { useProfesores } from '../profesores/api.ts';
import { AnotarAlumno } from './AnotarAlumno.tsx';
import { useActualizarSesion, useAsistencias, useQuitarAsistencia, useSesionDeClase } from './api.ts';

export function SesionPage() {
  const id = Number(useParams().id);
  const sesion = useSesionDeClase(id);

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Aviso>{mensajeDeError(sesion.error)}</Aviso>;
  const datos = sesion.data;
  const cancelada = datos.estado === 'cancelada';

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link to={`/agenda?fecha=${datos.fecha}`} className="text-sm text-violet-800 hover:underline">
          ← Agenda
        </Link>
        <h1 className="text-2xl font-semibold">Asistencia · {datos.estilo}</h1>
        <p className="capitalize text-stone-600">
          {formatearFechaLarga(datos.fecha)}, {datos.horaInicio} a {datos.horaFin}
          {datos.nivel !== null && ` · ${datos.nivel}`}
        </p>
        {cancelada && <Insignia tono="rojo">Cancelada</Insignia>}
      </div>

      <Suplencia sesion={datos} />
      {!cancelada && <AnotarAlumno sesionId={id} />}
      <Asistentes sesionId={id} />
      {!cancelada && <CancelarClase sesionId={id} />}
    </section>
  );
}

function Suplencia({ sesion }: { sesion: SesionDetalle }) {
  const profesores = useProfesores();
  const actualizar = useActualizarSesion(sesion.id);
  const [elegido, setElegido] = useState(String(sesion.profesor.id));
  const opciones = profesores.data ?? [];
  // El profesor actual siempre aparece, aunque esté dado de baja.
  const incluyeActual = opciones.some((profesor) => profesor.id === sesion.profesor.id);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64">
        <Campo etiqueta="Profesor que da la clase">
          {(id) => (
            <Selector id={id} value={elegido} onChange={(evento) => setElegido(evento.target.value)}>
              {!incluyeActual && (
                <option value={sesion.profesor.id}>
                  {sesion.profesor.nombre} {sesion.profesor.apellido}
                </option>
              )}
              {opciones.map((profesor) => (
                <option key={profesor.id} value={profesor.id}>
                  {profesor.nombre} {profesor.apellido}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
      </div>
      <Boton
        variante="secundario"
        disabled={elegido === String(sesion.profesor.id) || actualizar.isPending}
        onClick={() => actualizar.mutate({ profesorId: Number(elegido) })}
      >
        Registrar suplencia
      </Boton>
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
    </div>
  );
}

function Asistentes({ sesionId }: { sesionId: number }) {
  const asistencias = useAsistencias(sesionId);
  const quitar = useQuitarAsistencia(sesionId);

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Asistentes</h2>
      {asistencias.isPending && <Cargando />}
      {quitar.isError && <Aviso>{mensajeDeError(quitar.error)}</Aviso>}
      {asistencias.data?.length === 0 && <p className="text-sm text-stone-500">Todavía no hay asistentes.</p>}
      {asistencias.data && asistencias.data.length > 0 && (
        <Tabla columnas={['Alumno', 'Pack', '']}>
          {asistencias.data.map((asistencia) => (
            <tr key={asistencia.id}>
              <Celda>
                {asistencia.alumno.apellido}, {asistencia.alumno.nombre}
              </Celda>
              <Celda>{asistencia.pack}</Celda>
              <Celda className="text-right">
                <Boton variante="secundario" disabled={quitar.isPending} onClick={() => quitar.mutate(asistencia.id)}>
                  Quitar
                </Boton>
              </Celda>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  );
}

function CancelarClase({ sesionId }: { sesionId: number }) {
  const actualizar = useActualizarSesion(sesionId);
  return (
    <div className="flex flex-col items-start gap-2">
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      <Boton variante="peligro" disabled={actualizar.isPending} onClick={() => actualizar.mutate({ estado: 'cancelada' })}>
        Cancelar clase
      </Boton>
    </div>
  );
}
