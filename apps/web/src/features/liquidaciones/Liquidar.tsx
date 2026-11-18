import { useState, type ReactNode } from 'react';
import type { ClaseDelMes, FilaDelRanking, Liquidacion } from '@studio/shared';
import { Aviso, Boton, Cargando, Dialogo, Icono, Insignia } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha, formatearPesos, formatearPorcentaje } from '../../lib/formato.ts';
import { useCerrarLiquidacion, useMarcarPagada, useTableroDelProfesor } from './api.ts';
import { cantidadDeAlumnos, descargarCsv, detalleACsv, nombreDelCsv } from './csv.ts';
import type { PropsDeSolapa } from './LiquidacionesPage.tsx';
import { ListaDeProfesores } from './ListaDeProfesores.tsx';
import { calculadoHoy, SIN_DATO, sueldoDe } from './sueldo.ts';

type EstadoDeLiquidacion = 'abierta' | 'cerrada' | 'pagada';

function estadoDeLiquidacion(liquidacion: Liquidacion | null): EstadoDeLiquidacion {
  if (liquidacion === null) return 'abierta';
  return liquidacion.pagadoEn === null ? 'cerrada' : 'pagada';
}

const TEXTO_DE_ESTADO: Record<EstadoDeLiquidacion, string> = {
  abierta: 'Sin cerrar',
  cerrada: 'Por pagar',
  pagada: 'Pagada',
};

const TONO_DE_ESTADO = { abierta: 'ambar', cerrada: 'azul', pagada: 'verde' } as const;

export function Liquidar({ tablero, periodo, profesorId, alElegir }: PropsDeSolapa) {
  const { profesores } = tablero;
  const pendientes = profesores.filter((fila) => estadoDeLiquidacion(fila.liquidacion) !== 'pagada');
  const faltaPagar = pendientes.reduce((suma, fila) => suma + sueldoDe(fila), 0);
  const elegida = profesores.find((fila) => fila.profesor.id === profesorId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-lg font-semibold">{`${profesores.length - pendientes.length} de ${profesores.length} profesores pagados`}</p>
        <p className="text-tenue">{`Falta pagar ${formatearPesos(faltaPagar)}`}</p>
      </div>
      <ListaDeProfesores
        profesores={profesores}
        elegido={profesorId}
        alElegir={alElegir}
        datoDe={(fila) => {
          const estado = estadoDeLiquidacion(fila.liquidacion);
          return <Insignia tono={TONO_DE_ESTADO[estado]}>{TEXTO_DE_ESTADO[estado]}</Insignia>;
        }}
        sinElegido="Elegí un profesor de la lista para ver y liquidar su sueldo."
      >
        {elegida === undefined ? (
          <p className="text-apagado">Ese profesor no tiene liquidación en este mes.</p>
        ) : (
          <LiquidacionDelProfesor key={`${periodo}-${elegida.profesor.id}`} fila={elegida} periodo={periodo} />
        )}
      </ListaDeProfesores>
    </div>
  );
}

