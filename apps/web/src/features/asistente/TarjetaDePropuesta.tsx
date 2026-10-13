import type { PropuestaDelAsistente } from '@studio/shared';
import { Link } from 'react-router';
import { Aviso, Boton, claseDeBoton } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFechaLarga, nombreDelDia } from '../../lib/formato.ts';
import { useCrearClaseUnica, useCrearHorario } from '../grilla/api.ts';

// Cada tarjeta tiene su propia mutación: crear una propuesta no deshabilita las otras. Que ya se creó lo
// guarda la conversación, no la mutación: la tarjeta se desmonta al ir a otra pantalla.
export function TarjetaDePropuesta({
  propuesta,
  creada,
  alCrearse,
}: {
  propuesta: Exclude<PropuestaDelAsistente, { tipo: 'altaDeProfesor' }>;
  creada: { enlace: string } | undefined;
  alCrearse: (enlace: string) => void;
}) {
  const crearClaseUnica = useCrearClaseUnica();
  const crearHorario = useCrearHorario();
  const mutacion = propuesta.tipo === 'claseUnica' ? crearClaseUnica : crearHorario;
  const { datos } = propuesta;
  const enlace = propuesta.tipo === 'claseUnica' ? `/grilla?fecha=${propuesta.datos.fecha}` : '/grilla';

  // La promesa se cumple aunque la tarjeta ya no esté montada; los callbacks de `mutate` no se llaman.
  async function crear() {
    try {
      if (propuesta.tipo === 'claseUnica') await crearClaseUnica.mutateAsync(propuesta.datos);
      else await crearHorario.mutateAsync(propuesta.datos);
    } catch {
      // El motivo se muestra con `mutacion.error`.
      return;
    }
    alCrearse(enlace);
  }

  const cuando =
    propuesta.tipo === 'claseUnica'
      ? formatearFechaLarga(propuesta.datos.fecha)
      : `los ${nombreDelDia(propuesta.datos.diaSemana).toLowerCase()}`;

  return (
    <div
      role="group"
      aria-label="Propuesta del asistente"
      className="flex max-w-[85%] flex-col gap-2 self-start rounded-lg border border-borde bg-panel px-3 py-2"
    >
      <p className="text-tenue">{propuesta.tipo === 'claseUnica' ? 'Clase única' : 'Todas las semanas'}</p>
      <p className="font-medium">{datos.estilo}</p>
      <p>{cuando}</p>
      <p>{`${datos.horaInicio} a ${datos.horaFin}`}</p>
      <p>{`${propuesta.profesor.nombre} ${propuesta.profesor.apellido}`}</p>
      {mutacion.isError && <Aviso>{mensajeDeError(mutacion.error)}</Aviso>}
      {creada !== undefined ? (
        <div className="flex items-center gap-3">
          <span className="font-medium text-green-400">Creada</span>
          <Link to={creada.enlace} className={claseDeBoton('secundario')}>
            Ver en la grilla
          </Link>
        </div>
      ) : (
        <div>
          <Boton onClick={() => void crear()} disabled={mutacion.isPending}>
            Crear
          </Boton>
        </div>
      )}
    </div>
  );
}
