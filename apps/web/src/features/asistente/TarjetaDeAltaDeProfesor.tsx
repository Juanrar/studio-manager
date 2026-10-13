import { useState } from 'react';
import { Link } from 'react-router';
import { crearProfesorSchema, type AltaDeProfesorInput } from '@studio/shared';
import { Avatar, Aviso, Boton, Campo, Entrada, claseDeBoton } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearPorcentaje, hoyEnEstudio } from '../../lib/formato.ts';
import { VistaDeSemana } from '../grilla/VistaDeSemana.tsx';
import { useDarDeAltaProfesor } from './api.ts';
import { clasesDeLaPropuesta, fechasDeLaSemana, rangoDeHoras } from './grillaDeLaPropuesta.ts';

const CAMPOS_PERSONALES = [
  { campo: 'dni', etiqueta: 'DNI' },
  { campo: 'telefono', etiqueta: 'Teléfono' },
  { campo: 'email', etiqueta: 'Email' },
  { campo: 'aliasCbu', etiqueta: 'Alias o CBU' },
] as const;

const personalesSchema = crearProfesorSchema.pick({ dni: true, email: true, telefono: true, aliasCbu: true });

type Personales = Record<(typeof CAMPOS_PERSONALES)[number]['campo'], string>;

// Los datos personales se completan acá y van directo a la API del estudio: no pasan por el asistente.
// Que ya se creó lo guarda la conversación, no la mutación: la tarjeta se desmonta al ir a otra pantalla.
export function TarjetaDeAltaDeProfesor({
  propuesta,
  creada,
  alCrearse,
}: {
  propuesta: { tipo: 'altaDeProfesor'; datos: AltaDeProfesorInput };
  creada: { enlace: string } | undefined;
  alCrearse: (enlace: string) => void;
}) {
  const { datos } = propuesta;
  const { nombre, apellido, porcentajeBp } = datos.profesor;
  const darDeAlta = useDarDeAltaProfesor();
  const [personales, setPersonales] = useState<Personales>({ dni: '', telefono: '', email: '', aliasCbu: '' });
  const [errores, setErrores] = useState<Partial<Personales>>({});
  const hoy = hoyEnEstudio();
  const clases = clasesDeLaPropuesta(datos, hoy);

  // La promesa se cumple aunque la tarjeta ya no esté montada; los callbacks de `mutate` no se llaman.
  async function crear() {
    const validacion = personalesSchema.safeParse(personales);
    if (!validacion.success) {
      const campos = validacion.error.flatten().fieldErrors;
      setErrores({
        ...(campos.dni?.[0] === undefined ? {} : { dni: campos.dni[0] }),
        ...(campos.telefono?.[0] === undefined ? {} : { telefono: campos.telefono[0] }),
        ...(campos.email?.[0] === undefined ? {} : { email: campos.email[0] }),
        ...(campos.aliasCbu?.[0] === undefined ? {} : { aliasCbu: campos.aliasCbu[0] }),
      });
      return;
    }
    setErrores({});
    try {
      const profesor = await darDeAlta.mutateAsync({ ...datos, profesor: { ...datos.profesor, ...personales } });
      alCrearse(`/profesores/${profesor.id}`);
    } catch {
      // El motivo se muestra con `darDeAlta.error`.
    }
  }

  return (
    <div
      role="group"
      aria-label="Propuesta del asistente"
      className="flex w-full flex-col gap-3 self-start rounded-lg border border-borde bg-panel px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <Avatar nombre={nombre} />
        <h3 className="font-medium">{`${nombre} ${apellido}`}</h3>
        <p className="text-tenue">{formatearPorcentaje(porcentajeBp)}</p>
      </div>
      <VistaDeSemana fechas={fechasDeLaSemana(hoy)} clases={clases} hoy={hoy} incrustada={rangoDeHoras(clases)} />
      {creada === undefined && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAMPOS_PERSONALES.map(({ campo, etiqueta }) => (
              <Campo key={campo} etiqueta={etiqueta} error={errores[campo]}>
                {(id) => (
                  <Entrada
                    id={id}
                    value={personales[campo]}
                    onChange={(evento) => setPersonales({ ...personales, [campo]: evento.target.value })}
                  />
                )}
              </Campo>
            ))}
          </div>
          <p className="text-tenue">Estos datos no pasan por el asistente.</p>
        </>
      )}
      {darDeAlta.isError && <Aviso>{mensajeDeError(darDeAlta.error)}</Aviso>}
      {creada !== undefined ? (
        <div className="flex items-center gap-3">
          <span className="font-medium text-green-400">Creado</span>
          <Link to={creada.enlace} className={claseDeBoton('secundario')}>
            Ver ficha
          </Link>
        </div>
      ) : (
        <div>
          <Boton onClick={() => void crear()} disabled={darDeAlta.isPending}>
            Crear profesor
          </Boton>
        </div>
      )}
    </div>
  );
}
