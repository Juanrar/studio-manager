import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Lo que separa la lista del campo y del borde de la ventana.
const SEPARACION = 4;
const MARGEN_DE_LA_VENTANA = 8;

const PASO_CON_FLECHA: Record<string, number | undefined> = { ArrowDown: 1, ArrowUp: -1 };

// La grilla más el valor actual si es una hora que la grilla no tiene (una clase a las 18:20), en su lugar
// ordenado, para que abrir la lista no lo pierda. Lo que se tipea a medias ("19", "18:") no es una hora: no se agrega.
function franjasCon(valor: string): string[] {
  if (!HORA_COMPLETA.test(valor) || FRANJAS.includes(valor)) return FRANJAS;
  return [...FRANJAS, valor].sort();
}

// Compara sin los dos puntos y desde el principio de la hora: "193" encuentra 19:30 y "21" no trae las 12:15.
// Una cifra de 3 a 9 al principio solo puede ser la hora sin el cero de adelante: "9:30" es 09:30.
// Si no coincide ninguna devuelve todas, así la lista nunca queda vacía.
function filtrar(franjas: string[], escrito: string): string[] {
  const buscado = escrito.replace(/[:\s]/g, '').replace(/^[3-9]/, '0$&');
  const coinciden = franjas.filter((franja) => franja.replace(':', '').startsWith(buscado));
  return coinciden.length > 0 ? coinciden : franjas;
}

