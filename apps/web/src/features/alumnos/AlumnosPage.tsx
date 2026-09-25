import { useState } from 'react';
import { Link } from 'react-router';
import {
  Aviso,
  Boton,
  Cargando,
  Celda,
  Dialogo,
  Entrada,
  Insignia,
  Tabla,
  Titulo,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { useDemorado } from '../../lib/useDemorado.ts';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useAlumnos, useCrearAlumno } from './api.ts';

export function AlumnosPage() {
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [creando, setCreando] = useState(false);
  const q = useDemorado(texto.trim());

  const alumnos = useAlumnos({ q, pagina, incluirInactivos });
  const crear = useCrearAlumno();

  const totalPaginas = alumnos.data ? Math.max(1, Math.ceil(alumnos.data.total / alumnos.data.porPagina)) : 1;

  return (
    <section>
      <Titulo acciones={<Boton onClick={() => setCreando(true)}>Nuevo alumno</Boton>}>Alumnos</Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Entrada
          type="search"
          aria-label="Buscar alumno"
          placeholder="Buscar por nombre, apellido o DNI"
          className="max-w-sm"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setPagina(1);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(evento) => {
              setIncluirInactivos(evento.target.checked);
              setPagina(1);
            }}
          />
          Mostrar dados de baja
        </label>
      </div>

      {alumnos.isPending && <Cargando />}
      {alumnos.isError && <Aviso>{mensajeDeError(alumnos.error)}</Aviso>}
      {alumnos.data && (
        <>
          <Tabla columnas={['Alumno', 'DNI', 'Teléfono', 'Estado']}>
            {alumnos.data.items.map((alumno) => (
              <tr key={alumno.id}>
                <Celda>
                  <Link to={`/alumnos/${alumno.id}`} className="font-medium text-violet-800 hover:underline">
                    {alumno.apellido}, {alumno.nombre}
                  </Link>
                </Celda>
                <Celda>{alumno.dni ?? '—'}</Celda>
                <Celda>{alumno.telefono ?? '—'}</Celda>
                <Celda>
                  {alumno.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia>Dado de baja</Insignia>}
                </Celda>
              </tr>
            ))}
          </Tabla>
          {alumnos.data.items.length === 0 && (
            <p className="mt-3 text-sm text-stone-500">No hay alumnos que coincidan con la búsqueda.</p>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
            <span>{alumnos.data.total} alumnos</span>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                Anterior
              </Boton>
              <span>
                Página {pagina} de {totalPaginas}
              </span>
              <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>
                Siguiente
              </Boton>
            </div>
          </div>
        </>
      )}

      <Dialogo titulo="Nuevo alumno" abierto={creando} alCerrar={() => setCreando(false)}>
        <AlumnoForm
          alGuardar={async (datos) => {
            await crear.mutateAsync(datos);
            setCreando(false);
          }}
          alCancelar={() => setCreando(false)}
        />
      </Dialogo>
    </section>
  );
}
