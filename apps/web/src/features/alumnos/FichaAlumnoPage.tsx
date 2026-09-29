import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Alumno } from '@studio/shared';
import { Aviso, Avatar, Boton, Cargando, Dialogo, Insignia, PanelLateral } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha } from '../../lib/formato.ts';
import { PagosDelAlumno } from '../pagos/PagosDelAlumno.tsx';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useActualizarAlumno, useAlumno } from './api.ts';

export function FichaAlumnoPage() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const alumno = useAlumno(id);
  const cerrar = () => navegar('/alumnos');

  if (alumno.data === undefined) {
    return (
      <PanelLateral etiqueta="Ficha del alumno" alCerrar={cerrar}>
        <div className="p-6">{alumno.isError ? <Aviso>{mensajeDeError(alumno.error)}</Aviso> : <Cargando />}</div>
      </PanelLateral>
    );
  }
  // La key reinicia el estado (el diálogo de edición) al pasar de un alumno a otro con el panel abierto.
  return <Ficha key={alumno.data.id} datos={alumno.data} alCerrar={cerrar} />;
}

function Ficha({ datos, alCerrar }: { datos: Alumno; alCerrar: () => void }) {
  const actualizar = useActualizarAlumno(datos.id);
  const [editando, setEditando] = useState(false);
  const nombre = `${datos.nombre} ${datos.apellido}`;

  const filas: [string, string | null][] = [
    ['DNI', datos.dni],
    ['Teléfono', datos.telefono],
    ['Email', datos.email],
    ['Fecha de nacimiento', datos.fechaNacimiento === null ? null : formatearFecha(datos.fechaNacimiento)],
    ['Contacto de emergencia', datos.contactoEmergencia],
    ['Notas', datos.notas],
  ];

  return (
    <PanelLateral
      etiqueta={`Ficha de ${nombre}`}
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Boton>
          <Boton
            variante={datos.activo ? 'peligro' : 'secundario'}
            disabled={actualizar.isPending}
            onClick={() => actualizar.mutate({ activo: !datos.activo })}
          >
            {datos.activo ? 'Dar de baja' : 'Reactivar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Avatar nombre={datos.nombre} grande />
          <h2 className="text-lg font-semibold">{nombre}</h2>
          {!datos.activo && <Insignia>Dado de baja</Insignia>}
        </div>

        {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}

        <dl className="flex flex-col gap-1">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <dt className="text-apagado">{etiqueta}</dt>
              <dd className="break-words">{valor ?? <span className="text-apagado">—</span>}</dd>
            </div>
          ))}
        </dl>

        <PagosDelAlumno alumnoId={datos.id} puedeRegistrar={datos.activo} />
      </div>

      <Dialogo titulo="Editar alumno" abierto={editando} alCerrar={() => setEditando(false)}>
        <AlumnoForm
          inicial={datos}
          alGuardar={async (cambios) => {
            await actualizar.mutateAsync(cambios);
            setEditando(false);
          }}
          alCancelar={() => setEditando(false)}
        />
      </Dialogo>
    </PanelLateral>
  );
}
