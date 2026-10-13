import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LARGO_MAXIMO_DEL_MENSAJE, type PropuestaDelAsistente } from '@studio/shared';
import { AreaDeTexto, Aviso, Boton, Pagina } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { useSesion } from '../auth/api.ts';
import { useConversar } from './api.ts';
import { TarjetaDePropuesta } from './TarjetaDePropuesta.tsx';

type Mensaje = { id: number; autor: 'usuario' | 'asistente'; texto: string; propuestas: PropuestaDelAsistente[] };

export function AsistentePage() {
  const sesion = useSesion();
  const conversar = useConversar();
  const [historial, setHistorial] = useState<unknown[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const siguienteId = useRef(1);
  const final = useRef<HTMLDivElement>(null);
  const esAdmin = sesion.data?.rol === 'admin';

  useEffect(() => {
    // jsdom no implementa scrollIntoView.
    final.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes, conversar.isPending]);

  function enviar() {
    const mensaje = texto.trim();
    if (mensaje === '' || conversar.isPending) return;
    const idDelUsuario = siguienteId.current++;
    setMensajes((actuales) => [...actuales, { id: idDelUsuario, autor: 'usuario', texto: mensaje, propuestas: [] }]);
    setTexto('');
    conversar.mutate(
      { historial, mensaje },
      {
        onSuccess: (respuesta) => {
          setHistorial(respuesta.historial);
          setMensajes((actuales) => [
            ...actuales,
            { id: siguienteId.current++, autor: 'asistente', texto: respuesta.texto, propuestas: respuesta.propuestas },
          ]);
        },
        onError: () => {
          setMensajes((actuales) => actuales.filter((m) => m.id !== idDelUsuario));
          setTexto(mensaje);
        },
      },
    );
  }

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar();
    }
  }

  return (
    <Pagina titulo="Asistente">
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
              {mensaje.propuestas.map((propuesta, indice) => (
                <TarjetaDePropuesta key={indice} propuesta={propuesta} />
              ))}
            </Fragment>
          ))}
          {conversar.isPending && <p className="text-tenue">Pensando...</p>}
          {conversar.isError && <Aviso>{mensajeDeError(conversar.error)}</Aviso>}
          <div ref={final} />
        </div>
        <div className="sticky bottom-0 flex items-end gap-2 bg-panel pt-2">
          <AreaDeTexto
            aria-label="Mensaje para el asistente"
            rows={2}
            maxLength={LARGO_MAXIMO_DEL_MENSAJE}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={alTeclear}
          />
          <Boton onClick={enviar} disabled={conversar.isPending || texto.trim() === ''}>
            Enviar
          </Boton>
        </div>
      </div>
    </Pagina>
  );
}
