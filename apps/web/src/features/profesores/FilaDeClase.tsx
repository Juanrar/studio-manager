import { useState, type FormEvent, type ReactNode } from 'react';
import { crearClaseSchema, type Clase } from '@studio/shared';
import { Boton, BotonIcono, Entrada, Insignia, SelectorDeHora } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { useActualizarClase, useCrearClase } from '../clases/api.ts';

// La fila en lectura y en edición comparten el alto y el ancho de cada columna, así nada se corre al entrar a
// editar. El borde está en las dos: en lectura es transparente.
const FILA = 'flex min-h-11 items-center gap-3 rounded-md border px-2 py-1';
const COLUMNA_HORARIO = 'flex w-60 flex-none items-center';
const COLUMNA_ESTILO = 'w-44 flex-none';
const COLUMNA_NIVEL = 'w-36 flex-none';
const ACCIONES = 'ml-auto flex flex-none items-center gap-1.5';

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

// 90 minutos se leen "1 h 30 min", una hora justa "1 h" y menos de una hora "45 min".
function duracion(inicio: string, fin: string): string {
  const minutos = aMinutos(fin) - aMinutos(inicio);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return [horas > 0 ? `${horas} h` : '', resto > 0 ? `${resto} min` : ''].filter((parte) => parte !== '').join(' ');
}

function ErrorDeLaFila({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="px-2 pt-1 text-red-400">
      {children}
    </p>
  );
}

export function FilaDeLectura({ clase, alEditar }: { clase: Clase; alEditar: () => void }) {
  const actualizar = useActualizarClase();
  // Dar de baja no pide confirmación: se deshace con "Reactivar".
  const cambiarEstado = (activa: boolean) => actualizar.mutate({ id: clase.id, datos: { activa } });

  return (
    <li>
      <div className={`group ${FILA} border-transparent hover:bg-elevado`}>
        <span className={`${COLUMNA_HORARIO} gap-2 tabular-nums`}>
          <span>
            {clase.horaInicio} – {clase.horaFin}
          </span>
          <span className="text-apagado">{duracion(clase.horaInicio, clase.horaFin)}</span>
        </span>
        <span className={`${COLUMNA_ESTILO} truncate font-medium`}>{clase.estilo}</span>
        <span className={`${COLUMNA_NIVEL} truncate`}>
          {clase.nivel === null ? <span className="text-apagado">—</span> : <Insignia tono="violeta">{clase.nivel}</Insignia>}
        </span>
        {!clase.activa && <Insignia>Dada de baja</Insignia>}
        {/* Aparecen al pasar el mouse o al llegar con el teclado a uno de los botones. Invisibles igual reciben el
            toque: en una pantalla táctil, sin mouse que las muestre, se ven siempre. */}
        <div
          className={`${ACCIONES} opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100`}
        >
          <BotonIcono icono="lapiz" etiqueta="Editar la clase" onClick={alEditar} />
          {clase.activa ? (
            <BotonIcono icono="tacho" etiqueta="Dar de baja la clase" onClick={() => cambiarEstado(false)} />
          ) : (
            <Boton variante="secundario" onClick={() => cambiarEstado(true)}>
              Reactivar
            </Boton>
          )}
        </div>
      </div>
      {actualizar.isError && <ErrorDeLaFila>{mensajeDeError(actualizar.error)}</ErrorDeLaFila>}
    </li>
  );
}

// Una clase que se edita en su lugar, o una nueva si no hay `clase`. El día y el profesor no se editan acá: salen
// de la fila y de la ficha.
export function FilaEnEdicion({
  clase,
  diaSemana,
  profesorId,
  alTerminar,
}: {
  clase?: Clase | undefined;
  diaSemana: number;
  profesorId: number;
  alTerminar: () => void;
}) {
  const crear = useCrearClase();
  const actualizar = useActualizarClase();
  const [horaInicio, setHoraInicio] = useState(clase?.horaInicio ?? '18:00');
  const [horaFin, setHoraFin] = useState(clase?.horaFin ?? '19:30');
  const [estilo, setEstilo] = useState(clase?.estilo ?? '');
  const [nivel, setNivel] = useState(clase?.nivel ?? '');
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    // Se valida como una clase entera, con el día de la fila y el profesor de la ficha, para que la hora de fin
    // se compare con la de inicio también al editar.
    const validada = crearClaseSchema.safeParse({ estilo, nivel, diaSemana, horaInicio, horaFin, profesorId });
    if (!validada.success) {
      setError(validada.error.issues[0]?.message ?? 'Revisá los datos de la clase');
      return;
    }
    setError(null);
    const datos = validada.data;
    try {
      if (clase === undefined) {
        await crear.mutateAsync(datos);
      } else {
        // Sin el día ni el profesor: un PATCH con ellos podría mudar la clase sin querer.
        await actualizar.mutateAsync({
          id: clase.id,
          datos: { horaInicio: datos.horaInicio, horaFin: datos.horaFin, estilo: datos.estilo, nivel: datos.nivel },
        });
      }
      alTerminar();
    } catch (errorDeApi) {
      setError(mensajeDeError(errorDeApi));
    }
  }

  return (
    <li>
      <form onSubmit={guardar} noValidate className={`${FILA} border-acento/40 bg-elevado`}>
        <span className={`${COLUMNA_HORARIO} gap-1.5`}>
          <SelectorDeHora etiqueta="Empieza" valor={horaInicio} alCambiar={setHoraInicio} />
          <span className="text-apagado">–</span>
          <SelectorDeHora etiqueta="Termina" valor={horaFin} alCambiar={setHoraFin} />
        </span>
        <span className={COLUMNA_ESTILO}>
          <Entrada
            aria-label="Estilo"
            placeholder="Estilo"
            autoFocus
            value={estilo}
            onChange={(evento) => setEstilo(evento.target.value)}
          />
        </span>
        <span className={COLUMNA_NIVEL}>
          <Entrada aria-label="Nivel" placeholder="Nivel" value={nivel} onChange={(evento) => setNivel(evento.target.value)} />
        </span>
        <div className={ACCIONES}>
          <Boton variante="secundario" onClick={alTerminar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={crear.isPending || actualizar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
      {error !== null && <ErrorDeLaFila>{error}</ErrorDeLaFila>}
    </li>
  );
}
