import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ResumenProfesor } from '@studio/shared';
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
import {
  NOMBRES_MEDIO_DE_PAGO,
  formatearInstante,
  formatearFecha,
  formatearPeriodo,
  formatearPesos,
  hoyEnEstudio,
  periodoAnterior,
} from '../../lib/formato.ts';
import {
  useCerrarLiquidacion,
  useDetalleDeSueldo,
  useIngresos,
  useMarcarPagada,
  useResumenDeSueldos,
} from './api.ts';
import { descargarCsv, detalleACsv } from './csv.ts';

export function LiquidacionesPage() {
  const [parametros, setParametros] = useSearchParams();
  const periodo = parametros.get('periodo') ?? periodoAnterior(hoyEnEstudio());

  return (
    <section className="flex flex-col gap-6">
      <Titulo
        acciones={
          <Entrada
            type="month"
            aria-label="Mes"
            value={periodo}
            onChange={(evento) => evento.target.value !== '' && setParametros({ periodo: evento.target.value })}
          />
        }
      >
        Liquidaciones de {formatearPeriodo(periodo)}
      </Titulo>
      <Ingresos periodo={periodo} />
      <Sueldos periodo={periodo} />
    </section>
  );
}

function Ingresos({ periodo }: { periodo: string }) {
  const ingresos = useIngresos(periodo);
  return (
    <section aria-labelledby="titulo-ingresos">
      <h2 id="titulo-ingresos" className="mb-2 text-lg font-semibold">
        Ingresos del mes
      </h2>
      {ingresos.isPending && <Cargando />}
      {ingresos.isError && <Aviso>{mensajeDeError(ingresos.error)}</Aviso>}
      {ingresos.data && (
        <>
          <p className="mb-2 text-2xl font-semibold">{formatearPesos(ingresos.data.total)}</p>
          <Tabla columnas={['Medio', 'Pagos', 'Total']}>
            {ingresos.data.porMedio.map((fila) => (
              <tr key={fila.medio}>
                <Celda>{NOMBRES_MEDIO_DE_PAGO[fila.medio]}</Celda>
                <Celda>{fila.cantidad}</Celda>
                <Celda>{formatearPesos(fila.total)}</Celda>
              </tr>
            ))}
          </Tabla>
        </>
      )}
    </section>
  );
}

function Sueldos({ periodo }: { periodo: string }) {
  const resumen = useResumenDeSueldos(periodo);
  const cerrar = useCerrarLiquidacion(periodo);
  const pagar = useMarcarPagada(periodo);
  const [detalle, setDetalle] = useState<ResumenProfesor | null>(null);

  return (
    <section aria-labelledby="titulo-sueldos">
      <h2 id="titulo-sueldos" className="mb-2 text-lg font-semibold">
        Sueldos
      </h2>
      {resumen.isPending && <Cargando />}
      {resumen.isError && <Aviso>{mensajeDeError(resumen.error)}</Aviso>}
      {cerrar.isError && <Aviso>{mensajeDeError(cerrar.error)}</Aviso>}
      {pagar.isError && <Aviso>{mensajeDeError(pagar.error)}</Aviso>}
      {resumen.data && (
        <Tabla columnas={['Profesor', 'Asistencias', 'Monto', 'Estado', '']}>
          {resumen.data.items.map((fila) => {
            const { liquidacion } = fila;
            return (
              <tr key={fila.profesor.id}>
                <Celda>
                  {fila.profesor.apellido}, {fila.profesor.nombre}
                </Celda>
                <Celda>{fila.asistencias}</Celda>
                <Celda>
                  {/* Cerrada, vale el monto guardado; si las asistencias cambiaron después, se avisa. */}
                  {formatearPesos(liquidacion?.monto ?? fila.montoCalculado)}
                  {liquidacion !== null && liquidacion.monto !== fila.montoCalculado && (
                    <span className="block text-xs text-amber-700">
                      Calculado hoy: {formatearPesos(fila.montoCalculado)}
                    </span>
                  )}
                </Celda>
                <Celda>
                  {liquidacion === null && <Insignia tono="ambar">Abierta</Insignia>}
                  {liquidacion !== null && liquidacion.pagadoEn === null && <Insignia>Cerrada</Insignia>}
                  {liquidacion?.pagadoEn != null && (
                    <Insignia tono="verde">Pagada el {formatearInstante(liquidacion.pagadoEn)}</Insignia>
                  )}
                </Celda>
                <Celda className="flex justify-end gap-2">
                  <Boton variante="secundario" onClick={() => setDetalle(fila)}>
                    Detalle
                  </Boton>
                  {liquidacion === null && (
                    <Boton disabled={cerrar.isPending} onClick={() => cerrar.mutate(fila.profesor.id)}>
                      Cerrar
                    </Boton>
                  )}
                  {liquidacion !== null && liquidacion.pagadoEn === null && (
                    <Boton disabled={pagar.isPending} onClick={() => pagar.mutate(liquidacion.id)}>
                      Marcar pagada
                    </Boton>
                  )}
                </Celda>
              </tr>
            );
          })}
        </Tabla>
      )}

      <Dialogo
        titulo={detalle === null ? '' : `${detalle.profesor.nombre} ${detalle.profesor.apellido} · ${formatearPeriodo(periodo)}`}
        abierto={detalle !== null}
        alCerrar={() => setDetalle(null)}
      >
        {detalle !== null && <DetalleDeSueldo fila={detalle} periodo={periodo} />}
      </Dialogo>
    </section>
  );
}

function DetalleDeSueldo({ fila, periodo }: { fila: ResumenProfesor; periodo: string }) {
  const detalle = useDetalleDeSueldo(fila.profesor.id, periodo);
  if (detalle.isPending) return <Cargando />;
  if (detalle.isError) return <Aviso>{mensajeDeError(detalle.error)}</Aviso>;

  const nombreArchivo = `sueldo-${fila.profesor.apellido}-${fila.profesor.nombre}-${periodo}.csv`.toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      {detalle.data.length === 0 && <p className="text-sm text-stone-500">No dio clases con asistentes este mes.</p>}
      {detalle.data.length > 0 && (
        <Tabla columnas={['Fecha', 'Clase', 'Asistentes', 'Monto']}>
          {detalle.data.map((item) => (
            <tr key={item.sesionId}>
              <Celda>{formatearFecha(item.fecha)}</Celda>
              <Celda>{item.estilo}</Celda>
              <Celda>{item.asistentes}</Celda>
              <Celda>{formatearPesos(item.monto)}</Celda>
            </tr>
          ))}
        </Tabla>
      )}
      <div className="flex justify-end">
        <Boton variante="secundario" onClick={() => descargarCsv(nombreArchivo, detalleACsv(detalle.data))}>
          Descargar CSV
        </Boton>
      </div>
    </div>
  );
}
