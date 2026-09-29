import { useId, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { EventoDeAlumno, FichaDeAlumno, MedioPago } from '@studio/shared';
import {
  Aviso,
  Avatar,
  Boton,
  Cargando,
  Dialogo,
  Icono,
  Insignia,
  PanelLateral,
  Pestanas,
  type NombreIcono,
  type Pestana,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearDiaYMes, formatearFecha, formatearMes, formatearPesos } from '../../lib/formato.ts';
import { PagosDelAlumno, RegistrarPago } from '../pagos/PagosDelAlumno.tsx';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useActividadDeAlumno, useActualizarAlumno, useFichaDeAlumno } from './api.ts';
import { ClasesRestantes, EstadoDelAlumno } from './EstadoDelPack.tsx';

type IdPestana = 'actividad' | 'datos' | 'pagos';

const PESTANAS: Pestana<IdPestana>[] = [
  { id: 'actividad', texto: 'Actividad', icono: 'lineaDeTiempo' },
  { id: 'datos', texto: 'Datos', icono: 'lista' },
  { id: 'pagos', texto: 'Pagos', icono: 'billetes' },
];

export function FichaAlumnoPage() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const ficha = useFichaDeAlumno(id);
  const cerrar = () => navegar('/alumnos');

  if (ficha.data === undefined) {
    return (
      <PanelLateral etiqueta="Ficha del alumno" alCerrar={cerrar}>
        <div className="p-6">{ficha.isError ? <Aviso>{mensajeDeError(ficha.error)}</Aviso> : <Cargando />}</div>
      </PanelLateral>
    );
  }
  // La key reinicia el estado (pestaña y diálogos) al pasar de un alumno a otro con el panel abierto.
  return <Ficha key={ficha.data.id} datos={ficha.data} alCerrar={cerrar} />;
}

function Ficha({ datos, alCerrar }: { datos: FichaDeAlumno; alCerrar: () => void }) {
  const [pestana, setPestana] = useState<IdPestana>('actividad');
  const nombre = `${datos.nombre} ${datos.apellido}`;
  // A un alumno dado de baja no se le cobra: la API lo rechaza.
  const acciones = datos.activo && <RegistrarPago alumnoId={datos.id} />;

  return (
    <PanelLateral etiqueta={`Ficha de ${nombre}`} alCerrar={alCerrar} acciones={acciones}>
      <div className="flex items-center gap-3.5 px-6 pt-5 pb-3">
        <Avatar nombre={datos.nombre} grande />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{nombre}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <EstadoDelAlumno activo={datos.activo} estadoPack={datos.estadoPack} />
            {datos.pagoActual !== null && <Insignia tono="violeta">{datos.pagoActual.pack}</Insignia>}
          </div>
        </div>
      </div>

      <Pestanas pestanas={PESTANAS} activa={pestana} alCambiar={setPestana}>
        {pestana === 'actividad' && <Actividad alumnoId={datos.id} />}
        {pestana === 'datos' && <Datos datos={datos} />}
        {pestana === 'pagos' && (
          <div className="p-4">
            <PagosDelAlumno alumnoId={datos.id} />
          </div>
        )}
      </Pestanas>
    </PanelLateral>
  );
}

const ICONOS_DE_HECHO: Record<EventoDeAlumno['tipo'], NombreIcono> = {
  anotado: 'calendario',
  asistencia: 'tilde',
  pago: 'billetes',
  alta: 'personaMas',
};

function Actividad({ alumnoId }: { alumnoId: number }) {
  const actividad = useActividadDeAlumno(alumnoId);

  if (actividad.data === undefined) {
    return (
      <div className="p-6">{actividad.isError ? <Aviso>{mensajeDeError(actividad.error)}</Aviso> : <Cargando />}</div>
    );
  }
  // La API manda los hechos del más nuevo al más viejo, así que los meses quedan en ese orden.
  // Sin Map.groupBy: los navegadores para los que compila Vite no lo tienen.
  const meses = new Map<string, EventoDeAlumno[]>();
  for (const hecho of actividad.data) {
    const mes = hecho.fecha.slice(0, 7);
    meses.set(mes, [...(meses.get(mes) ?? []), hecho]);
  }
  return (
    <div className="px-6 pb-6">
      {[...meses].map(([mes, hechos]) => (
        <MesDeActividad key={mes} mes={mes} hechos={hechos} />
      ))}
    </div>
  );
}

