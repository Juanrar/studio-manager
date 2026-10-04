import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icono } from './Icono.tsx';

const dosDigitos = (numero: number) => String(numero).padStart(2, '0');

// De 08:00 a 23:45 cada 15 minutos. Es una ayuda para elegir, no una regla: la API acepta cualquier HH:MM
// y el campo deja tipear cualquier hora.
const FRANJAS = Array.from({ length: (24 - 8) * 4 }, (_, indice) => {
  const minutosDelDia = 8 * 60 + indice * 15;
  return `${dosDigitos(Math.floor(minutosDelDia / 60))}:${dosDigitos(minutosDelDia % 60)}`;
});

// El formato de una hora completa, el mismo que valida la API.
const HORA_COMPLETA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Lo que ocupa la lista abierta: su alto máximo (max-h-64, 256px) más la separación con el campo (mt-1, 4px).
const ESPACIO_PARA_LA_LISTA = 260;

const PASO_CON_FLECHA: Record<string, number | undefined> = { ArrowDown: 1, ArrowUp: -1 };

// La grilla más el valor actual si es una hora que la grilla no tiene (una clase a las 18:20), en su lugar
// ordenado, para que abrir la lista no lo pierda. Lo que se tipea a medias ("19", "18:") no es una hora: no se agrega.
function franjasCon(valor: string): string[] {
  if (!HORA_COMPLETA.test(valor) || FRANJAS.includes(valor)) return FRANJAS;
  return [...FRANJAS, valor].sort();
}

// Compara sin los dos puntos y desde el principio de la hora: "193" encuentra 19:30 y "21" no trae las 12:15.
// Si no coincide ninguna devuelve todas, así la lista nunca queda vacía.
function filtrar(franjas: string[], escrito: string): string[] {
  const buscado = escrito.replace(/[:\s]/g, '');
  const coinciden = franjas.filter((franja) => franja.replace(':', '').startsWith(buscado));
  return coinciden.length > 0 ? coinciden : franjas;
}

// offsetTop se mide desde la lista, que es la que tiene position, igual que scrollTop.
function centrar(lista: HTMLElement, opcion: HTMLElement) {
  lista.scrollTop = Math.max(0, opcion.offsetTop - (lista.clientHeight - opcion.offsetHeight) / 2);
}

function dejarALaVista(lista: HTMLElement, opcion: HTMLElement) {
  const arriba = opcion.offsetTop;
  const abajo = arriba + opcion.offsetHeight;
  if (arriba < lista.scrollTop) lista.scrollTop = arriba;
  else if (abajo > lista.scrollTop + lista.clientHeight) lista.scrollTop = abajo - lista.clientHeight;
}

type Props = {
  valor: string;
  alCambiar: (valor: string) => void;
  // Lo que lee un lector de pantalla al llegar al campo.
  etiqueta: string;
  // Para que una <label> nombre el campo.
  id?: string | undefined;
};

