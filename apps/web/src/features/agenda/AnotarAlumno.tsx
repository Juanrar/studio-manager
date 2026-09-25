import { useState } from 'react';
import { MEDIOS_PAGO, SIN_CLASES_DISPONIBLES, type Alumno, type MedioPago } from '@studio/shared';
import { Aviso, Boton, Campo, Entrada, Selector } from '../../components/ui/index.tsx';
import { ErrorDeApi, mensajeDeError } from '../../lib/api.ts';
import { NOMBRES_MEDIO_DE_PAGO, formatearPesos } from '../../lib/formato.ts';
import { useDemorado } from '../../lib/useDemorado.ts';
import { useAlumnos } from '../alumnos/api.ts';
import { usePacks } from '../packs/api.ts';
import { useRegistrarAsistencia } from './api.ts';

const MAXIMO_DE_SUGERENCIAS = 5;

export function AnotarAlumno({ sesionId }: { sesionId: number }) {
  const [texto, setTexto] = useState('');
  const q = useDemorado(texto.trim());
  const buscando = q.length >= 2;
  const sugerencias = useAlumnos({ q, pagina: 1, incluirInactivos: false }, { habilitado: buscando });
  const registrar = useRegistrarAsistencia(sesionId);
  const [sinClases, setSinClases] = useState<{ alumno: Alumno; mensaje: string } | null>(null);

  const anotar = (alumno: Alumno) => {
    setSinClases(null);
    registrar.mutate(
      { alumnoId: alumno.id },
      {
        onSuccess: () => setTexto(''),
        onError: (error) => {
          // Sin clases disponibles no es un error para recepción: ofrece cobrar en el acto.
          if (error instanceof ErrorDeApi && error.codigo === SIN_CLASES_DISPONIBLES) {
            setSinClases({ alumno, mensaje: error.message });
          }
        },
      },
    );
  };

  const errorComun = registrar.isError && sinClases === null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-stone-200 bg-white p-4">
      <Entrada
        type="search"
        aria-label="Buscar alumno para anotar"
        placeholder="Buscar alumno para anotar"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      {buscando && sugerencias.data && (
        <ul className="flex flex-col gap-1">
          {sugerencias.data.items.slice(0, MAXIMO_DE_SUGERENCIAS).map((alumno) => (
            <li key={alumno.id}>
              <Boton variante="secundario" className="w-full text-left" onClick={() => anotar(alumno)}>
                {alumno.apellido}, {alumno.nombre}
              </Boton>
            </li>
          ))}
          {sugerencias.data.items.length === 0 && <li className="text-sm text-stone-500">No hay coincidencias.</li>}
        </ul>
      )}
      {errorComun && <Aviso>{mensajeDeError(registrar.error)}</Aviso>}
      {sinClases !== null && (
        <CobrarYAnotar
          sesionId={sesionId}
          alumno={sinClases.alumno}
          mensaje={sinClases.mensaje}
          alTerminar={() => {
            setSinClases(null);
            setTexto('');
          }}
        />
      )}
    </div>
  );
}

function CobrarYAnotar({
  sesionId,
  alumno,
  mensaje,
  alTerminar,
}: {
  sesionId: number;
  alumno: Alumno;
  mensaje: string;
  alTerminar: () => void;
}) {
  const packs = usePacks();
  const registrar = useRegistrarAsistencia(sesionId);
  const claseSuelta = packs.data?.find((pack) => pack.cantidadClases === 1);
  const [packElegido, setPackElegido] = useState<string | null>(null);
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  // Por defecto, la clase suelta: es lo que se cobra en recepción cuando alguien no tiene pack.
  const packId = packElegido ?? (claseSuelta === undefined ? '' : String(claseSuelta.id));

  return (
    <form
      aria-label="Cobrar y anotar"
      className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        registrar.mutate({ alumnoId: alumno.id, cobrar: { packId: Number(packId), medio } }, { onSuccess: alTerminar });
      }}
    >
      <p className="text-sm text-amber-900">{mensaje}</p>
      {registrar.isError && <Aviso>{mensajeDeError(registrar.error)}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Pack">
          {(id) => (
            <Selector id={id} value={packId} onChange={(evento) => setPackElegido(evento.target.value)}>
              {packs.data?.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {`${pack.nombre} · ${formatearPesos(pack.precio)}`}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo etiqueta="Medio de pago">
          {(id) => (
            <Selector id={id} value={medio} onChange={(evento) => setMedio(evento.target.value as MedioPago)}>
              {MEDIOS_PAGO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {NOMBRES_MEDIO_DE_PAGO[opcion]}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
      </div>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={packId === '' || registrar.isPending}>
          Cobrar y anotar
        </Boton>
      </div>
    </form>
  );
}
