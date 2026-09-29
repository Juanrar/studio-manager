import { useState } from 'react';
import { useParams } from 'react-router';
import { Aviso, Boton, Cargando, Dialogo, Insignia, Pagina } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha } from '../../lib/formato.ts';
import { PagosDelAlumno } from '../pagos/PagosDelAlumno.tsx';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useActualizarAlumno, useAlumno } from './api.ts';

export function FichaAlumnoPage() {
  const id = Number(useParams().id);
  const alumno = useAlumno(id);
  const actualizar = useActualizarAlumno(id);
  const [editando, setEditando] = useState(false);

  if (alumno.isPending) return <Cargando />;
  if (alumno.isError) return <Aviso>{mensajeDeError(alumno.error)}</Aviso>;
  const datos = alumno.data;

  const filas: [string, string | null][] = [
    ['DNI', datos.dni],
    ['Teléfono', datos.telefono],
    ['Email', datos.email],
    ['Fecha de nacimiento', datos.fechaNacimiento === null ? null : formatearFecha(datos.fechaNacimiento)],
    ['Contacto de emergencia', datos.contactoEmergencia],
    ['Notas', datos.notas],
  ];

  return (
    <Pagina
      volverA={{ ruta: '/alumnos', texto: 'Alumnos' }}
      titulo={`${datos.nombre} ${datos.apellido}`}
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
      barra={!datos.activo && <Insignia>Dado de baja</Insignia>}
    >
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}

      <dl className="grid gap-x-6 gap-y-2 rounded-md border border-borde p-4 sm:grid-cols-2">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-apagado">{etiqueta}</dt>
            <dd>{valor ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <PagosDelAlumno alumnoId={id} puedeRegistrar={datos.activo} />

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
    </Pagina>
  );
}
