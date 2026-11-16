import { useId, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MESES_SIN_COMPRAR, type EventoDeAlumno, type FichaDeAlumno, type MedioPago } from '@studio/shared';
import {
  Aviso,
  Avatar,
  Cargando,
  Icono,
  Insignia,
  Pestanas,
  Ventana,
  type NombreIcono,
  type Pestana,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearDiaYMes, formatearFecha, formatearMes, formatearPesos } from '../../lib/formato.ts';
import { PagosDelAlumno, RegistrarPago } from '../pagos/PagosDelAlumno.tsx';
import { DatosDelAlumno } from './DatosDelAlumno.tsx';
import { useActividadDeAlumno, useFichaDeAlumno } from './api.ts';
import { EstadoDelAlumno } from './EstadoDelPack.tsx';
import { ResumenDelAlumno } from './ResumenDelAlumno.tsx';

type IdPestana = 'resumen' | 'actividad' | 'datos' | 'pagos';

const PESTANAS: Pestana<IdPestana>[] = [
  { id: 'resumen', texto: 'Resumen', icono: 'progreso' },
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
      <Ventana etiqueta="Ficha del alumno" alCerrar={cerrar} encabezado={<h2 className="text-lg font-semibold">Alumno</h2>}>
        <div className="p-6">{ficha.isError ? <Aviso>{mensajeDeError(ficha.error)}</Aviso> : <Cargando />}</div>
      </Ventana>
    );
  }
  return <Ficha key={ficha.data.id} datos={ficha.data} alCerrar={cerrar} />;
}

function Ficha({ datos, alCerrar }: { datos: FichaDeAlumno; alCerrar: () => void }) {
  const [pestana, setPestana] = useState<IdPestana>('resumen');
  const nombre = `${datos.nombre} ${datos.apellido}`;

  const encabezado = (
    <div className="flex items-center gap-3.5">
      <Avatar nombre={datos.nombre} grande />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{nombre}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <EstadoDelAlumno activo={datos.activo} estadoPack={datos.estadoPack} />
          {datos.pagoActual !== null && <Insignia tono="violeta">{datos.pagoActual.pack}</Insignia>}
          <span className="text-xs text-apagado">En el estudio desde {formatearFecha(datos.alta)}</span>
        </div>
      </div>
      <RegistrarPago alumnoId={datos.id} />
    </div>
  );

  return (
    <Ventana etiqueta={`Ficha de ${nombre}`} alCerrar={alCerrar} encabezado={encabezado}>
      <Pestanas pestanas={PESTANAS} activa={pestana} alCambiar={setPestana}>
        <div className="relative">
          <div className={pestana === 'resumen' ? '' : 'invisible'} aria-hidden={pestana !== 'resumen'} inert={pestana !== 'resumen'}>
            <ResumenDelAlumno datos={datos} />
          </div>
          {pestana !== 'resumen' && (
            <div role="group" aria-label={PESTANAS.find((p) => p.id === pestana)?.texto} className="absolute inset-0 overflow-auto">
              {pestana === 'actividad' && <Actividad alumnoId={datos.id} />}
              {pestana === 'datos' && <DatosDelAlumno datos={datos} />}
              {pestana === 'pagos' && (
                <div className="p-4">
                  <PagosDelAlumno alumnoId={datos.id} />
                </div>
              )}
            </div>
          )}
        </div>
      </Pestanas>
    </Ventana>
  );
}

const ICONOS_DE_HECHO: Record<EventoDeAlumno['tipo'], NombreIcono> = {
  anotado: 'calendario',
  asistencia: 'tilde',
  pago: 'billetes',
  baja: 'personaMenos',
  reactivacion: 'personaTilde',
  alta: 'personaMas',
};

function Actividad({ alumnoId }: { alumnoId: number }) {
  const actividad = useActividadDeAlumno(alumnoId);

  if (actividad.data === undefined) {
    return (
      <div className="p-6">{actividad.isError ? <Aviso>{mensajeDeError(actividad.error)}</Aviso> : <Cargando />}</div>
    );
  }
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
    case 'baja':
      return hecho.automatica ? (
        <>
          <Resaltado>Baja automática</Resaltado>: {MESES_SIN_COMPRAR} meses sin comprar un pack
        </>
      ) : (
        <>
          <Resaltado>Baja</Resaltado> en el estudio
        </>
      );
    case 'reactivacion':
      return (
        <>
          <Resaltado>Reactivación</Resaltado> en el estudio
        </>
      );
    case 'alta':
      return (
        <>
          <Resaltado>Alta</Resaltado> en el estudio
        </>
      );
  }
}
