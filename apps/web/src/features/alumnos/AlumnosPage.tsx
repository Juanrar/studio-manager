import { useState } from 'react';
import { Link } from 'react-router';
import {
  Aviso,
  Avatar,
  Boton,
  Cargando,
  Casilla,
  Celda,
  Dialogo,
  Entrada,
  Insignia,
  Pagina,
  Tabla,
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
    <Pagina
      titulo="Alumnos"
      acciones={<Boton onClick={() => setCreando(true)}>Nuevo alumno</Boton>}
      barra={
        <>
          <Entrada
            type="search"
            aria-label="Buscar alumno"
            placeholder="Buscar por nombre, apellido o DNI"
            className="max-w-xs"
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              setPagina(1);
            }}
          />
          <Casilla
            etiqueta="Mostrar dados de baja"
            checked={incluirInactivos}
            onChange={(evento) => {
              setIncluirInactivos(evento.target.checked);
              setPagina(1);
            }}
          />
        </>
      }
    >
      {alumnos.isPending && <Cargando />}
      {alumnos.isError && <Aviso>{mensajeDeError(alumnos.error)}</Aviso>}
      {alumnos.data && (
        <>
          <Tabla columnas={['Alumno', 'DNI', 'Teléfono', 'Estado']}>
            {alumnos.data.items.map((alumno) => (
              <tr key={alumno.id}>
                <Celda>
                  <Link
                    to={`/alumnos/${alumno.id}`}
                    className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium hover:bg-resalte"
                  >
                    <Avatar nombre={alumno.nombre} />
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
            <p className="mt-3 text-apagado">No hay alumnos que coincidan con la búsqueda.</p>
          )}
          <div className="mt-3 flex items-center justify-between text-apagado">
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
    </Pagina>
  );
}
