import type { ReactNode } from 'react';
import type { FichaDeAlumno, ResumenDeAlumno } from '@studio/shared';
import { Aviso, Avatar, Cargando, Icono, Insignia, type NombreIcono } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha, formatearPesos, haceCuanto, nombreDelDia } from '../../lib/formato.ts';
import { useResumenDeAlumno } from './api.ts';
import { ClasesRestantes } from './EstadoDelPack.tsx';
import { MesAMes } from './MesAMes.tsx';

const SIN_DATO = '—';

// La fila de arriba de la pestaña Resumen: contacto y pack, indicadores de actividad y profesores.
export function ResumenDelAlumno({ datos }: { datos: FichaDeAlumno }) {
  const resumen = useResumenDeAlumno(datos.id);

  if (resumen.data === undefined) {
    return <div className="p-6">{resumen.isError ? <Aviso>{mensajeDeError(resumen.error)}</Aviso> : <Cargando />}</div>;
  }
  return (
    <div className="p-6">
      <div className="grid grid-cols-[13rem_minmax(0,1fr)_19rem] gap-8">
        <section>
          <Titulo>Contacto</Titulo>
          <Contacto datos={datos} />
          <div className="mt-4 mb-2 font-medium text-apagado">Pack actual</div>
          {datos.pagoActual === null ? (
            <p className="text-apagado">Sin pack.</p>
          ) : (
            <div className="flex flex-col items-start gap-1.5">
              <ClasesRestantes pago={datos.pagoActual} />
              <span className="text-tenue">Vence el {formatearFecha(datos.pagoActual.venceEl)}</span>
            </div>
          )}
        </section>
        <section>
          <Titulo>Actividad</Titulo>
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Indicadores resumen={resumen.data} />
          </div>
        </section>
        <section>
          <Titulo>Toma clases con</Titulo>
          <Profesores profesores={resumen.data.profesores} />
        </section>
      </div>
      <MesAMes meses={resumen.data.meses} />
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return <h3 className="mb-2.5 text-[15px] font-semibold">{children}</h3>;
}

function Contacto({ datos }: { datos: FichaDeAlumno }) {
  const filas: [NombreIcono, ReactNode][] = [
    ['telefono', datos.telefono],
    ['correo', datos.email],
    ['calendarioMas', `Alta ${formatearFecha(datos.alta)}`],
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {filas.map(([icono, valor]) => (
        <li key={icono} className="flex items-center gap-2 text-tenue">
          <Icono nombre={icono} className="size-3.5 flex-none text-apagado" />
          <span className="truncate">{valor ?? <span className="text-apagado">Vacío</span>}</span>
        </li>
      ))}
    </ul>
  );
}

function Indicador({ etiqueta, valor, nota }: { etiqueta: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-apagado">{etiqueta}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{valor}</div>
      {nota !== undefined && <div className="text-xs text-apagado">{nota}</div>}
    </div>
  );
}

// "Martes 19:00" o "Martes y jueves 19:00".
function textoSueleVenir({ diasSemana, horaInicio }: NonNullable<ResumenDeAlumno['sueleVenir']>): string {
  const dias = diasSemana.map((dia, indice) => (indice === 0 ? nombreDelDia(dia) : nombreDelDia(dia).toLowerCase()));
  return `${dias.join(' y ')} ${horaInicio}`;
}

function Indicadores({ resumen }: { resumen: ResumenDeAlumno }) {
  const porSemana = (resumen.clasesEnOchoSemanas / 8).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  return (
    <>
      <Indicador etiqueta="Clases tomadas" valor={resumen.clasesTomadas} nota="desde el alta" />
      <Indicador etiqueta="Por semana" valor={porSemana} nota="últimas 8 semanas" />
      <Indicador
        etiqueta="Última clase"
        valor={resumen.ultimaClase === null ? SIN_DATO : haceCuanto(resumen.ultimaClase, resumen.hoy)}
      />
      <Indicador
        etiqueta="Estilo que más toma"
        valor={resumen.estiloMasTomado === null ? SIN_DATO : <Insignia tono="verde">{resumen.estiloMasTomado}</Insignia>}
      />
      <Indicador
        etiqueta="Suele venir"
        valor={resumen.sueleVenir === null ? SIN_DATO : textoSueleVenir(resumen.sueleVenir)}
      />
      <Indicador etiqueta="Vencidas sin usar" valor={resumen.vencidasSinUsar} nota="últimos 12 meses" />
      {resumen.totalPagado !== null && <Indicador etiqueta="Total pagado" valor={formatearPesos(resumen.totalPagado)} />}
    </>
  );
}

function Profesores({ profesores }: { profesores: ResumenDeAlumno['profesores'] }) {
  if (profesores.length === 0) return <p className="text-apagado">Todavía no tomó clases</p>;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {profesores.map((profesor) => (
        <li key={profesor.id} className="flex min-w-0 items-center gap-2.5">
          <span className="[&>span]:size-8 [&>span]:text-sm">
            <Avatar nombre={profesor.nombre} grande />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {profesor.nombre} {profesor.apellido}
            </span>
            <span className="block truncate text-xs text-apagado">
              {profesor.estilo} · {profesor.clases} {profesor.clases === 1 ? 'clase' : 'clases'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
