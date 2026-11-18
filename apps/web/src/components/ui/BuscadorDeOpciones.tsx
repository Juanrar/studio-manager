import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { useId, useState } from 'react';
import { Icono } from './Icono.tsx';

export type Opcion = { valor: number; texto: string };

// Sin tildes ni mayúsculas, para que "jose" encuentre a "José".
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// Los que contienen todas las palabras escritas, en cualquier orden: "zapata erik" encuentra a Erik Zapata.
function filtrar(opciones: Opcion[], escrito: string): Opcion[] {
  const palabras = normalizar(escrito).split(/\s+/).filter(Boolean);
  return opciones.filter((opcion) => {
    const texto = normalizar(opcion.texto);
    return palabras.every((palabra) => texto.includes(palabra));
  });
}

type Props = {
  opciones: Opcion[];
  // Lo elegido. Si no está en `opciones` se muestra `textoDelValor`.
  valor: number;
  textoDelValor: string;
  alElegir: (valor: number) => void;
  etiqueta: string;
  id?: string | undefined;
};

// Campo de búsqueda por nombre con una lista debajo. Es controlado: el valor elegido viene de afuera. Mientras
// no se tipea muestra el nombre elegido; al tipear filtra la lista, y al salir sin elegir vuelve al elegido.
export function BuscadorDeOpciones({ opciones, valor, textoDelValor, alElegir, etiqueta, id }: Props) {
  const base = useId();
  const idDeLista = `${base}-lista`;
  const idDeOpcion = (opcion: Opcion) => `${base}-${opcion.valor}`;
  const [abierta, setAbierta] = useState(false);
  // Lo tipeado. null es que no se tipeó: el campo muestra el elegido y la lista trae todas las opciones.
  const [escrito, setEscrito] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(0);

  const elegida = opciones.find((opcion) => opcion.valor === valor);
  const nombreElegido = elegida?.texto ?? textoDelValor;
  const visibles = escrito === null ? opciones : filtrar(opciones, escrito);
  const indiceMarcado = Math.min(marcada, Math.max(visibles.length - 1, 0));
  const opcionMarcada = visibles[indiceMarcado];

  function cerrar() {
    setAbierta(false);
    setEscrito(null);
    setMarcada(0);
  }

  function elegir(opcion: Opcion) {
    alElegir(opcion.valor);
    cerrar();
  }

  function alEscribir(evento: ChangeEvent<HTMLInputElement>) {
    setEscrito(evento.target.value);
    setMarcada(0);
    // Las sugerencias aparecen al tipear; con el campo vacío no hay nada que sugerir.
    setAbierta(evento.target.value.trim() !== '');
  }

  // Al entrar se selecciona el nombre entero, así lo que se tipea lo reemplaza.
  function alEnfocar(evento: FocusEvent<HTMLInputElement>) {
    evento.currentTarget.select();
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!abierta) return setAbierta(true);
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      setMarcada(Math.min(Math.max(indiceMarcado + paso, 0), visibles.length - 1));
    } else if (evento.key === 'Enter' && abierta) {
      // Con la lista abierta Enter es de la lista: no envía el formulario.
      evento.preventDefault();
      if (opcionMarcada === undefined) cerrar();
      else elegir(opcionMarcada);
    } else if (evento.key === 'Escape' && abierta) {
      // Escape cierra la lista y no la ventana que la contiene.
      evento.stopPropagation();
      cerrar();
    }
  }

  return (
    <div className="relative" onBlur={(evento) => !evento.currentTarget.contains(evento.relatedTarget) && cerrar()}>
      <Icono nombre="lupa" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-apagado" />
      <input
        id={id}
        role="combobox"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={abierta ? idDeLista : undefined}
        aria-autocomplete="list"
        aria-activedescendant={abierta && opcionMarcada !== undefined ? idDeOpcion(opcionMarcada) : undefined}
        autoComplete="off"
        placeholder="Buscar por nombre"
        value={escrito ?? nombreElegido}
        onFocus={alEnfocar}
        onChange={alEscribir}
        onKeyDown={alTeclear}
        className="w-full rounded-md border border-borde-fuerte bg-elevado py-1.5 pl-8 pr-2.5 text-texto placeholder:text-apagado focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento"
      />
      {abierta && (
        <ul
          id={idDeLista}
          role="listbox"
          aria-label={etiqueta}
          tabIndex={-1}
          // Sin esto, tocar una opción le saca el foco al campo y la lista se cierra antes del clic.
          onMouseDown={(evento) => evento.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-48 overflow-y-auto overscroll-contain rounded-md border border-borde-fuerte bg-panel py-1 shadow-2xl shadow-black/60"
        >
          {visibles.length === 0 && <li className="px-2.5 py-1 text-apagado">Nadie con ese nombre</li>}
          {visibles.map((opcion, indice) => (
            <li
              key={opcion.valor}
              id={idDeOpcion(opcion)}
              role="option"
              aria-selected={indice === indiceMarcado}
              ref={indice === indiceMarcado ? (nodo) => nodo?.scrollIntoView?.({ block: 'nearest' }) : undefined}
              onClick={() => elegir(opcion)}
              className={`cursor-pointer px-2.5 py-1 hover:bg-resalte hover:text-texto ${indice === indiceMarcado ? 'bg-resalte text-texto' : 'text-tenue'}`}
            >
              {opcion.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
