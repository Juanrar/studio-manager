import { enfoque, Icono, type NombreIcono } from '../../components/ui/index.tsx';
import { ACENTO_CLARO, DEGRADE } from './estilo.ts';

type Sugerencia = { icono: NombreIcono; titulo: string; frase: string; soloAdmin: boolean };

export const SUGERENCIAS: Sugerencia[] = [
  { icono: 'calendario', titulo: 'Clases del jueves', frase: '¿Qué clases hay el jueves?', soloAdmin: false },
  {
    icono: 'calendarioMas',
    titulo: 'Crear un workshop',
    frase: 'Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik',
    soloAdmin: true,
  },
  {
    icono: 'personaMas',
    titulo: 'Alta de profesor',
    frase: 'Dá de alta a Sofía Ruiz con 40%, martes y jueves de 18 a 19 Contemporáneo',
    soloAdmin: true,
  },
  {
    icono: 'reloj',
    titulo: 'Horario nuevo',
    frase: 'Agregá Salsa los martes de 20 a 21 con Laura, todas las semanas',
    soloAdmin: true,
  },
  { icono: 'profesores', titulo: 'Clases de un profesor', frase: '¿Qué clases da Erik esta semana?', soloAdmin: false },
];

export function Saludo({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span
        className="grid size-11 place-items-center rounded-2xl text-white"
        style={{ ...DEGRADE, boxShadow: '0 10px 36px -8px color-mix(in oklab, var(--color-acento) 75%, transparent)' }}
      >
        <Icono nombre="destellos" className="size-5" />
      </span>
      <p className="mt-1 text-base text-tenue">Hola, {nombre}</p>
      <h2
        className="bg-clip-text pb-1 text-[32px] leading-tight font-semibold tracking-tight text-transparent"
        style={{ backgroundImage: `linear-gradient(90deg, var(--color-texto) 30%, ${ACENTO_CLARO})` }}
      >
        ¿Por dónde empezamos?
      </h2>
    </div>
  );
}

export function Sugerencias({ esAdmin, alUsar }: { esAdmin: boolean; alUsar: (frase: string) => void }) {
  return (
    <div role="group" aria-label="Sugerencias" className="flex flex-wrap justify-center gap-2">
      {SUGERENCIAS.filter((sugerencia) => esAdmin || !sugerencia.soloAdmin).map((sugerencia) => (
        <button
          key={sugerencia.titulo}
          type="button"
          onClick={() => alUsar(sugerencia.frase)}
          className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-full border border-borde-fuerte bg-panel px-3 font-medium whitespace-nowrap text-tenue transition ${enfoque} hover:border-acento/50 hover:bg-resalte hover:text-texto`}
        >
          <Icono nombre={sugerencia.icono} className="size-3.5" />
          {sugerencia.titulo}
        </button>
      ))}
    </div>
  );
}
