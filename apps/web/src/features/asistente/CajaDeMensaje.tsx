import type { KeyboardEvent, Ref } from 'react';
import { LARGO_MAXIMO_DEL_MENSAJE } from '@studio/shared';
import { enfoque, Icono } from '../../components/ui/index.tsx';
import { ACENTO_CLARO } from './estilo.ts';

export function CajaDeMensaje({
  grande,
  campo,
  valor,
  alCambiar,
  alEnviar,
  esperando,
}: {
  grande: boolean;
  campo: Ref<HTMLTextAreaElement>;
  valor: string;
  alCambiar: (texto: string) => void;
  alEnviar: () => void;
  esperando: boolean;
}) {
  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      alEnviar();
    }
  }

  // Borde de 1px con degradé: un fondo pintado detrás de la caja, que la deja ver por el relleno.
  // El brillo alrededor es solo de la caja grande: con la conversación empezada se apaga.
  return (
    <div
      className={`rounded-xl p-px transition-shadow duration-700 motion-reduce:transition-none ${grande ? 'shadow-[0_0_48px_-14px_color-mix(in_oklab,var(--color-acento)_55%,transparent)] focus-within:shadow-[0_0_56px_-10px_color-mix(in_oklab,var(--color-acento)_70%,transparent)]' : 'focus-within:shadow-[0_0_0_1px_var(--color-acento)]'}`}
      style={{
        background: `linear-gradient(135deg, var(--color-acento), var(--color-borde-fuerte) 45%, var(--color-borde-fuerte) 70%, ${ACENTO_CLARO})`,
      }}
    >
      <div className="rounded-[11px] bg-elevado">
        <textarea
          ref={campo}
          aria-label="Mensaje para el asistente"
          maxLength={LARGO_MAXIMO_DEL_MENSAJE}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          onKeyDown={alTeclear}
          placeholder={grande ? 'Preguntá por clases, profesores u horarios...' : 'Escribí un mensaje...'}
          className={`field-sizing-content block max-h-48 w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-6 text-texto placeholder:text-apagado focus:outline-none ${grande ? 'min-h-21' : 'min-h-9'}`}
        />
        <div className="flex items-center gap-2 px-3 pt-1 pb-3">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-borde-fuerte px-2.5 text-xs text-apagado">
            <Icono nombre="escudo" className="size-3.5" />
            Lo procesa Google. No escribas datos de alumnos.
          </span>
          <button
            type="button"
            aria-label="Enviar"
            title="Enviar"
            onClick={alEnviar}
            disabled={esperando || valor.trim() === ''}
            className={`ml-auto grid size-8 place-items-center rounded-lg bg-acento text-white transition ${enfoque} hover:bg-acento/85 disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <Icono nombre="flechaArriba" />
          </button>
        </div>
      </div>
    </div>
  );
}
