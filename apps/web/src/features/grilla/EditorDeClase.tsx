import { useEffect, useState, type FormEvent } from 'react';
import { diaSemanaIso } from '@studio/shared';
import { Aviso, Boton, BotonIcono, BuscadorDeOpciones, Campo, Entrada, SelectorDeHora, Selector } from '../../components/ui/index.tsx';
import { nombreDelDia } from '../../lib/formato.ts';
import { useProfesores } from '../profesores/api.ts';

export type Borrador = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estilo: string;
  nivel: string;
  profesorId: number;
};

const nombreDeLaFecha = (fecha: string) => `${nombreDelDia(diaSemanaIso(fecha))} ${Number(fecha.slice(8))}`;

export function EditorDeClase({
  titulo,
  inicial,
  fechas,
  nueva,
  alGuardar,
  alQuitar,
  alCerrar,
}: {
  titulo: string;
  inicial: Borrador;
  fechas: string[];
  nueva: boolean;
  alGuardar: (borrador: Borrador) => void;
  alQuitar: () => void;
  alCerrar: () => void;
}) {
  const profesores = useProfesores();
  const [borrador, setBorrador] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (cambios: Partial<Borrador>) => setBorrador((anterior) => ({ ...anterior, ...cambios }));
  // Un profesor dado de baja no aparece en la lista: si es el de la clase, el campo lo muestra como "El profesor de la clase".
  const opciones = profesores.data ?? [];
  // Una clase nueva arranca sin profesor: toma el primero de la lista cuando llega.
  const primero = opciones[0]?.id;
  useEffect(() => {
    if (primero !== undefined) setBorrador((anterior) => (anterior.profesorId === 0 ? { ...anterior, profesorId: primero } : anterior));
  }, [primero]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (borrador.estilo.trim() === '') return setError('El estilo es obligatorio');
    if (borrador.profesorId === 0) return setError('Elegí quién da la clase');
    if (borrador.horaFin <= borrador.horaInicio) return setError('La hora de fin tiene que ser posterior a la de inicio');
    alGuardar({ ...borrador, estilo: borrador.estilo.trim(), nivel: borrador.nivel.trim() });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{titulo}</p>
        <BotonIcono icono="cerrar" etiqueta="Cerrar" onClick={alCerrar} className="-my-1 -mr-1 size-7" />
      </div>
      {error !== null && <Aviso>{error}</Aviso>}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Estilo">
          {(id) => <Entrada id={id} value={borrador.estilo} onChange={(e) => cambiar({ estilo: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Nivel">
          {(id) => <Entrada id={id} value={borrador.nivel} onChange={(e) => cambiar({ nivel: e.target.value })} />}
        </Campo>
        <div className="col-span-2">
          <Campo etiqueta="Profesor">
            {(id) => (
              <BuscadorDeOpciones
                id={id}
                etiqueta="Profesor"
                valor={borrador.profesorId}
                textoDelValor={borrador.profesorId === 0 ? '' : 'El profesor de la clase'}
                opciones={opciones.map((profesor) => ({ valor: profesor.id, texto: `${profesor.nombre} ${profesor.apellido}` }))}
                alElegir={(profesorId) => cambiar({ profesorId })}
              />
            )}
          </Campo>
        </div>
        <div className="col-span-2">
          <Campo etiqueta="Día">
            {(id) => (
              <Selector id={id} value={borrador.fecha} onChange={(e) => cambiar({ fecha: e.target.value })}>
                {fechas.map((fecha) => (
                  <option key={fecha} value={fecha}>
                    {nombreDeLaFecha(fecha)}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
        </div>
        <Campo etiqueta="Empieza">
          {(id) => (
            <SelectorDeHora id={id} etiqueta="Empieza" valor={borrador.horaInicio} alCambiar={(hora) => cambiar({ horaInicio: hora })} />
          )}
        </Campo>
        <Campo etiqueta="Termina">
          {(id) => <SelectorDeHora id={id} etiqueta="Termina" valor={borrador.horaFin} alCambiar={(hora) => cambiar({ horaFin: hora })} />}
        </Campo>
      </div>
      <div className="flex items-center gap-2">
        {!nueva && (
          <button type="button" className="text-xs text-red-300 hover:underline" onClick={alQuitar}>
            Quitar
          </button>
        )}
        <Boton type="submit" className="ml-auto">
          {nueva ? 'Agregar' : 'Guardar'}
        </Boton>
      </div>
    </form>
  );
}
