import { useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router';
import type { AlumnoEnListado } from '@studio/shared';
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
import { formatearFechaCorta } from '../../lib/formato.ts';
import { useDemorado } from '../../lib/useDemorado.ts';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useAlumnos, useCrearAlumno } from './api.ts';
import { ClasesRestantes, EstadoDelAlumno } from './EstadoDelPack.tsx';

const COLUMNAS = [
  { texto: 'Alumno', icono: 'persona' },
  { texto: 'Estado', icono: 'progreso' },
  { texto: 'Pack', icono: 'packs' },
  { texto: 'Clases restantes', icono: 'pila' },
  { texto: 'Vence', icono: 'calendario' },
  { texto: 'Teléfono', icono: 'telefono' },
  { texto: 'DNI', icono: 'documento' },
  { texto: 'Última clase', icono: 'historial' },
] as const;

export function AlumnosPage() {
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [creando, setCreando] = useState(false);
  const q = useDemorado(texto.trim());

  const alumnos = useAlumnos({ q, pagina, incluirInactivos });
  const idAbierto = useMatch('/alumnos/:id')?.params.id;
  const crear = useCrearAlumno();

  const totalPaginas = alumnos.data ? Math.max(1, Math.ceil(alumnos.data.total / alumnos.data.porPagina)) : 1;

  return (
    <>
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
            <Tabla columnas={COLUMNAS}>
              {alumnos.data.items.map((alumno) => (
                <FilaDeAlumno
                  key={alumno.id}
                  alumno={alumno}
                  hoy={alumnos.data.hoy}
                  abierto={String(alumno.id) === idAbierto}
                />
              ))}
            </Tabla>
            {alumnos.data.items.length === 0 && (
              <p className="mt-3 text-apagado">No hay alumnos que coincidan con la búsqueda.</p>
            )}
            <div className="mt-3 flex items-center justify-between text-apagado">
              <span>
                {alumnos.data.total} alumnos · {alumnos.data.vigentes} con el pack vigente
              </span>
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
      <Outlet />
    </>
  );
}

// `hoy` viene de la API: con él se decide si una fecha lleva el año.
function FilaDeAlumno({ alumno, hoy, abierto }: { alumno: AlumnoEnListado; hoy: string; abierto: boolean }) {
  const { pagoActual: pago } = alumno;

  return (
    <tr className={abierto ? 'bg-acento-fondo' : ''}>
      <Celda>
        <Link
          to={`/alumnos/${alumno.id}`}
          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium hover:bg-resalte"
        >
          <Avatar nombre={alumno.nombre} />
          {alumno.apellido}, {alumno.nombre}
        </Link>
      </Celda>
      <Celda>
        <EstadoDelAlumno activo={alumno.activo} estadoPack={alumno.estadoPack} />
      </Celda>
      <Celda>{pago === null ? '—' : <Insignia tono="violeta">{pago.pack}</Insignia>}</Celda>
      <Celda>{pago === null ? '—' : <ClasesRestantes pago={pago} />}</Celda>
      <Celda>{pago === null ? '—' : formatearFechaCorta(pago.venceEl, hoy)}</Celda>
      <Celda>{alumno.telefono ?? '—'}</Celda>
      <Celda>{alumno.dni ?? '—'}</Celda>
      <Celda>{alumno.ultimaClase === null ? '—' : formatearFechaCorta(alumno.ultimaClase, hoy)}</Celda>
    </tr>
  );
}