// Campo de hora con un reloj que abre la lista de franjas. Es controlado: no guarda el valor, lo recibe y avisa
// con alCambiar, también de lo que se tipea aunque todavía no sea una hora. El foco queda siempre en el campo y la
// franja "marcada" es la que eligen Enter y las flechas.
export function SelectorDeHora({ valor, alCambiar, etiqueta, id }: Props) {
  const base = useId();
  const idDeLista = `${base}-lista`;
  const idDeOpcion = (franja: string) => `${base}-${franja.replace(':', '')}`;
  const raiz = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const [abierta, setAbierta] = useState(false);
  const [haciaArriba, setHaciaArriba] = useState(false);
  // La lista filtra solo desde que se tipea: abierta con el reloj muestra todas las franjas.
  const [filtrando, setFiltrando] = useState(false);
  const [marcada, setMarcada] = useState<string | null>(null);

  const franjas = franjasCon(valor);
  const visibles = filtrando ? filtrar(franjas, valor) : franjas;
  const franjaMarcada = marcada !== null && visibles.includes(marcada) ? marcada : null;
  const opcionMarcada = () => (franjaMarcada === null ? null : document.getElementById(idDeOpcion(franjaMarcada)));

  // Un clic fuera cierra la lista. Mirar el foco no alcanza: en una tablet, tocar una zona sin controles
  // no lo saca del campo.
  useEffect(() => {
    if (!abierta) return;
    function alTocar(evento: PointerEvent) {
      const adentro = evento.target instanceof Node && raiz.current?.contains(evento.target) === true;
      if (!adentro) cerrar();
    }
    document.addEventListener('pointerdown', alTocar);
    return () => document.removeEventListener('pointerdown', alTocar);
  }, [abierta]);

  // Al abrir, la franja marcada (la del valor actual) queda en el medio de la lista.
  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (abierta && lista.current !== null && opcion !== null) centrar(lista.current, opcion);
  }, [abierta]);

  // Con las flechas, la franja marcada no se sale de lo que se ve.
  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (lista.current !== null && opcion !== null) dejarALaVista(lista.current, opcion);
  }, [franjaMarcada]);

  // Si debajo del campo no entra la lista y arriba hay más lugar, se abre hacia arriba.
  function seAbreHaciaArriba() {
    const caja = raiz.current?.getBoundingClientRect();
    if (caja === undefined) return false;
    const abajo = window.innerHeight - caja.bottom;
    return abajo < ESPACIO_PARA_LA_LISTA && caja.top > abajo;
  }

  function abrir(tipeando: boolean) {
    if (!abierta) setHaciaArriba(seAbreHaciaArriba());
    setAbierta(true);
    setFiltrando(tipeando);
    // Con el reloj o la flecha se marca el valor actual, para que las flechas sigan desde ahí.
    setMarcada(tipeando || !franjas.includes(valor) ? null : valor);
  }

  function cerrar() {
    setAbierta(false);
    setFiltrando(false);
    setMarcada(null);
  }

  function elegir(franja: string) {
    alCambiar(franja);
    cerrar();
  }

  function alternar() {
    entrada.current?.focus();
    if (abierta) cerrar();
    else abrir(false);
  }

  function alEscribir(evento: ChangeEvent<HTMLInputElement>) {
    alCambiar(evento.target.value);
    abrir(true);
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (!abierta) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        abrir(false);
      }
      return;
    }
    const paso = PASO_CON_FLECHA[evento.key];
    if (paso !== undefined) {
      evento.preventDefault();
      const actual = franjaMarcada === null ? -1 : visibles.indexOf(franjaMarcada);
      setMarcada(visibles[Math.min(Math.max(actual + paso, 0), visibles.length - 1)] ?? null);
    } else if (evento.key === 'Enter') {
      // Con la lista abierta, Enter es de la lista: no tiene que enviar el formulario que contenga al campo.
      evento.preventDefault();
      if (franjaMarcada === null) cerrar();
      else elegir(franjaMarcada);
    } else if (evento.key === 'Escape') {
      cerrar();
    }
  }

  // Al salir del campo con Tab la lista se cierra. Tocar el reloj o una franja no lo hace: ver onMouseDown.
  function alPerderElFoco(evento: FocusEvent<HTMLDivElement>) {
    if (!evento.currentTarget.contains(evento.relatedTarget)) cerrar();
  }

  return (
    <div ref={raiz} className="relative inline-flex" onBlur={alPerderElFoco}>
      <div className="flex items-center overflow-hidden rounded-md border border-borde-fuerte bg-elevado focus-within:border-acento focus-within:ring-1 focus-within:ring-acento">
        <input
          ref={entrada}
          id={id}
          role="combobox"
          aria-label={etiqueta}
          aria-expanded={abierta}
          aria-controls={abierta ? idDeLista : undefined}
          aria-autocomplete="list"
          aria-activedescendant={franjaMarcada === null ? undefined : idDeOpcion(franjaMarcada)}
          autoComplete="off"
          value={valor}
          onChange={alEscribir}
          onKeyDown={alTeclear}
          className="w-14 bg-transparent py-1.5 pl-2.5 text-texto tabular-nums outline-none"
        />
        {/* Fuera del recorrido del tabulador, como las pestañas no elegidas. onMouseDown evita que el campo
            pierda el foco al tocar el reloj. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Elegir el horario"
          title="Elegir el horario"
          aria-expanded={abierta}
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={alternar}
          className="grid w-8 flex-none place-items-center self-stretch text-tenue hover:bg-resalte hover:text-texto"
        >
          <Icono nombre="reloj" />
        </button>
      </div>
      {abierta && (
        // Chrome deja enfocar con Tab una lista con scroll que no tiene nada enfocable adentro: tabIndex -1 la saca.
        <ul
          ref={lista}
          id={idDeLista}
          role="listbox"
          aria-label="Horarios"
          tabIndex={-1}
          onMouseDown={(evento) => evento.preventDefault()}
          className={`absolute left-0 z-10 max-h-64 w-full overflow-y-auto rounded-md border border-borde-fuerte bg-panel py-1 shadow-2xl shadow-black/60 ${haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {visibles.map((franja) => (
            <li
              key={franja}
              id={idDeOpcion(franja)}
              role="option"
              aria-selected={franja === franjaMarcada}
              onClick={() => elegir(franja)}
              className={`px-2.5 py-1 tabular-nums hover:bg-resalte hover:text-texto ${franja === franjaMarcada ? 'bg-resalte text-texto' : 'text-tenue'}`}
            >
              {franja}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
