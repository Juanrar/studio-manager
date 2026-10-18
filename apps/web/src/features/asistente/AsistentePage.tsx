import { Fragment, useEffect, useRef } from 'react';
import { CONVERSACION_LARGA } from '@studio/shared';
import { Aviso, Boton, Pagina } from '../../components/ui/index.tsx';
import { ErrorDeApi, mensajeDeError } from '../../lib/api.ts';
import { useSesion } from '../auth/api.ts';
import { Saludo, Sugerencias } from './Bienvenida.tsx';
import { CajaDeMensaje } from './CajaDeMensaje.tsx';
import { useConversacion } from './ConversacionDelAsistente.tsx';
import { TarjetaDeAltaDeProfesor } from './TarjetaDeAltaDeProfesor.tsx';
import { TarjetaDePropuesta } from './TarjetaDePropuesta.tsx';

export function AsistentePage() {
  const sesion = useSesion();
  const conversacion = useConversacion();
  const { mensajes, borrador, esperando, error } = conversacion;
  const final = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const esAdmin = sesion.data?.rol === 'admin';
  const nombre = sesion.data?.nombre.split(' ')[0] ?? '';
  const vacia = mensajes.length === 0 && !esperando;
  // La API no acepta más historial: el botón se resalta porque es la única forma de seguir.
  const conversacionLarga = error instanceof ErrorDeApi && error.codigo === CONVERSACION_LARGA;

  useEffect(() => {
    // jsdom no implementa scrollIntoView.
    final.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes, esperando]);

  function usarSugerencia(frase: string) {
    conversacion.cambiarBorrador(frase);
    campo.current?.focus();
  }

  const caja = (grande: boolean) => (
    <CajaDeMensaje
      grande={grande}
      campo={campo}
      valor={borrador}
      alCambiar={conversacion.cambiarBorrador}
      alEnviar={conversacion.enviar}
      esperando={esperando}
    />
  );
  const aviso = error !== null && <Aviso>{mensajeDeError(error)}</Aviso>;

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
      {/* La caja ocupa siempre el mismo lugar del árbol: así el campo no se vuelve a montar ni pierde el foco al empezar. */}
      <div
        className={`mx-auto flex min-h-full w-full max-w-2xl flex-col ${vacia ? 'justify-center gap-6 py-10' : ''}`}
      >
        {vacia ? (
          <Saludo nombre={nombre} />
        ) : (
          <div className="flex flex-1 flex-col justify-end gap-3 py-6">
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
                {mensaje.propuestas.map(({ propuesta, creada }, indice) =>
                  propuesta.tipo === 'altaDeProfesor' ? (
                    <TarjetaDeAltaDeProfesor
                      key={indice}
                      propuesta={propuesta}
                      creada={creada}
                      alCrearse={(enlace) => conversacion.marcarCreada(mensaje.id, indice, enlace)}
                    />
                  ) : (
                    <TarjetaDePropuesta
                      key={indice}
                      propuesta={propuesta}
                      creada={creada}
                      alCrearse={(enlace) => conversacion.marcarCreada(mensaje.id, indice, enlace)}
                    />
                  ),
                )}
              </Fragment>
            ))}
            {esperando && <p className="text-tenue">Pensando...</p>}
            <div ref={final} />
          </div>
        )}
        <div className={vacia ? 'flex flex-col gap-6' : 'sticky bottom-0 flex flex-col gap-2 bg-panel pt-3'}>
          {!vacia && aviso}
          {caja(vacia)}
          {vacia && aviso}
        </div>
        {vacia && <Sugerencias esAdmin={esAdmin} alUsar={usarSugerencia} />}
      </div>
    </Pagina>
  );
}
