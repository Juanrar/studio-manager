import { useId, useState } from 'react';
import type { Horario } from '@studio/shared';
import { Aviso, BotonIcono, Cargando, Casilla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { DIAS_DE_LA_SEMANA, nombreDelDia } from '../../lib/formato.ts';
import { useHorarios } from '../horarios/api.ts';
import { FilaDeLectura, FilaEnEdicion } from './FilaDeHorario.tsx';

// La fila que se está editando: una clase que ya existe o una nueva en un día. Hay una sola a la vez.
type Edicion = { tipo: 'existente'; horarioId: number } | { tipo: 'nueva'; diaSemana: number } | null;

// La pestaña Clases de la ficha: los siete días de la semana, siempre los siete, con las clases del profesor.
export function HorarioDelProfesor({ profesorId }: { profesorId: number }) {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const horarios = useHorarios({ profesorId, incluirInactivos });
  const [edicion, setEdicion] = useState<Edicion>(null);

  // Cierra la edición solo si sigue siendo esa: un guardado que tarda no tiene que cerrar la fila que se abrió
  // mientras tanto.
  const terminar = (cual: Edicion) => setEdicion((actual) => (actual === cual ? null : actual));

  // El "+" de un día que ya tiene una fila nueva abierta la conserva, con lo escrito. Tiene que ser el mismo
  // objeto: si cambiara, un guardado en curso no cerraría la fila y un segundo "Guardar" crearía la clase dos veces.
  const agregar = (diaSemana: number) =>
    setEdicion((actual) =>
      actual?.tipo === 'nueva' && actual.diaSemana === diaSemana ? actual : { tipo: 'nueva', diaSemana },
    );

  return (
    <div className="flex flex-col gap-3 p-4">
      <Casilla
        etiqueta="Mostrar clases dadas de baja"
        checked={incluirInactivos}
        onChange={(evento) => setIncluirInactivos(evento.target.checked)}
      />
      {horarios.isPending && <Cargando />}
      {horarios.isError && <Aviso>{mensajeDeError(horarios.error)}</Aviso>}
      {horarios.data && (
        <div className="rounded-md border border-borde">
          {DIAS_DE_LA_SEMANA.map((_, indice) => (
            <DiaDelHorario
              key={indice}
              diaSemana={indice + 1}
              horarios={horarios.data.filter((horario) => horario.diaSemana === indice + 1)}
              profesorId={profesorId}
              edicion={edicion}
              alEditar={setEdicion}
              alAgregar={agregar}
              alTerminar={terminar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiaDelHorario({
  diaSemana,
  horarios,
  profesorId,
  edicion,
  alEditar,
  alAgregar,
  alTerminar,
}: {
  diaSemana: number;
  horarios: Horario[];
  profesorId: number;
  edicion: Edicion;
  alEditar: (edicion: Edicion) => void;
  alAgregar: (diaSemana: number) => void;
  alTerminar: (edicion: Edicion) => void;
}) {
  const idTitulo = useId();
  const nombre = nombreDelDia(diaSemana);
  const hayNueva = edicion?.tipo === 'nueva' && edicion.diaSemana === diaSemana;

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex items-start gap-4 border-b border-borde px-4 py-3 last:border-b-0"
    >
      {/* El padding centra el nombre y el "+" con la primera fila, que mide 44px. */}
      <h3 id={idTitulo} className="w-28 flex-none pt-3 font-medium">
        {nombre}
      </h3>
      <div className="min-w-0 flex-1">
        {horarios.length === 0 && !hayNueva ? (
          <p className="flex min-h-11 items-center px-2 text-apagado">Sin clases</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {horarios.map((horario) =>
              edicion?.tipo === 'existente' && edicion.horarioId === horario.id ? (
                <FilaEnEdicion
                  key={horario.id}
                  horario={horario}
                  diaSemana={diaSemana}
                  profesorId={profesorId}
                  alTerminar={() => alTerminar(edicion)}
                />
              ) : (
                <FilaDeLectura
                  key={horario.id}
                  horario={horario}
                  alEditar={() => alEditar({ tipo: 'existente', horarioId: horario.id })}
                />
              ),
            )}
            {hayNueva && (
              <FilaEnEdicion
                key="nueva"
                diaSemana={diaSemana}
                profesorId={profesorId}
                alTerminar={() => alTerminar(edicion)}
              />
            )}
          </ul>
        )}
      </div>
      <BotonIcono
        icono="mas"
        etiqueta={`Agregar una clase el ${nombre.toLowerCase()}`}
        onClick={() => alAgregar(diaSemana)}
        className="mt-1.5 border border-borde-fuerte bg-panel"
      />
    </section>
  );
}
