import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icono } from './Icono.tsx';

const dosDigitos = (numero: number) => String(numero).padStart(2, '0');

const FRANJAS = Array.from({ length: (24 - 8) * 4 }, (_, indice) => {
  const minutosDelDia = 8 * 60 + indice * 15;
  return `${dosDigitos(Math.floor(minutosDelDia / 60))}:${dosDigitos(minutosDelDia % 60)}`;
});

const HORA_COMPLETA = /^([01]\d|2[0-3]):[0-5]\d$/;

const SEPARACION = 4;
const MARGEN_DE_LA_VENTANA = 8;

const PASO_CON_FLECHA: Record<string, number | undefined> = { ArrowDown: 1, ArrowUp: -1 };

function franjasCon(valor: string): string[] {
  if (!HORA_COMPLETA.test(valor) || FRANJAS.includes(valor)) return FRANJAS;
  return [...FRANJAS, valor].sort();
}

function filtrar(franjas: string[], escrito: string): string[] {
  const buscado = escrito.replace(/[:\s]/g, '').replace(/^[3-9]/, '0$&');
  const coinciden = franjas.filter((franja) => franja.replace(':', '').startsWith(buscado));
  return coinciden.length > 0 ? coinciden : franjas;
}

function ubicarLista(campo: DOMRect, alto: number, ventana: number): CSSProperties {
  const abajo = ventana - campo.bottom - SEPARACION - MARGEN_DE_LA_VENTANA;
  const arriba = campo.top - SEPARACION - MARGEN_DE_LA_VENTANA;
  const debajo = { left: campo.left, width: campo.width, top: campo.bottom + SEPARACION };
  const encima = { left: campo.left, width: campo.width, bottom: ventana - campo.top + SEPARACION };
  if (alto <= abajo) return debajo;
  if (alto <= arriba) return encima;
  return abajo >= arriba ? { ...debajo, maxHeight: abajo } : { ...encima, maxHeight: arriba };
}

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
  etiqueta: string;
  id?: string | undefined;
};

export function SelectorDeHora({ valor, alCambiar, etiqueta, id }: Props) {
  const base = useId();
  const idDeLista = `${base}-lista`;
  const idDeOpcion = (franja: string) => `${base}-${franja.replace(':', '')}`;
  const nombreDelReloj = `Elegir el horario (${etiqueta})`;
  const raiz = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const [abierta, setAbierta] = useState(false);
  const [ubicacion, setUbicacion] = useState<CSSProperties | null>(null);
  const [filtrando, setFiltrando] = useState(false);
  const [marcada, setMarcada] = useState<string | null>(null);

  const franjas = franjasCon(valor);
  const visibles = filtrando ? filtrar(franjas, valor) : franjas;
  const franjaMarcada = marcada !== null && visibles.includes(marcada) ? marcada : null;
  const opcionMarcada = () => (franjaMarcada === null ? null : document.getElementById(idDeOpcion(franjaMarcada)));
  const dentro = (nodo: EventTarget | null) =>
    nodo instanceof Node && (raiz.current?.contains(nodo) === true || lista.current?.contains(nodo) === true);

  useEffect(() => {
    if (!abierta) return;
    function alTocar(evento: PointerEvent) {
      if (!dentro(evento.target)) cerrar();
    }
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

  useLayoutEffect(() => {
    if (!abierta || raiz.current === null || lista.current === null) return;
    const maximo = parseFloat(getComputedStyle(lista.current).maxHeight);
    const alto = Math.max(lista.current.offsetHeight, Number.isNaN(maximo) ? 0 : maximo);
    setUbicacion(ubicarLista(raiz.current.getBoundingClientRect(), alto, document.documentElement.clientHeight));
  }, [abierta]);

  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (ubicacion !== null && lista.current !== null && opcion !== null) centrar(lista.current, opcion);
  }, [ubicacion]);

  useLayoutEffect(() => {
    const opcion = opcionMarcada();
    if (ubicacion !== null && lista.current !== null && opcion !== null) dejarALaVista(lista.current, opcion);
  }, [franjaMarcada]);

  function abrir(tipeando: boolean) {
    setAbierta(true);
    setFiltrando(tipeando);
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
      evento.preventDefault();
      if (franjaMarcada === null) cerrar();
      else elegir(franjaMarcada);
    } else if (evento.key === 'Escape') {
      cerrar();
    }
  }

  function alPerderElFoco(evento: FocusEvent<HTMLDivElement>) {
    if (!dentro(evento.relatedTarget)) cerrar();
  }

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
      {abierta &&
        createPortal(
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