// Dónde va la lista, que puede llegar a medir `alto`, para un campo ubicado en `campo` dentro de una ventana de
// `ventana` de alto. Debajo del campo si entra; si no, encima si entra; y si no entra en ninguno de los dos lados,
// del lado con más lugar y tan baja como haga falta. Las coordenadas son las de la ventana: la lista es fixed.
function ubicarLista(campo: DOMRect, alto: number, ventana: number): CSSProperties {
  const abajo = ventana - campo.bottom - SEPARACION - MARGEN_DE_LA_VENTANA;
  const arriba = campo.top - SEPARACION - MARGEN_DE_LA_VENTANA;
  const debajo = { left: campo.left, width: campo.width, top: campo.bottom + SEPARACION };
  const encima = { left: campo.left, width: campo.width, bottom: ventana - campo.top + SEPARACION };
  if (alto <= abajo) return debajo;
  if (alto <= arriba) return encima;
  return abajo >= arriba ? { ...debajo, maxHeight: abajo } : { ...encima, maxHeight: arriba };
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
  // Una fila tiene el reloj de inicio y el de fin: el nombre lleva la etiqueta para que se distingan.
  const nombreDelReloj = `Elegir el horario (${etiqueta})`;
  const raiz = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const [abierta, setAbierta] = useState(false);
  // Dónde se dibuja la lista. Se calcula al abrir, con la lista ya en pantalla para saber cuánto mide.
  const [ubicacion, setUbicacion] = useState<CSSProperties | null>(null);
  // La lista filtra solo desde que se tipea: abierta con el reloj muestra todas las franjas.
  const [filtrando, setFiltrando] = useState(false);
  const [marcada, setMarcada] = useState<string | null>(null);

  const franjas = franjasCon(valor);
  const visibles = filtrando ? filtrar(franjas, valor) : franjas;
  const franjaMarcada = marcada !== null && visibles.includes(marcada) ? marcada : null;
  const opcionMarcada = () => (franjaMarcada === null ? null : document.getElementById(idDeOpcion(franjaMarcada)));
  // La lista está en el body, no dentro del campo: "adentro del selector" son las dos cosas.
  const dentro = (nodo: EventTarget | null) =>
    nodo instanceof Node && (raiz.current?.contains(nodo) === true || lista.current?.contains(nodo) === true);

  // Mientras está abierta, la lista se cierra con un clic fuera y con lo que la deje lejos de su campo.
  // Para el clic no alcanza con mirar el foco: en una tablet, tocar una zona sin controles no lo saca del campo.
  useEffect(() => {
    if (!abierta) return;
    function alTocar(evento: PointerEvent) {
      if (!dentro(evento.target)) cerrar();
    }
    // La lista es fixed: si se desplaza algo que contiene al campo, o cambia el tamaño de la ventana, queda suelta.
    // Los scroll no burbujean, por eso se escuchan en la captura. El de la lista misma no cuenta.
    function alDesplazar(evento: Event) {
      if (evento.target instanceof Node && evento.target.contains(raiz.current)) cerrar();
    }
    document.addEventListener('pointerdown', alTocar);
    window.addEventListener('scroll', alDesplazar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('pointerdown', alTocar);
      window.removeEventListener('scroll', alDesplazar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierta]);

  // Con la lista ya dibujada se sabe cuánto mide. Se cuenta lo que puede llegar a medir (su max-height) y no lo
  // que mide ahora: al filtrar crece y se achica, y no tiene que desbordar la ventana ni cambiar de lado.
  useLayoutEffect(() => {
    if (!abierta || raiz.current === null || lista.current === null) return;
    const maximo = parseFloat(getComputedStyle(lista.current).maxHeight);
    const alto = Math.max(lista.current.offsetHeight, Number.isNaN(maximo) ? 0 : maximo);
    setUbicacion(ubicarLista(raiz.current.getBoundingClientRect(), alto, document.documentElement.clientHeight));
  }, [abierta]);

  // Ya ubicada, la franja marcada (la del valor actual) queda en el medio de la lista.
  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (ubicacion !== null && lista.current !== null && opcion !== null) centrar(lista.current, opcion);
  }, [ubicacion]);

  // Con las flechas, la franja marcada no se sale de lo que se ve.
  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (ubicacion !== null && lista.current !== null && opcion !== null) dejarALaVista(lista.current, opcion);
  }, [franjaMarcada]);

  function abrir(tipeando: boolean) {
    setAbierta(true);
    setFiltrando(tipeando);
    // Con el reloj o la flecha se marca el valor actual, para que las flechas sigan desde ahí.
    setMarcada(tipeando || !franjas.includes(valor) ? null : valor);
  }

  function cerrar() {
    setAbierta(false);
    setUbicacion(null);
    setFiltrando(false);
    setMarcada(null);
  }

  function elegir(franja: string) {
    alCambiar(franja);
    cerrar();
  }

  function alternar() {
    // Sin desplazar: si el campo está cortado por el borde del área, el scroll cerraría la lista que se abre ahora.
    entrada.current?.focus({ preventScroll: true });
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
    if (!dentro(evento.relatedTarget)) cerrar();
  }

  // El campo casi siempre tiene una hora: un clic deja el cursor al final y tipear "19" daría "18:0019". Al entrar
  // se selecciona entera, así lo que se tipea la reemplaza.
  function alEnfocar(evento: FocusEvent<HTMLInputElement>) {
    evento.currentTarget.select();
  }

  return (
    <div
      ref={raiz}
      onBlur={alPerderElFoco}
      className="inline-flex items-center overflow-hidden rounded-md border border-borde-fuerte bg-elevado focus-within:border-acento focus-within:ring-1 focus-within:ring-acento"
    >
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
        onFocus={alEnfocar}
        onChange={alEscribir}
        onKeyDown={alTeclear}
        className="w-14 bg-transparent py-1.5 pl-2.5 text-texto tabular-nums outline-none"
      />
      {/* Fuera del recorrido del tabulador, como las pestañas no elegidas. onMouseDown evita que el campo
          pierda el foco al tocar el reloj. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={nombreDelReloj}
        title={nombreDelReloj}
        aria-expanded={abierta}
        onMouseDown={(evento) => evento.preventDefault()}
        onClick={alternar}
        className="grid w-8 flex-none place-items-center self-stretch text-tenue hover:bg-resalte hover:text-texto"
      >
        <Icono nombre="reloj" />
      </button>
      {/* La lista va en el body con position fixed: dentro del campo la recortarían el scroll de Pagina y el
          overflow-hidden de la tarjeta. z-30 la deja por encima de un diálogo (z-20). */}
      {abierta &&
        createPortal(
          // Chrome deja enfocar con Tab una lista con scroll que no tiene nada enfocable adentro: tabIndex -1 la saca.
          <ul
            ref={lista}
            id={idDeLista}
            role="listbox"
            aria-label="Horarios"
            tabIndex={-1}
            onMouseDown={(evento) => evento.preventDefault()}
            style={ubicacion ?? undefined}
            className="fixed z-30 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-borde-fuerte bg-panel py-1 shadow-2xl shadow-black/60"
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
          </ul>,
          document.body,
        )}
    </div>
  );
}