// Los hechos de un mes unidos por una línea, con el ícono de cada tipo y el día a la derecha.
function MesDeActividad({ mes, hechos }: { mes: string; hechos: EventoDeAlumno[] }) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="pt-4 pb-2 font-medium text-apagado">
        {formatearMes(mes)}
      </h3>
      <ol>
        {hechos.map((hecho, indice) => (
          <li key={indice} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-2.5 pb-3.5">
            {indice < hechos.length - 1 && (
              <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-px bg-borde-fuerte" />
            )}
            <span
              aria-hidden="true"
              className="grid size-6 place-items-center rounded-full border border-borde-fuerte bg-elevado text-tenue"
            >
              <Icono nombre={ICONOS_DE_HECHO[hecho.tipo]} className="size-3.5" />
            </span>
            <p className="pt-1 text-tenue">
              <Hecho hecho={hecho} />
            </p>
            <time dateTime={hecho.fecha} className="pt-1 text-xs text-apagado">
              {formatearDiaYMes(hecho.fecha)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Con "otro" no se dice cómo pagó.
const COMO_PAGO: Record<MedioPago, string | null> = {
  efectivo: 'en efectivo',
  transferencia: 'por transferencia',
  mercado_pago: 'con Mercado Pago',
  otro: null,
};

function Resaltado({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-texto">{children}</strong>;
}

function Hecho({ hecho }: { hecho: EventoDeAlumno }) {
  switch (hecho.tipo) {
    case 'anotado':
      return (
        <>
          Anotado en <Resaltado>{hecho.clase}</Resaltado> con {hecho.profesor.nombre} {hecho.profesor.apellido}
        </>
      );
    case 'asistencia':
      return (
        <>
          Asistió a <Resaltado>{hecho.clase}</Resaltado> con {hecho.profesor.nombre} {hecho.profesor.apellido}
        </>
      );
    case 'pago': {
      const como = COMO_PAGO[hecho.medio];
      return (
        <>
          Pagó <Resaltado>{hecho.pack}</Resaltado> · {formatearPesos(hecho.monto)}
          {como !== null && ` ${como}`}
          {hecho.anulado && (
            <>
              {' '}
              <Insignia tono="rojo">Anulado</Insignia>
            </>
          )}
        </>
      );
    }
    case 'alta':
      return (
        <>
          <Resaltado>Alta</Resaltado> en el estudio
        </>
      );
  }
}

function Datos({ datos }: { datos: FichaDeAlumno }) {
  const actualizar = useActualizarAlumno(datos.id);
  const [editando, setEditando] = useState(false);
  const pago = datos.pagoActual;

  const campos: [NombreIcono, string, ReactNode][] = [
    ['documento', 'DNI', datos.dni],
    ['telefono', 'Teléfono', datos.telefono],
    ['correo', 'Email', datos.email],
    ['torta', 'Fecha de nacimiento', datos.fechaNacimiento && formatearFecha(datos.fechaNacimiento)],
    ['botiquin', 'Contacto de emergencia', datos.contactoEmergencia],
    ['notas', 'Notas', datos.notas],
    ['calendarioMas', 'Alta', formatearFecha(datos.alta)],
    ['packs', 'Pack actual', pago?.pack],
    ['pila', 'Clases restantes', pago && <ClasesRestantes pago={pago} />],
    ['calendario', 'Vence', pago && formatearFecha(pago.venceEl)],
  ];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-end gap-2">
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
      </div>

      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}

      <dl>
        {campos.map(([icono, etiqueta, valor]) => (
          <div
            key={etiqueta}
            className="grid min-h-8 grid-cols-[10rem_minmax(0,1fr)] items-center gap-3 rounded px-2 hover:bg-elevado sm:grid-cols-[12rem_minmax(0,1fr)]"
          >
            <dt className="flex items-center gap-1.5 text-apagado">
              <Icono nombre={icono} className="size-3.5" />
              {etiqueta}
            </dt>
            <dd className="py-1.5 break-words">{valor ?? <span className="text-apagado">Vacío</span>}</dd>
          </div>
        ))}
      </dl>

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
    </div>
  );
}
