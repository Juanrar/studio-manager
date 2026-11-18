import { useState, type ReactNode } from 'react';
import type { FilaDelRanking } from '@studio/shared';
import { Entrada, Icono } from '../../components/ui/index.tsx';
import { formatearPesos } from '../../lib/formato.ts';

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function coincideConBusqueda(fila: FilaDelRanking, busqueda: string): boolean {
  const nombre = sinTildes(`${fila.profesor.nombre} ${fila.profesor.apellido}`);
  return sinTildes(busqueda)
    .split(/\s+/)
    .filter((palabra) => palabra !== '')
    .every((palabra) => nombre.includes(palabra));
}

export function sueldoDe(fila: FilaDelRanking): number {
  return fila.liquidacion?.monto ?? fila.montoCalculado;
}

function apellidoYNombre(fila: FilaDelRanking): string {
  return `${fila.profesor.apellido}, ${fila.profesor.nombre}`;
}

function ordenarPorApellido(profesores: FilaDelRanking[]): FilaDelRanking[] {
  return [...profesores].sort((a, b) => apellidoYNombre(a).localeCompare(apellidoYNombre(b), 'es'));
}

export function ListaDeProfesores({
  profesores,
  elegido,
  alElegir,
  datoDe,
  sinElegido,
  children,
}: {
  profesores: FilaDelRanking[];
  elegido: number | null;
  alElegir: (id: number) => void;
  datoDe: (fila: FilaDelRanking) => ReactNode;
  sinElegido: string;
  children: ReactNode;
}) {
  const [busqueda, setBusqueda] = useState('');
  const filtrados = ordenarPorApellido(profesores).filter((fila) => coincideConBusqueda(fila, busqueda));

  return (
    <div className="grid items-start gap-4 lg:min-h-[28rem] lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apagado">
            <Icono nombre="persona" />
          </span>
          <Entrada
            autoFocus
            aria-label="Buscar profesor"
            placeholder="Buscar profesor por nombre o apellido"
            className="pl-8"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            onKeyDown={(evento) => {
              const primero = filtrados[0];
              if (evento.key === 'Enter' && primero !== undefined) alElegir(primero.profesor.id);
            }}
          />
        </div>
        {filtrados.length === 0 && <p className="px-3 py-2 text-apagado">Ningún profesor con ese nombre.</p>}
        <ul aria-label="Profesores" className="flex flex-col overflow-hidden rounded-md border border-borde empty:hidden">
          {filtrados.map((fila) => {
            const activo = fila.profesor.id === elegido;
            return (
              <li key={fila.profesor.id} className="border-b border-borde last:border-b-0">
                <button
                  type="button"
                  aria-current={activo}
                  onClick={() => alElegir(fila.profesor.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${activo ? 'bg-resalte' : 'hover:bg-elevado'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{apellidoYNombre(fila)}</span>
                    <span className="text-xs text-apagado">{formatearPesos(sueldoDe(fila))}</span>
                  </span>
                  {datoDe(fila)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <section aria-label="Profesor elegido" className="min-w-0 rounded-md border border-borde p-4">
        {elegido === null ? <p className="text-apagado">{sinElegido}</p> : children}
      </section>
    </div>
  );
}
