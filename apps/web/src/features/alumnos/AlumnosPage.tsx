import { useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router';
import type { AlumnoEnListado, EstadoPack, PagoActual } from '@studio/shared';
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
  type TonoInsignia,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaCorta } from '../../lib/formato.ts';
import { useDemorado } from '../../lib/useDemorado.ts';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useAlumnos, useCrearAlumno } from './api.ts';

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

// Las reglas de cada estado viven en la API; acá solo se nombran.
const ESTADOS_PACK: Record<EstadoPack, { texto: string; tono: TonoInsignia }> = {
  vigente: { texto: 'Vigente', tono: 'verde' },
  por_vencer: { texto: 'Por vencer', tono: 'ambar' },
  sin_clases: { texto: 'Sin clases', tono: 'rojo' },
  vencido: { texto: 'Vencido', tono: 'rojo' },
  sin_pack: { texto: 'Sin pack', tono: 'azul' },
};

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
  const estado = ESTADOS_PACK[alumno.estadoPack];

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
        {alumno.activo ? <Insignia tono={estado.tono}>{estado.texto}</Insignia> : <Insignia>Dado de baja</Insignia>}
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

// La barra muestra cuánto le queda del pack; en ámbar cuando queda una clase o ninguna.
function ClasesRestantes({ pago }: { pago: PagoActual }) {
  const porcentaje = (pago.clasesRestantes / pago.cantidadClases) * 100;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-resalte">
        <span
          className={`block h-full rounded-full ${pago.clasesRestantes <= 1 ? 'bg-amber-400' : 'bg-acento'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
      {pago.clasesRestantes} de {pago.cantidadClases}
    </span>
  );
}
