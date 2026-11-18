import { useSearchParams } from 'react-router';
import { hoyEnEstudio, periodoDe, sumarMeses, type TableroDelMes } from '@studio/shared';
import { Aviso, Cargando, Entrada, Pagina, Pestanas, type Pestana } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearPeriodo } from '../../lib/formato.ts';
import { useTablero } from './api.ts';
import { Estadisticas } from './Estadisticas.tsx';
import { Liquidar } from './Liquidar.tsx';
import { ResumenDelMes } from './ResumenDelMes.tsx';

export type PropsDeSolapa = {
  tablero: TableroDelMes;
  periodo: string;
  profesorId: number | null;
  alElegir: (id: number) => void;
};

type IdSolapa = 'resumen' | 'liquidar' | 'estadisticas';

const SOLAPAS: readonly Pestana<IdSolapa>[] = [
  { id: 'resumen', texto: 'Resumen', icono: 'tablero' },
  { id: 'liquidar', texto: 'Liquidar', icono: 'billetera' },
  { id: 'estadisticas', texto: 'Estadísticas', icono: 'barras' },
];

function solapaDe(valor: string | null): IdSolapa {
  return SOLAPAS.find((solapa) => solapa.id === valor)?.id ?? 'resumen';
}

function profesorDe(valor: string | null): number | null {
  const id = Number(valor);
  return valor !== null && Number.isInteger(id) && id > 0 ? id : null;
}

export function LiquidacionesPage() {
  const [parametros, setParametros] = useSearchParams();
  const periodo = parametros.get('periodo') ?? periodoDe(sumarMeses(hoyEnEstudio(), -1));
  const solapa = solapaDe(parametros.get('solapa'));
  const profesorId = profesorDe(parametros.get('profesor'));
  const tablero = useTablero(periodo);
  const esMesEnCurso = periodo === periodoDe(hoyEnEstudio());

  function cambiar(nombre: string, valor: string, reemplazar = false) {
    setParametros(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        siguientes.set(nombre, valor);
        return siguientes;
      },
      { replace: reemplazar },
    );
  }

  function propsDeSolapa(datos: TableroDelMes): PropsDeSolapa {
    return { tablero: datos, periodo, profesorId, alElegir: (id) => cambiar('profesor', String(id), true) };
  }

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
          onChange={(evento) => evento.target.value !== '' && cambiar('periodo', evento.target.value)}
        />
      }
    >
      <div className="-m-4">
        <Pestanas pestanas={SOLAPAS} activa={solapa} alCambiar={(id) => cambiar('solapa', id)}>
          <div className="p-4">
            {tablero.isPending && <Cargando />}
            {tablero.isError && <Aviso>{mensajeDeError(tablero.error)}</Aviso>}
            {tablero.data && solapa === 'resumen' && <ResumenDelMes {...propsDeSolapa(tablero.data)} />}
            {tablero.data && solapa === 'liquidar' && <Liquidar {...propsDeSolapa(tablero.data)} />}
            {tablero.data && solapa === 'estadisticas' && <Estadisticas {...propsDeSolapa(tablero.data)} />}
          </div>
        </Pestanas>
      </div>
    </Pagina>
  );
}