function LiquidacionDelProfesor({ fila, periodo }: { fila: FilaDelRanking; periodo: string }) {
  const ficha = useTableroDelProfesor(fila.profesor.id, periodo);
  const cerrar = useCerrarLiquidacion(periodo);
  const pagar = useMarcarPagada(periodo);
  const [confirmando, setConfirmando] = useState(false);
  const { liquidacion } = fila;
  const estado = estadoDeLiquidacion(liquidacion);
  const nombre = `${fila.profesor.nombre} ${fila.profesor.apellido}`;
  const sueldo = sueldoDe(fila);
  const textoCalculadoHoy = calculadoHoy(fila);
  const porcentajeBp = ficha.data?.profesor.porcentajeBp ?? null;

  function confirmarCierre() {
    setConfirmando(false);
    cerrar.mutate(fila.profesor.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{nombre}</h2>
          <Pasos estado={estado} />
        </div>
        <div className="flex flex-wrap gap-2">
          {ficha.data !== undefined && (
            <Boton variante="secundario" onClick={() => descargarCsv(nombreDelCsv(ficha.data), detalleACsv(ficha.data.clases))}>
              Descargar CSV
            </Boton>
          )}
          {estado === 'abierta' && (
            <Boton disabled={cerrar.isPending} onClick={() => setConfirmando(true)}>
              Cerrar liquidación
            </Boton>
          )}
          {estado === 'cerrada' && liquidacion !== null && (
            <Boton disabled={pagar.isPending} onClick={() => pagar.mutate(liquidacion.id)}>
              Marcar como pagada
            </Boton>
          )}
        </div>
      </div>
      {cerrar.isError && <Aviso>{mensajeDeError(cerrar.error)}</Aviso>}
      {pagar.isError && <Aviso>{mensajeDeError(pagar.error)}</Aviso>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato nombre="Sueldo" valor={formatearPesos(sueldo)} grande>
          {textoCalculadoHoy !== null && <p className="text-xs text-amber-300">{textoCalculadoHoy}</p>}
        </Dato>
        <Dato nombre="Clases dictadas" valor={ficha.data === undefined ? SIN_DATO : String(ficha.data.clasesDictadas)} />
        <Dato nombre="Porcentaje" valor={porcentajeBp === null ? SIN_DATO : formatearPorcentaje(porcentajeBp)} />
        <Dato nombre="Alias o CBU" valor={ficha.data?.profesor.aliasCbu ?? SIN_DATO} />
      </div>
      {ficha.isPending && <Cargando />}
      {ficha.isError && <Aviso>{mensajeDeError(ficha.error)}</Aviso>}
      {ficha.data !== undefined && <ClasesResumidas clases={ficha.data.clases} />}
      <Dialogo titulo="Cerrar liquidación" abierto={confirmando} alCerrar={() => setConfirmando(false)}>
        <p className="mb-4">
          {`¿Cerrar la liquidación de ${nombre} por ${formatearPesos(sueldo)}? Después el monto no cambia aunque se carguen asistencias.`}
        </p>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setConfirmando(false)}>
            Cancelar
          </Boton>
          <Boton onClick={confirmarCierre}>Cerrar liquidación</Boton>
        </div>
      </Dialogo>
    </div>
  );
}

const PASOS: readonly EstadoDeLiquidacion[] = ['abierta', 'cerrada', 'pagada'];

const NOMBRE_DEL_PASO: Record<EstadoDeLiquidacion, string> = { abierta: 'Abierta', cerrada: 'Cerrada', pagada: 'Pagada' };

function Pasos({ estado }: { estado: EstadoDeLiquidacion }) {
  const actual = estado === 'pagada' ? PASOS.length : PASOS.indexOf(estado);
  return (
    <ol aria-label="Pasos de la liquidación" className="flex flex-wrap items-center gap-2 text-sm">
      {PASOS.map((paso, indice) => {
        const hecho = indice < actual;
        const esActual = indice === actual;
        const situacion = hecho ? 'hecho' : esActual ? 'actual' : 'pendiente';
        return (
          <li
            key={paso}
            aria-label={`${NOMBRE_DEL_PASO[paso]}: ${situacion}`}
            aria-current={esActual ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            {indice > 0 && <span aria-hidden="true" className={`h-px w-6 ${indice <= actual ? 'bg-acento' : 'bg-borde'}`} />}
            <span
              className={`flex items-center gap-1.5 ${esActual ? 'font-semibold text-texto' : hecho ? 'text-tenue' : 'text-apagado'}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-5 flex-none place-items-center rounded-full text-[11px] leading-none tabular-nums ${hecho ? 'bg-acento text-white' : esActual ? 'ring-2 ring-acento ring-inset' : 'ring-1 ring-borde ring-inset'}`}
              >
                {hecho ? <Icono nombre="tilde" className="size-3" /> : indice + 1}
              </span>
              {NOMBRE_DEL_PASO[paso]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Dato({
  nombre,
  valor,
  grande = false,
  children,
}: {
  nombre: string;
  valor: string;
  grande?: boolean;
  children?: ReactNode;
}) {
  return (
    <div role="group" aria-label={nombre}>
      <p className="text-xs text-apagado">{nombre}</p>
      <p className={grande ? 'text-2xl font-semibold' : 'text-base'}>{valor}</p>
      {children}
    </div>
  );
}

function ClasesResumidas({ clases }: { clases: ClaseDelMes[] }) {
  if (clases.length === 0) return <p className="text-apagado">No dio clases con asistentes este mes.</p>;
  return (
    <div className="flex flex-col gap-2">
      <h3 id="titulo-clases-a-liquidar" className="font-semibold">
        Clases del mes
      </h3>
      <ul aria-labelledby="titulo-clases-a-liquidar" className="overflow-hidden rounded-md border border-borde">
        {clases.map((clase) => (
          <li key={clase.claseId} className="flex items-baseline gap-3 border-b border-borde px-3 py-2 last:border-b-0">
            <span className="w-12 font-medium">{formatearFecha(clase.fecha).slice(0, 5)}</span>
            <span className="min-w-0 flex-1 truncate">{clase.estilo}</span>
            <span className="w-24 text-tenue">{cantidadDeAlumnos(clase.asistentes)}</span>
            <span className="w-24 text-right font-semibold">{formatearPesos(clase.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
