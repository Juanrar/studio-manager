import { Navigate, useParams, useSearchParams } from 'react-router';
import { hoyEnEstudio, periodoDe, sumarMeses } from '@studio/shared';

export function FichaLiquidacionPage() {
  const { profesorId } = useParams();
  const [parametros] = useSearchParams();
  const periodo = parametros.get('periodo') ?? periodoDe(sumarMeses(hoyEnEstudio(), -1));
  const destino = new URLSearchParams({ periodo, solapa: 'estadisticas', profesor: profesorId ?? '' });
  return <Navigate to={`/liquidaciones?${destino}`} replace />;
}
