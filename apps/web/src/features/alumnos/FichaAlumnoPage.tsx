import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Aviso, Boton, Cargando, Dialogo, Insignia, Titulo } from '../../components/ui/index.tsx';
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
    <section>
      <Link to="/alumnos" className="text-sm text-violet-800 hover:underline">
        ← Alumnos
      </Link>
      <Titulo
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
        {datos.nombre} {datos.apellido} {!datos.activo && <Insignia>Dado de baja</Insignia>}
      </Titulo>

      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}

      <dl className="grid gap-x-6 gap-y-2 rounded-md border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-stone-500">{etiqueta}</dt>
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
    </section>
  );
}
