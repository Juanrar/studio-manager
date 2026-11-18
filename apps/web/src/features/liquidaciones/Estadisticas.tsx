import { Fragment, useState } from 'react';
import type { AlumnoDeLaClase, FilaDelRanking, FilaPorHorario, TableroDelProfesor } from '@studio/shared';
import { Aviso, Barras, Boton, Cargando, Celda, CeldaDeAcciones, Tabla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha, formatearMes, formatearPesos, formatearPorcentaje, nombreDelDia } from '../../lib/formato.ts';
import { useTableroDelProfesor } from './api.ts';
import { descargarCsv, detalleACsv, nombreDelCsv } from './csv.ts';
import type { PropsDeSolapa } from './LiquidacionesPage.tsx';
import { ListaDeProfesores } from './ListaDeProfesores.tsx';
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

function cantidadDeAsistencias(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'asistencia' : 'asistencias'}`;
}

export function Estadisticas({ tablero, periodo, profesorId, alElegir }: PropsDeSolapa) {
  const elegida = tablero.profesores.find((fila) => fila.profesor.id === profesorId);

  return (
    <ListaDeProfesores
      profesores={tablero.profesores}
      elegido={profesorId}
      alElegir={alElegir}
      datoDe={(fila) => <span className="text-xs text-tenue">{cantidadDeAsistencias(fila.asistencias)}</span>}
      sinElegido="Elegí un profesor de la lista para ver sus estadísticas del mes."
    >
      {elegida === undefined ? (
        <p className="text-apagado">Ese profesor no tiene liquidación en este mes.</p>
      ) : (
        <EstadisticasDelProfesor key={elegida.profesor.id} fila={elegida} periodo={periodo} />
      )}
    </ListaDeProfesores>
  );
}

function EstadisticasDelProfesor({ fila, periodo }: { fila: FilaDelRanking; periodo: string }) {
  const ficha = useTableroDelProfesor(fila.profesor.id, periodo);
  const nombre = `${fila.profesor.nombre} ${fila.profesor.apellido}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{nombre}</h2>
          {ficha.data !== undefined && <DatosDeCobro ficha={ficha.data} />}
        </div>
        {ficha.data !== undefined && (
          <Boton variante="secundario" onClick={() => descargarCsv(nombreDelCsv(ficha.data), detalleACsv(ficha.data.clases))}>
            Descargar CSV
          </Boton>
        )}
      </div>
      {ficha.isPending && <Cargando />}
      {ficha.isError && <Aviso>{mensajeDeError(ficha.error)}</Aviso>}
      {ficha.data !== undefined && <Contenido ficha={ficha.data} />}
    </div>
  );
}

function DatosDeCobro({ ficha }: { ficha: TableroDelProfesor }) {
  const { profesor } = ficha;
  const porcentaje = profesor.porcentajeBp === null ? SIN_DATO : formatearPorcentaje(profesor.porcentajeBp);
  return <p className="text-tenue">{`Porcentaje: ${porcentaje} · Alias o CBU: ${profesor.aliasCbu ?? SIN_DATO}`}</p>;
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
        {ficha.clases.length > 0 && <ClasesConDetalle clases={ficha.clases} />}
      </Panel>
    </div>
  );
}

function ClasesConDetalle({ clases }: { clases: TableroDelProfesor['clases'] }) {
  const [abiertas, setAbiertas] = useState<ReadonlySet<number>>(new Set());

  function alternar(claseId: number) {
    setAbiertas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(claseId)) siguientes.delete(claseId);
      else siguientes.add(claseId);
      return siguientes;
    });
  }

  return (
    <Tabla columnas={['Fecha', 'Clase', 'Asistentes', 'Monto', '']}>
      {clases.map((clase) => {
        const abierta = abiertas.has(clase.claseId);
        return (
          <Fragment key={clase.claseId}>
            <tr>
              <Celda>{formatearFecha(clase.fecha).slice(0, 5)}</Celda>
              <Celda>{clase.estilo}</Celda>
              <Celda>{clase.asistentes}</Celda>
              <Celda>{formatearPesos(clase.monto)}</Celda>
              <CeldaDeAcciones>
                <Boton variante="secundario" aria-expanded={abierta} onClick={() => alternar(clase.claseId)}>
                  {abierta ? 'Ocultar' : 'Detalle'}
                </Boton>
              </CeldaDeAcciones>
            </tr>
            {abierta && (
              <tr>
                <td colSpan={5} className="border-b border-borde bg-elevado px-6 py-3">
                  <TablaDeAlumnos alumnos={clase.alumnos} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </Tabla>
  );
}

function TablaDeAlumnos({ alumnos }: { alumnos: AlumnoDeLaClase[] }) {
  return (
    <Tabla columnas={['Alumno', 'Pack', 'Valor de la clase', 'Parte del profesor']}>
      {alumnos.map((alumno) => (
        <tr key={alumno.alumnoId}>
          <Celda>{`${alumno.nombre} ${alumno.apellido}`}</Celda>
          <Celda>{alumno.pack}</Celda>
          <Celda>{formatearPesos(alumno.valorClase)}</Celda>
          <Celda>{formatearPesos(alumno.parte)}</Celda>
        </tr>
      ))}
    </Tabla>
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
