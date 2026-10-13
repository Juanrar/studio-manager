import { Fragment, useEffect, useRef, type KeyboardEvent } from 'react';
import { CONVERSACION_LARGA, LARGO_MAXIMO_DEL_MENSAJE } from '@studio/shared';
import { AreaDeTexto, Aviso, Boton, Pagina } from '../../components/ui/index.tsx';
import { ErrorDeApi, mensajeDeError } from '../../lib/api.ts';
import { useSesion } from '../auth/api.ts';
import { useConversacion } from './ConversacionDelAsistente.tsx';
import { TarjetaDePropuesta } from './TarjetaDePropuesta.tsx';

export function AsistentePage() {
  const sesion = useSesion();
  const conversacion = useConversacion();
  const { mensajes, borrador, esperando, error } = conversacion;
  const final = useRef<HTMLDivElement>(null);
  const esAdmin = sesion.data?.rol === 'admin';
  // La API no acepta más historial: el botón se resalta porque es la única forma de seguir.
  const conversacionLarga = error instanceof ErrorDeApi && error.codigo === CONVERSACION_LARGA;

  useEffect(() => {
    // jsdom no implementa scrollIntoView.
    final.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes, esperando]);

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      conversacion.enviar();
    }
  }

  return (
    <Pagina
      titulo="Asistente"
      acciones={
        mensajes.length > 0 && (
          <Boton variante={conversacionLarga ? 'primario' : 'secundario'} onClick={conversacion.empezarDeNuevo}>
            Nueva conversación
          </Boton>
        )
      }
    >
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-3">
        <div className="flex flex-1 flex-col gap-3">
          {mensajes.length === 0 && (
            <div className="flex flex-col gap-1 text-tenue">
              <p>¿Qué clases hay el jueves?</p>
              {esAdmin && <p>Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik</p>}
            </div>
          )}
          {mensajes.map((mensaje) => (
            <Fragment key={mensaje.id}>
              <div
                className={
                  mensaje.autor === 'usuario'
                    ? 'max-w-[85%] self-end rounded-lg bg-resalte px-3 py-2 whitespace-pre-wrap'
                    : 'max-w-[85%] self-start rounded-lg border border-borde bg-elevado px-3 py-2 whitespace-pre-wrap'
                }
              >
                {mensaje.texto}
              </div>
              {mensaje.propuestas.map(({ propuesta, creada }, indice) => (
                <TarjetaDePropuesta
                  key={indice}
                  propuesta={propuesta}
                  creada={creada}
                  alCrearse={(enlace) => conversacion.marcarCreada(mensaje.id, indice, enlace)}
                />
              ))}
            </Fragment>
          ))}
          {esperando && <p className="text-tenue">Pensando...</p>}
          {error !== null && <Aviso>{mensajeDeError(error)}</Aviso>}
          <div ref={final} />
        </div>
        <div className="sticky bottom-0 flex flex-col gap-1 bg-panel pt-2">
          <div className="flex items-end gap-2">
            <AreaDeTexto
              aria-label="Mensaje para el asistente"
              rows={2}
              maxLength={LARGO_MAXIMO_DEL_MENSAJE}
              value={borrador}
              onChange={(evento) => conversacion.cambiarBorrador(evento.target.value)}
              onKeyDown={alTeclear}
            />
            <Boton onClick={conversacion.enviar} disabled={esperando || borrador.trim() === ''}>
              Enviar
            </Boton>
          </div>
          <p className="text-xs text-tenue">
            Lo que escribís acá lo procesa Google. No escribas nombres, DNI ni teléfonos de alumnos.
          </p>
        </div>
      </div>
    </Pagina>
  );
}
