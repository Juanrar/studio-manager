import { useEffect, useRef } from 'react';
import { CONVERSACION_LARGA } from '@studio/shared';
import { Aviso, Boton, Pagina } from '../../components/ui/index.tsx';
import { ErrorDeApi, mensajeDeError } from '../../lib/api.ts';
import { useSesion } from '../auth/api.ts';
import { Saludo, Sugerencias } from './Bienvenida.tsx';
import { CajaDeMensaje } from './CajaDeMensaje.tsx';
import { useConversacion } from './ConversacionDelAsistente.tsx';
import { ListaDeMensajes } from './ListaDeMensajes.tsx';

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

  function enviar() {
    conversacion.enviar();
    // El clic en Enviar deja el foco en el botón, que se deshabilita.
    campo.current?.focus();
  }

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
      alEnviar={enviar}
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
      {/* El resplandor queda siempre montado, fuera del contenido que cambia, para poder desvanecerse. */}
      <div className="relative flex min-h-full flex-col">
        <Resplandor visible={vacia} />
        {/* La caja ocupa siempre el mismo lugar del árbol: así el campo no se vuelve a montar ni pierde el foco al empezar. */}
        <div
          className={`relative mx-auto flex w-full max-w-2xl flex-1 flex-col ${vacia ? 'justify-center gap-6 py-10' : ''}`}
        >
          {vacia ? (
            <Saludo nombre={nombre} />
          ) : (
            <div className="flex flex-1 flex-col justify-end">
              <ListaDeMensajes mensajes={mensajes} esperando={esperando} alCrearse={conversacion.marcarCreada} />
            </div>
          )}
          <div className={vacia ? 'flex flex-col gap-6' : 'sticky bottom-0 flex flex-col gap-2 bg-panel pt-3'}>
            {!vacia && aviso}
            {caja(vacia)}
            {vacia && aviso}
          </div>
          {vacia && <Sugerencias esAdmin={esAdmin} alUsar={usarSugerencia} />}
          {/* Después de la caja fija: si no, al bajar el último mensaje queda detrás de ella. */}
          {!vacia && <div ref={final} />}
        </div>
      </div>
    </Pagina>
  );
}

function Resplandor({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-resplandor
      className={`pointer-events-none absolute inset-0 flex justify-center transition-opacity duration-700 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className="mt-[8%] h-80 w-[640px] max-w-full rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklab, var(--color-acento) 38%, transparent), transparent)',
        }}
      />
    </div>
  );
}
