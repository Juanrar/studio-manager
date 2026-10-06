import { useState } from 'react';
import { Link } from 'react-router';
import type { ProfesorEnListado } from '@studio/shared';
import {
  Aviso,
  Avatar,
  Boton,
  Cargando,
  Casilla,
  Celda,
  Dialogo,
  Entrada,
  Insignia,
  Pagina,
  Tabla,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { abreviaturaDelDia, formatearPorcentaje } from '../../lib/formato.ts';
import { useProfesores } from './api.ts';
import { NuevoProfesorForm } from './ProfesorForm.tsx';

const COLUMNAS = [
  { texto: 'Profesor', icono: 'persona' },
  { texto: 'Porcentaje', icono: 'porcentaje' },
  { texto: 'Clases por semana', icono: 'pila' },
  { texto: 'Días', icono: 'calendario' },
  { texto: 'Teléfono', icono: 'telefono' },
  { texto: 'Alias o CBU', icono: 'billetera' },
  { texto: 'Estado', icono: 'progreso' },
] as const;

// "nunez" tiene que encontrar a Núñez: se compara sin mayúsculas ni tildes.
function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Nombre completo en los dos órdenes, como el buscador de alumnos: "erik zapata" y "zapata erik" encuentran lo mismo.
function coincide(profesor: ProfesorEnListado, busqueda: string): boolean {
  const buscado = sinTildes(busqueda.trim());
  return [
    `${profesor.nombre} ${profesor.apellido}`,
    `${profesor.apellido} ${profesor.nombre}`,
    profesor.dni ?? '',
  ].some((campo) => sinTildes(campo).includes(buscado));
}

export function ProfesoresPage() {
  const [texto, setTexto] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [creando, setCreando] = useState(false);
  const profesores = useProfesores({ incluirInactivos });

  const visibles = profesores.data?.filter((profesor) => coincide(profesor, texto));

  return (
    <Pagina
      titulo="Profesores"
      acciones={<Boton onClick={() => setCreando(true)}>Nuevo profesor</Boton>}
      barra={
        <>
          <Entrada
            type="search"
            aria-label="Buscar profesor"
            placeholder="Buscar por nombre, apellido o DNI"
            className="max-w-xs"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <Casilla
            etiqueta="Mostrar dados de baja"
            checked={incluirInactivos}
            onChange={(evento) => setIncluirInactivos(evento.target.checked)}
          />
        </>
      }
    >
      {profesores.isPending && <Cargando />}
      {profesores.isError && <Aviso>{mensajeDeError(profesores.error)}</Aviso>}
      {visibles && (
        <>
          <Tabla columnas={COLUMNAS}>
            {visibles.map((profesor) => (
              <FilaDeProfesor key={profesor.id} profesor={profesor} />
            ))}
          </Tabla>
          {visibles.length === 0 && <p className="mt-3 text-apagado">No hay profesores que coincidan con la búsqueda.</p>}
          <p className="mt-3 text-apagado">
            {visibles.length} profesores · {visibles.filter((profesor) => profesor.activo).length} activos
          </p>
        </>
      )}

      <Dialogo titulo="Nuevo profesor" abierto={creando} alCerrar={() => setCreando(false)}>
        <NuevoProfesorForm alTerminar={() => setCreando(false)} />
      </Dialogo>
    </Pagina>
  );
}

function FilaDeProfesor({ profesor }: { profesor: ProfesorEnListado }) {
  return (
    <tr>
      <Celda>
        <Link
          to={`/profesores/${profesor.id}`}
          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium hover:bg-resalte"
        >
          <Avatar nombre={profesor.nombre} />
          {profesor.apellido}, {profesor.nombre}
        </Link>
      </Celda>
      <Celda>{profesor.porcentajeVigenteBp === null ? '—' : formatearPorcentaje(profesor.porcentajeVigenteBp)}</Celda>
      <Celda>{profesor.clasesPorSemana === 0 ? '—' : profesor.clasesPorSemana}</Celda>
      <Celda>{profesor.diasConClase.length === 0 ? '—' : profesor.diasConClase.map(abreviaturaDelDia).join(', ')}</Celda>
      <Celda>{profesor.telefono ?? '—'}</Celda>
      <Celda>{profesor.aliasCbu ?? '—'}</Celda>
      <Celda>{profesor.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia>Dado de baja</Insignia>}</Celda>
    </tr>
  );
}
