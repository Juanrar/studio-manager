import { useState } from 'react';
import { useParams } from 'react-router';
import type { Profesor } from '@studio/shared';
import {
  Aviso,
  Avatar,
  Boton,
  Cargando,
  Dialogo,
  Icono,
  Insignia,
  Pagina,
  Pestanas,
  type NombreIcono,
  type Pestana,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearPorcentaje } from '../../lib/formato.ts';
import { useHorarios } from '../horarios/api.ts';
import { useActualizarProfesor, useProfesor } from './api.ts';
import { HorarioDelProfesor } from './HorarioDelProfesor.tsx';
import { HistorialDePorcentajes } from './PorcentajesDelProfesor.tsx';
import { EditarProfesorForm } from './ProfesorForm.tsx';

type IdPestana = 'horario' | 'datos' | 'porcentajes';

const PESTANAS: Pestana<IdPestana>[] = [
  { id: 'horario', texto: 'Horario', icono: 'horarios' },
  { id: 'datos', texto: 'Datos', icono: 'lista' },
  { id: 'porcentajes', texto: 'Porcentajes', icono: 'porcentaje' },
];

const VOLVER = { ruta: '/profesores', texto: 'Profesores' };

// Una página entera y no un panel como la del alumno: el horario es una pantalla de trabajo y necesita el ancho.
export function FichaProfesorPage() {
  const id = Number(useParams().id);
  const profesor = useProfesor(id);

  if (profesor.data === undefined) {
    return (
      <Pagina titulo="Profesor" volverA={VOLVER}>
        {profesor.isError ? <Aviso>{mensajeDeError(profesor.error)}</Aviso> : <Cargando />}
      </Pagina>
    );
  }
  // La key reinicia la pestaña y lo que se estaba editando al pasar de un profesor a otro.
  return <Ficha key={profesor.data.id} profesor={profesor.data} />;
}

function Ficha({ profesor }: { profesor: Profesor }) {
  const [pestana, setPestana] = useState<IdPestana>('horario');
  // La misma consulta que la pestaña Horario con la casilla sin marcar: se pide una sola vez.
  const horarios = useHorarios({ profesorId: profesor.id });
  const nombre = `${profesor.nombre} ${profesor.apellido}`;
  const porSemana = horarios.data?.filter((horario) => horario.activo).length;

  return (
    <Pagina titulo={nombre} volverA={VOLVER}>
      {/* Pagina deja un margen alrededor del contenido. El encabezado y la línea de las pestañas van de borde
          a borde, como en la ficha del alumno; cada pestaña pone su propio margen. */}
      <div className="-m-4">
        <div className="flex items-center gap-3.5 px-6 pt-5 pb-3">
          <Avatar nombre={profesor.nombre} grande />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{nombre}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profesor.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia>Dado de baja</Insignia>}
              {profesor.porcentajeVigenteBp !== null && (
                <Insignia tono="violeta">{formatearPorcentaje(profesor.porcentajeVigenteBp)} por alumno</Insignia>
              )}
              {porSemana !== undefined && (
                <Insignia tono="azul">
                  {porSemana} {porSemana === 1 ? 'clase' : 'clases'} por semana
                </Insignia>
              )}
            </div>
          </div>
        </div>

        <Pestanas pestanas={PESTANAS} activa={pestana} alCambiar={setPestana}>
          {pestana === 'horario' && <HorarioDelProfesor profesorId={profesor.id} />}
          {pestana === 'datos' && <Datos profesor={profesor} />}
          {/* El formulario venía de un diálogo angosto: a todo el ancho los dos campos quedan demasiado largos. */}
          {pestana === 'porcentajes' && (
            <div className="max-w-xl p-4">
              <HistorialDePorcentajes profesorId={profesor.id} />
            </div>
          )}
        </Pestanas>
      </div>
    </Pagina>
  );
}

function Datos({ profesor }: { profesor: Profesor }) {
  const actualizar = useActualizarProfesor();
  const [editando, setEditando] = useState(false);

  const campos: [NombreIcono, string, string | null][] = [
    ['documento', 'DNI', profesor.dni],
    ['telefono', 'Teléfono', profesor.telefono],
    ['correo', 'Email', profesor.email],
    ['billetera', 'Alias o CBU', profesor.aliasCbu],
  ];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={() => setEditando(true)}>
          Editar
        </Boton>
        <Boton
          variante="secundario"
          disabled={actualizar.isPending}
          onClick={() => actualizar.mutate({ id: profesor.id, datos: { activo: !profesor.activo } })}
        >
          {profesor.activo ? 'Dar de baja' : 'Reactivar'}
        </Boton>
      </div>

      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}

      <dl>
        {campos.map(([icono, etiqueta, valor]) => (
          <div
            key={etiqueta}
            className="grid min-h-8 grid-cols-[10rem_minmax(0,1fr)] items-center gap-3 rounded px-2 hover:bg-elevado sm:grid-cols-[12rem_minmax(0,1fr)]"
          >
            <dt className="flex items-center gap-1.5 text-apagado">
              <Icono nombre={icono} className="size-3.5" />
              {etiqueta}
            </dt>
            <dd className="py-1.5 break-words">{valor ?? <span className="text-apagado">Vacío</span>}</dd>
          </div>
        ))}
      </dl>

      <Dialogo titulo="Editar profesor" abierto={editando} alCerrar={() => setEditando(false)}>
        <EditarProfesorForm profesor={profesor} alTerminar={() => setEditando(false)} />
      </Dialogo>
    </div>
  );
}
