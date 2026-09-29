import type { EstadoPack, PagoActual } from '@studio/shared';
import { Insignia, type TonoInsignia } from '../../components/ui/index.tsx';

// Las reglas de cada estado viven en la API; acá solo se nombran.
const ESTADOS_PACK: Record<EstadoPack, { texto: string; tono: TonoInsignia }> = {
  vigente: { texto: 'Vigente', tono: 'verde' },
  por_vencer: { texto: 'Por vencer', tono: 'ambar' },
  sin_clases: { texto: 'Sin clases', tono: 'rojo' },
  vencido: { texto: 'Vencido', tono: 'rojo' },
  sin_pack: { texto: 'Sin pack', tono: 'azul' },
};

// A un alumno dado de baja no se le muestra el estado del pack: parecería que sigue viniendo.
export function EstadoDelAlumno({ activo, estadoPack }: { activo: boolean; estadoPack: EstadoPack }) {
  if (!activo) return <Insignia>Dado de baja</Insignia>;
  const estado = ESTADOS_PACK[estadoPack];
  return <Insignia tono={estado.tono}>{estado.texto}</Insignia>;
}

// La barra muestra cuánto le queda del pack; en ámbar cuando queda una clase o ninguna.
export function ClasesRestantes({ pago }: { pago: PagoActual }) {
  const porcentaje = (pago.clasesRestantes / pago.cantidadClases) * 100;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-resalte">
        <span
          className={`block h-full rounded-full ${pago.clasesRestantes <= 1 ? 'bg-amber-400' : 'bg-acento'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
      {pago.clasesRestantes} de {pago.cantidadClases}
    </span>
  );
}
