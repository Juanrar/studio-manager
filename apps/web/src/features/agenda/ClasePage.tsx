import { useState } from 'react';
import { useParams } from 'react-router';
import type { ClaseDetalle } from '@studio/shared';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Celda,
  CeldaDeAcciones,
  Insignia,
  Pagina,
  Selector,
  Tabla,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga } from '../../lib/formato.ts';
import { useProfesores } from '../profesores/api.ts';
import { AnotarAlumno } from './AnotarAlumno.tsx';
import { useActualizarClase, useAsistencias, useQuitarAsistencia, useDetalleDeClase } from './api.ts';

export function ClasePage() {
  const id = Number(useParams().id);
  const clase = useDetalleDeClase(id);

  if (clase.isPending) return <Cargando />;
  if (clase.isError) return <Aviso>{mensajeDeError(clase.error)}</Aviso>;
  const datos = clase.data;
  const cancelada = datos.estado === 'cancelada';

  return (
    <Pagina
      volverA={{ ruta: `/agenda?fecha=${datos.fecha}`, texto: 'Agenda' }}
      titulo={`Asistencia · ${datos.estilo}`}
      barra={
        <>
          <p className="text-tenue first-letter:uppercase">
            {formatearFechaLarga(datos.fecha)}, {datos.horaInicio} a {datos.horaFin}
            {datos.nivel !== null && ` · ${datos.nivel}`}
          </p>
          {cancelada && <Insignia tono="rojo">Cancelada</Insignia>}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Suplencia clase={datos} />
        {!cancelada && <AnotarAlumno claseId={id} />}
        <Asistentes claseId={id} />
        {!cancelada && <CancelarClase claseId={id} />}
      </div>
    </Pagina>
  );
}

function Suplencia({ clase }: { clase: ClaseDetalle }) {
  const profesores = useProfesores();
  const actualizar = useActualizarClase(clase.id);
  const [elegido, setElegido] = useState(String(clase.profesor.id));
  const opciones = profesores.data ?? [];
  // El profesor actual siempre aparece, aunque esté dado de baja.
  const incluyeActual = opciones.some((profesor) => profesor.id === clase.profesor.id);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64">
        <Campo etiqueta="Profesor que da la clase">
          {(id) => (
            <Selector id={id} value={elegido} onChange={(evento) => setElegido(evento.target.value)}>
              {!incluyeActual && (
                <option value={clase.profesor.id}>
                  {clase.profesor.nombre} {clase.profesor.apellido}
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
        disabled={elegido === String(clase.profesor.id) || actualizar.isPending}
        onClick={() => actualizar.mutate({ profesorId: Number(elegido) })}
      >
        Registrar suplencia
      </Boton>
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
    </div>
  );
}

function Asistentes({ claseId }: { claseId: number }) {
  const asistencias = useAsistencias(claseId);
  const quitar = useQuitarAsistencia(claseId);

  return (
    <div>
      <h2 className="mb-2 text-base font-semibold">Asistentes</h2>
      {asistencias.isPending && <Cargando />}
      {quitar.isError && <Aviso>{mensajeDeError(quitar.error)}</Aviso>}
      {asistencias.data?.length === 0 && <p className="text-apagado">Todavía no hay asistentes.</p>}
      {asistencias.data && asistencias.data.length > 0 && (
        <Tabla columnas={['Alumno', 'Pack', '']}>
          {asistencias.data.map((asistencia) => (
            <tr key={asistencia.id}>
              <Celda>
                {asistencia.alumno.apellido}, {asistencia.alumno.nombre}
              </Celda>
              <Celda>{asistencia.pack}</Celda>
              <CeldaDeAcciones>
                <Boton variante="secundario" disabled={quitar.isPending} onClick={() => quitar.mutate(asistencia.id)}>
                  Quitar
                </Boton>
              </CeldaDeAcciones>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  );
}

function CancelarClase({ claseId }: { claseId: number }) {
  const actualizar = useActualizarClase(claseId);
  return (
    <div className="flex flex-col items-start gap-2">
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      <Boton variante="peligro" disabled={actualizar.isPending} onClick={() => actualizar.mutate({ estado: 'cancelada' })}>
        Cancelar clase
      </Boton>
    </div>
  );
}
