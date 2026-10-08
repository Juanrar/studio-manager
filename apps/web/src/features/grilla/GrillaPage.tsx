import { useSearchParams } from 'react-router';
import { Aviso, BotonIcono, Pagina } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearMes, hoyEnEstudio, lunesDe, sumarDias } from '../../lib/formato.ts';
import { useClasesDelRango } from './api.ts';
import { VistaDeSemana } from './VistaDeSemana.tsx';

const NAVEGACION = 'border border-borde-fuerte disabled:pointer-events-none disabled:opacity-40';

// La grilla de clases para el administrador. `fecha` en la dirección elige la semana; sin ella, la de hoy.
export function GrillaPage() {
  const [parametros, setParametros] = useSearchParams();
  const hoy = hoyEnEstudio();
  const lunes = lunesDe(parametros.get('fecha') ?? hoy);
  const fechas = Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice));
  const clases = useClasesDelRango(lunes, fechas[6]!);
  const ir = (fecha: string | undefined) => setParametros(fecha === undefined ? {} : { fecha });
  // Después del horizonte no hay clases creadas: la grilla de esa semana todavía no está armada.
  const ultimaSemana = clases.data !== undefined && sumarDias(lunes, 7) > clases.data.finDelHorizonte;

  return (
    <Pagina
      titulo={<span className="text-lg font-bold">{formatearMes(sumarDias(lunes, 3).slice(0, 7))}</span>}
      acciones={
        <>
          <BotonIcono icono="anterior" etiqueta="Semana anterior" onClick={() => ir(sumarDias(lunes, -7))} className={NAVEGACION} />
          <button
            type="button"
            onClick={() => ir(undefined)}
            className="h-8 rounded-md border border-borde-fuerte px-3 font-medium text-tenue hover:bg-resalte hover:text-texto"
          >
            Hoy
          </button>
          <BotonIcono
            icono="siguiente"
            etiqueta="Semana siguiente"
            disabled={ultimaSemana}
            onClick={() => ir(sumarDias(lunes, 7))}
            className={NAVEGACION}
          />
        </>
      }
    >
      {clases.isError && <Aviso>{mensajeDeError(clases.error)}</Aviso>}
      <VistaDeSemana fechas={fechas} clases={clases.data?.items ?? []} hoy={hoy} />
    </Pagina>
  );
}
