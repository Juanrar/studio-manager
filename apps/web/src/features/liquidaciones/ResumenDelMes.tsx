import type { FilaDelRanking, Indicadores, TableroDelMes } from '@studio/shared';
import { BarrasConLinea, Celda, Tabla } from '../../components/ui/index.tsx';
import { NOMBRES_MEDIO_DE_PAGO, formatearDiaYMes, formatearPesos } from '../../lib/formato.ts';
import type { PropsDeSolapa } from './LiquidacionesPage.tsx';
import { Panel } from './Panel.tsx';
import { variacion } from './variacion.ts';

export function ResumenDelMes({ tablero }: PropsDeSolapa) {
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
      <Ranking profesores={tablero.profesores} />
      <EstadoDeAlumnos alumnosPorEstado={tablero.alumnosPorEstado} />
    </div>
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

function Ranking({ profesores }: { profesores: FilaDelRanking[] }) {
  return (
    <Panel id="titulo-ranking" titulo="Ranking de profesores">
      <Tabla columnas={['Profesor', 'Asistencias', 'Contra el mes anterior', 'Sueldo']}>
        {profesores.map((fila) => {
          const { liquidacion } = fila;
          return (
            <tr key={fila.profesor.id}>
              <Celda>
                {fila.profesor.apellido}, {fila.profesor.nombre}
              </Celda>
              <Celda>{fila.asistencias}</Celda>
              <Celda>{variacion(fila.asistencias, fila.asistenciasMesAnterior)}</Celda>
              <Celda>
                {formatearPesos(liquidacion?.monto ?? fila.montoCalculado)}
                {liquidacion !== null && liquidacion.monto !== fila.montoCalculado && (
                  <span className="block text-xs text-amber-300">Calculado hoy: {formatearPesos(fila.montoCalculado)}</span>
                )}
              </Celda>
            </tr>
          );
        })}
      </Tabla>
    </Panel>
  );
}

const PUNTOS_DE_ESTADO = {
  verde: 'bg-green-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
  neutro: 'bg-apagado',
} as const;

function EstadoDeAlumnos({ alumnosPorEstado }: { alumnosPorEstado: TableroDelMes['alumnosPorEstado'] }) {
  const total =
    alumnosPorEstado.vigente +
    alumnosPorEstado.por_vencer +
    alumnosPorEstado.vencido +
    alumnosPorEstado.sin_clases +
    alumnosPorEstado.sin_pack;
  const recuadros: { texto: string; valor: number; tono: keyof typeof PUNTOS_DE_ESTADO }[] = [
    { texto: 'Al día', valor: alumnosPorEstado.vigente, tono: 'verde' },
    { texto: 'Por vencer', valor: alumnosPorEstado.por_vencer, tono: 'ambar' },
    { texto: 'Sin renovar', valor: alumnosPorEstado.vencido + alumnosPorEstado.sin_clases, tono: 'rojo' },
    { texto: 'Sin pack', valor: alumnosPorEstado.sin_pack, tono: 'neutro' },
  ];
  return (
    <Panel id="titulo-alumnos" titulo={`Alumnos activos hoy: ${total}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {recuadros.map((recuadro) => (
          <div key={recuadro.texto} role="group" aria-label={recuadro.texto} className="rounded-md border border-borde p-3">
            <p className="flex items-center gap-1.5 text-tenue">
              <span aria-hidden="true" className={`size-2 rounded-full ${PUNTOS_DE_ESTADO[recuadro.tono]}`} />
              {recuadro.texto}
            </p>
            <p className="text-2xl font-semibold">{recuadro.valor}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
