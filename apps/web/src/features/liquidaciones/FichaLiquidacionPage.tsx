import { useParams, useSearchParams } from 'react-router';
import { hoyEnEstudio, periodoDe, sumarMeses, type FilaPorHorario, type TableroDelProfesor } from '@studio/shared';
import { Aviso, Barras, Boton, Cargando, Celda, Entrada, Insignia, Pagina, Tabla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import {
  formatearFecha,
  formatearInstante,
  formatearMes,
  formatearPeriodo,
  formatearPesos,
  formatearPorcentaje,
  nombreDelDia,
} from '../../lib/formato.ts';
import { useCerrarLiquidacion, useMarcarPagada, useTableroDelProfesor } from './api.ts';
import { descargarCsv, detalleACsv } from './csv.ts';
import { Panel } from './Panel.tsx';

const SIN_DATO = '—';

const formateadorDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function asistentesPorClase(asistencias: number, clases: number): string {
  return clases === 0 ? SIN_DATO : formateadorDecimal.format(asistencias / clases);
}

function nombreDelHorario(fila: FilaPorHorario): string {
  if (fila.horarioId === null || fila.diaSemana === null || fila.horaInicio === null) return 'Clases únicas';
  return `${fila.estilo} · ${nombreDelDia(fila.diaSemana)} · ${fila.horaInicio.slice(0, 5)}`;
}

function descargarClases(ficha: TableroDelProfesor) {
  const { profesor, periodo } = ficha;
  const nombreArchivo = `sueldo-${profesor.apellido}-${profesor.nombre}-${periodo}.csv`.toLowerCase();
  descargarCsv(nombreArchivo, detalleACsv(ficha.clases));
}

export function FichaLiquidacionPage() {
  const profesorId = Number(useParams().profesorId);
  const [parametros, setParametros] = useSearchParams();
  const periodo = parametros.get('periodo') ?? periodoDe(sumarMeses(hoyEnEstudio(), -1));
  const ficha = useTableroDelProfesor(profesorId, periodo);
  const cerrar = useCerrarLiquidacion(periodo);
  const pagar = useMarcarPagada(periodo);
  const nombre = ficha.data === undefined ? 'Liquidación' : `${ficha.data.profesor.nombre} ${ficha.data.profesor.apellido}`;
  const liquidacion = ficha.data?.liquidacion ?? null;

  return (
    <Pagina
      titulo={`${nombre} · ${formatearPeriodo(periodo)}`}
      volverA={{ ruta: `/liquidaciones?periodo=${periodo}`, texto: 'Liquidaciones' }}
      acciones={
        <>
          {ficha.data !== undefined && liquidacion === null && (
            <Boton disabled={cerrar.isPending} onClick={() => cerrar.mutate(profesorId)}>
              Cerrar
            </Boton>
          )}
          {liquidacion !== null && liquidacion.pagadoEn === null && (
            <Boton disabled={pagar.isPending} onClick={() => pagar.mutate(liquidacion.id)}>
              Marcar pagada
            </Boton>
          )}
          {ficha.data !== undefined && (
            <Boton variante="secundario" onClick={() => descargarClases(ficha.data)}>
              Descargar CSV
            </Boton>
          )}
          <Entrada
            type="month"
            aria-label="Mes"
            className="w-auto"
            value={periodo}
            onChange={(evento) => evento.target.value !== '' && setParametros({ periodo: evento.target.value })}
          />
        </>
      }
      barra={ficha.data !== undefined && <Encabezado ficha={ficha.data} />}
    >
      {ficha.isPending && <Cargando />}
      {ficha.isError && <Aviso>{mensajeDeError(ficha.error)}</Aviso>}
      {cerrar.isError && <Aviso>{mensajeDeError(cerrar.error)}</Aviso>}
      {pagar.isError && <Aviso>{mensajeDeError(pagar.error)}</Aviso>}
      {ficha.data && <Contenido ficha={ficha.data} />}
    </Pagina>
  );
}

function Encabezado({ ficha }: { ficha: TableroDelProfesor }) {
  const { profesor, liquidacion } = ficha;
  const porcentaje = profesor.porcentajeBp === null ? SIN_DATO : formatearPorcentaje(profesor.porcentajeBp);
  return (
    <>
      <span className="text-tenue">{`Porcentaje: ${porcentaje}`}</span>
      <span className="text-tenue">{`Alias o CBU: ${profesor.aliasCbu ?? SIN_DATO}`}</span>
      {liquidacion === null && <Insignia tono="ambar">Abierta</Insignia>}
      {liquidacion !== null && liquidacion.pagadoEn === null && <Insignia>Cerrada</Insignia>}
      {liquidacion?.pagadoEn != null && <Insignia tono="verde">Pagada el {formatearInstante(liquidacion.pagadoEn)}</Insignia>}
    </>
  );
}

function Contenido({ ficha }: { ficha: TableroDelProfesor }) {
  const { liquidacion } = ficha;
  const hayDiferencia = liquidacion !== null && liquidacion.monto !== ficha.montoCalculado;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          nombre="Sueldo"
          valor={formatearPesos(liquidacion?.monto ?? ficha.montoCalculado)}
          detalle={hayDiferencia ? `Calculado hoy: ${formatearPesos(ficha.montoCalculado)}` : undefined}
        />
        <Indicador nombre="Clases dictadas" valor={String(ficha.clasesDictadas)} />
        <Indicador nombre="Clases canceladas" valor={String(ficha.clasesCanceladas)} />
        <Indicador nombre="Asistentes por clase" valor={asistentesPorClase(ficha.asistencias, ficha.clasesDictadas)} />
        <Indicador nombre="Alumnos distintos" valor={String(ficha.alumnosDistintos)} />
        <Indicador nombre="Suplencias dadas" valor={String(ficha.suplenciasDadas)} />
        <Indicador nombre="Suplencias recibidas" valor={String(ficha.suplenciasRecibidas)} />
      </div>
      <Panel id="titulo-sueldo-mensual" titulo="Sueldo de los últimos 6 meses">
        <Barras
          etiqueta="Sueldo por mes"
          textoBarra={formatearPesos}
          datos={ficha.sueldoPorMes.map((mes) => ({ etiqueta: formatearMes(mes.periodo), barra: mes.monto }))}
        />
      </Panel>
      <Panel id="titulo-por-horario" titulo="Por horario">
        <Tabla columnas={['Horario', 'Clases dictadas', 'Asistentes por clase', 'Monto']}>
          {ficha.porHorario.map((fila) => (
            <tr key={fila.horarioId ?? 'unicas'}>
              <Celda>{nombreDelHorario(fila)}</Celda>
              <Celda>{fila.clases}</Celda>
              <Celda>{asistentesPorClase(fila.asistencias, fila.clases)}</Celda>
              <Celda>{formatearPesos(fila.monto)}</Celda>
            </tr>
          ))}
        </Tabla>
      </Panel>
      <Panel id="titulo-clases" titulo="Clases del mes">
        {ficha.clases.length === 0 && <p className="text-apagado">No dio clases con asistentes este mes.</p>}
        {ficha.clases.length > 0 && (
          <Tabla columnas={['Fecha', 'Clase', 'Asistentes', 'Monto']}>
            {ficha.clases.map((clase) => (
              <tr key={clase.claseId}>
                <Celda>{formatearFecha(clase.fecha).slice(0, 5)}</Celda>
                <Celda>{clase.estilo}</Celda>
                <Celda>{clase.asistentes}</Celda>
                <Celda>{formatearPesos(clase.monto)}</Celda>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
    </div>
  );
}

function Indicador({ nombre, valor, detalle }: { nombre: string; valor: string; detalle?: string | undefined }) {
  return (
    <div role="group" aria-label={nombre} className="rounded-md border border-borde p-3">
      <p className="text-apagado">{nombre}</p>
      <p className="text-2xl font-semibold">{valor}</p>
      {detalle !== undefined && <p className="text-xs text-amber-300">{detalle}</p>}
    </div>
  );
}
