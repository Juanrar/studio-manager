import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  hoyEnEstudio,
  periodoDe,
  sumarMeses,
  type FilaDelRanking,
  type Indicadores,
  type ResumenProfesor,
  type TableroDelMes,
} from '@studio/shared';
import {
  Aviso,
  BarraApilada,
  BarrasConLinea,
  Boton,
  Cargando,
  Celda,
  CeldaDeAcciones,
  Dialogo,
  Entrada,
  Insignia,
  Pagina,
  Tabla,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import {
  NOMBRES_MEDIO_DE_PAGO,
  formatearDiaYMes,
  formatearInstante,
  formatearFecha,
  formatearPeriodo,
  formatearPesos,
} from '../../lib/formato.ts';
import { useCerrarLiquidacion, useDetalleDeSueldo, useMarcarPagada, useTablero } from './api.ts';
import { descargarCsv, detalleACsv } from './csv.ts';
import { variacion } from './variacion.ts';

export function LiquidacionesPage() {
  const [parametros, setParametros] = useSearchParams();
  const periodo = parametros.get('periodo') ?? periodoDe(sumarMeses(hoyEnEstudio(), -1));
  const tablero = useTablero(periodo);
  const esMesEnCurso = periodo === periodoDe(hoyEnEstudio());

  return (
    <Pagina
      titulo={
        <>
          Liquidaciones de {formatearPeriodo(periodo)}
          {esMesEnCurso && <span className="ml-2 font-normal text-apagado">mes en curso</span>}
        </>
      }
      acciones={
        <Entrada
          type="month"
          aria-label="Mes"
          className="w-auto"
          value={periodo}
          onChange={(evento) => evento.target.value !== '' && setParametros({ periodo: evento.target.value })}
        />
      }
    >
      {tablero.isPending && <Cargando />}
      {tablero.isError && <Aviso>{mensajeDeError(tablero.error)}</Aviso>}
      {tablero.data && <Resumen tablero={tablero.data} periodo={periodo} />}
    </Pagina>
  );
}

function Resumen({ tablero, periodo }: { tablero: TableroDelMes; periodo: string }) {
  const { alumnosPorEstado } = tablero;
  return (
    <div className="flex flex-col gap-6">
      <PanelDeIndicadores actual={tablero.actual} anterior={tablero.anterior} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel id="titulo-actividad" titulo="Actividad diaria">
          <BarrasConLinea
            etiqueta="Asistencias y cobrado por día"
            unidadBarra="asistencias"
            textoLinea={(valor) => `${formatearPesos(valor)} cobrados`}
            datos={tablero.porDia.map((dia) => ({
              etiqueta: formatearDiaYMes(dia.fecha),
              barra: dia.asistencias,
              linea: dia.cobrado,
            }))}
          />
          <p className="mt-2 text-xs text-apagado">Barras: asistencias por día. Línea: lo cobrado ese día.</p>
        </Panel>
        <Ingresos tablero={tablero} />
      </div>
      <Ranking profesores={tablero.profesores} periodo={periodo} />
      <Panel id="titulo-alumnos" titulo="Estado de los alumnos">
        <BarraApilada
          etiqueta="Alumnos activos por estado del pack"
          segmentos={[
            { etiqueta: 'Al día', valor: alumnosPorEstado.vigente, tono: 'verde' },
            { etiqueta: 'Por vencer', valor: alumnosPorEstado.por_vencer, tono: 'ambar' },
            { etiqueta: 'Sin renovar', valor: alumnosPorEstado.vencido + alumnosPorEstado.sin_clases, tono: 'rojo' },
            { etiqueta: 'Sin pack', valor: alumnosPorEstado.sin_pack, tono: 'neutro' },
          ]}
        />
      </Panel>
    </div>
  );
}

function Panel({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-md border border-borde p-4">
      <h2 id={id} className="mb-3 text-base font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function PanelDeIndicadores({ actual, anterior }: { actual: Indicadores; anterior: Indicadores }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicador
        nombre="Ingresos cobrados"
        valor={formatearPesos(actual.ingresos)}
        actual={actual.ingresos}
        anterior={anterior.ingresos}
      />
      <Indicador
        nombre="Sueldos del mes"
        valor={formatearPesos(actual.sueldos)}
        actual={actual.sueldos}
        anterior={anterior.sueldos}
      />
      <Indicador
        nombre="Le queda al estudio"
        valor={formatearPesos(actual.leQuedaAlEstudio)}
        negativo={actual.leQuedaAlEstudio < 0}
        actual={actual.leQuedaAlEstudio}
        anterior={anterior.leQuedaAlEstudio}
      />
      <Indicador
        nombre="Asistencias"
        valor={String(actual.asistencias)}
        actual={actual.asistencias}
        anterior={anterior.asistencias}
      />
      <Indicador
        nombre="Alumnos activos"
        valor={String(actual.alumnosActivos)}
        actual={actual.alumnosActivos}
        anterior={anterior.alumnosActivos}
      />
      <Indicador
        nombre="Alumnos nuevos"
        valor={String(actual.alumnosNuevos)}
        actual={actual.alumnosNuevos}
        anterior={anterior.alumnosNuevos}
      />
      <Indicador
        nombre="Clases que se perdieron"
        valor={String(actual.clasesPerdidas)}
        detalle={`${formatearPesos(actual.valorPerdido)} sin usar`}
        actual={actual.clasesPerdidas}
        anterior={anterior.clasesPerdidas}
      />
    </div>
  );
}

function Indicador({
  nombre,
  valor,
  detalle,
  negativo = false,
  actual,
  anterior,
}: {
  nombre: string;
  valor: string;
  detalle?: string;
  negativo?: boolean;
  actual: number;
  anterior: number;
}) {
  return (
    <div role="group" aria-label={nombre} className="rounded-md border border-borde p-3">
      <p className="text-apagado">{nombre}</p>
      <p className={`text-2xl font-semibold ${negativo ? 'text-red-400' : ''}`}>{valor}</p>
      {detalle !== undefined && <p className="text-tenue">{detalle}</p>}
      <p className="text-xs text-apagado">
        <span className="font-medium text-tenue">{variacion(actual, anterior)}</span> contra el mes anterior
      </p>
    </div>
  );
}

function Ingresos({ tablero }: { tablero: TableroDelMes }) {
  return (
    <Panel id="titulo-ingresos" titulo="Ingresos del mes">
      <p className="mb-2 text-2xl font-semibold">{formatearPesos(tablero.actual.ingresos)}</p>
      <Tabla columnas={['Medio', 'Pagos', 'Total']}>
        {tablero.ingresosPorMedio.map((fila) => (
          <tr key={fila.medio}>
            <Celda>{NOMBRES_MEDIO_DE_PAGO[fila.medio]}</Celda>
            <Celda>{fila.cantidad}</Celda>
            <Celda>{formatearPesos(fila.total)}</Celda>
          </tr>
        ))}
      </Tabla>
    </Panel>
  );
}

function Ranking({ profesores, periodo }: { profesores: FilaDelRanking[]; periodo: string }) {
  const cerrar = useCerrarLiquidacion(periodo);
  const pagar = useMarcarPagada(periodo);
  const [detalle, setDetalle] = useState<ResumenProfesor | null>(null);
  const ordenados = [...profesores].sort((a, b) => b.asistencias - a.asistencias);

  return (
    <Panel id="titulo-ranking" titulo="Ranking de profesores">
      {cerrar.isError && <Aviso>{mensajeDeError(cerrar.error)}</Aviso>}
      {pagar.isError && <Aviso>{mensajeDeError(pagar.error)}</Aviso>}
      <Tabla columnas={['Profesor', 'Asistencias', 'Contra el mes anterior', 'Sueldo', 'Estado', '']}>
        {ordenados.map((fila) => {
          const { liquidacion } = fila;
          return (
            <tr key={fila.profesor.id}>
              <Celda>
                <Link to={`/liquidaciones/${fila.profesor.id}?periodo=${periodo}`} className="text-acento hover:underline">
                  {fila.profesor.apellido}, {fila.profesor.nombre}
                </Link>
              </Celda>
              <Celda>{fila.asistencias}</Celda>
              <Celda>{variacion(fila.asistencias, fila.asistenciasMesAnterior)}</Celda>
              <Celda>
                {formatearPesos(liquidacion?.monto ?? fila.montoCalculado)}
                {liquidacion !== null && liquidacion.monto !== fila.montoCalculado && (
                  <span className="block text-xs text-amber-300">Calculado hoy: {formatearPesos(fila.montoCalculado)}</span>
                )}
              </Celda>
              <Celda>
                {liquidacion === null && <Insignia tono="ambar">Abierta</Insignia>}
                {liquidacion !== null && liquidacion.pagadoEn === null && <Insignia>Cerrada</Insignia>}
                {liquidacion?.pagadoEn != null && (
                  <Insignia tono="verde">Pagada el {formatearInstante(liquidacion.pagadoEn)}</Insignia>
                )}
              </Celda>
              <CeldaDeAcciones>
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
              </CeldaDeAcciones>
            </tr>
          );
        })}
      </Tabla>

      <Dialogo
        titulo={detalle === null ? '' : `${detalle.profesor.nombre} ${detalle.profesor.apellido} · ${formatearPeriodo(periodo)}`}
        abierto={detalle !== null}
        alCerrar={() => setDetalle(null)}
      >
        {detalle !== null && <DetalleDeSueldo fila={detalle} periodo={periodo} />}
      </Dialogo>
    </Panel>
  );
}

function DetalleDeSueldo({ fila, periodo }: { fila: ResumenProfesor; periodo: string }) {
  const detalle = useDetalleDeSueldo(fila.profesor.id, periodo);
  if (detalle.isPending) return <Cargando />;
  if (detalle.isError) return <Aviso>{mensajeDeError(detalle.error)}</Aviso>;

  const nombreArchivo = `sueldo-${fila.profesor.apellido}-${fila.profesor.nombre}-${periodo}.csv`.toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      {detalle.data.length === 0 && <p className="text-apagado">No dio clases con asistentes este mes.</p>}
      {detalle.data.length > 0 && (
        <Tabla columnas={['Fecha', 'Clase', 'Asistentes', 'Monto']}>
          {detalle.data.map((item) => (
            <tr key={item.claseId}>
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
