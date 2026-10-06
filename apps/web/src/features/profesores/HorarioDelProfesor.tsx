import { useId, useState } from 'react';
import type { Clase } from '@studio/shared';
import { Aviso, BotonIcono, Cargando, Casilla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { DIAS_DE_LA_SEMANA, nombreDelDia } from '../../lib/formato.ts';
import { useClases } from '../clases/api.ts';
import { FilaDeLectura, FilaEnEdicion } from './FilaDeClase.tsx';

// La fila que se está editando: una clase que ya existe o una nueva en un día. Hay una sola a la vez.
type Edicion = { tipo: 'existente'; claseId: number } | { tipo: 'nueva'; diaSemana: number } | null;

// La pestaña Clases de la ficha: los siete días de la semana, siempre los siete, con las clases del profesor.
export function HorarioDelProfesor({ profesorId }: { profesorId: number }) {
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const clases = useClases({ profesorId, incluirInactivas });
  const [edicion, setEdicion] = useState<Edicion>(null);

  // Cierra la edición solo si sigue siendo esa: un guardado que tarda no tiene que cerrar la fila que se abrió
  // mientras tanto.
  const terminar = (cual: Edicion) => setEdicion((actual) => (actual === cual ? null : actual));

  return (
    <div className="flex flex-col gap-3 p-4">
      <Casilla
        etiqueta="Mostrar clases dadas de baja"
        checked={incluirInactivas}
        onChange={(evento) => setIncluirInactivas(evento.target.checked)}
      />
      {clases.isPending && <Cargando />}
      {clases.isError && <Aviso>{mensajeDeError(clases.error)}</Aviso>}
      {clases.data && (
        <div className="rounded-md border border-borde">
          {DIAS_DE_LA_SEMANA.map((_, indice) => (
            <DiaDelHorario
              key={indice}
              diaSemana={indice + 1}
              clases={clases.data.filter((clase) => clase.diaSemana === indice + 1)}
              profesorId={profesorId}
              edicion={edicion}
              alEditar={setEdicion}
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
  clases,
  profesorId,
  edicion,
  alEditar,
  alTerminar,
}: {
  diaSemana: number;
  clases: Clase[];
  profesorId: number;
  edicion: Edicion;
  alEditar: (edicion: Edicion) => void;
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
        {clases.length === 0 && !hayNueva ? (
          <p className="flex min-h-11 items-center px-2 text-apagado">Sin clases</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {clases.map((clase) =>
              edicion?.tipo === 'existente' && edicion.claseId === clase.id ? (
                <FilaEnEdicion
                  key={clase.id}
                  clase={clase}
                  diaSemana={diaSemana}
                  profesorId={profesorId}
                  alTerminar={() => alTerminar(edicion)}
                />
              ) : (
                <FilaDeLectura
                  key={clase.id}
                  clase={clase}
                  alEditar={() => alEditar({ tipo: 'existente', claseId: clase.id })}
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
        onClick={() => alEditar({ tipo: 'nueva', diaSemana })}
        className="mt-1.5 border border-borde-fuerte bg-panel"
      />
    </section>
  );
}
