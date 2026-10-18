import { Icono } from '../../components/ui/index.tsx';
import type { MensajeDelChat } from './ConversacionDelAsistente.tsx';
import { DEGRADE } from './estilo.ts';
import { TarjetaDeAltaDeProfesor } from './TarjetaDeAltaDeProfesor.tsx';
import { TarjetaDePropuesta } from './TarjetaDePropuesta.tsx';

function AvatarDelAsistente() {
  return (
    <span className="grid size-7 flex-none place-items-center rounded-full text-white" style={DEGRADE}>
      <Icono nombre="destellos" className="size-3.5" />
    </span>
  );
}

function Pensando() {
  return (
    <div className="flex items-center gap-3 self-start">
      <AvatarDelAsistente />
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((punto) => (
          <span
            key={punto}
            className="size-1.5 animate-bounce rounded-full bg-apagado motion-reduce:animate-none"
            style={{ animationDelay: `${punto * 150}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">Pensando...</span>
    </div>
  );
}

export function ListaDeMensajes({
  mensajes,
  esperando,
  alCrearse,
}: {
  mensajes: MensajeDelChat[];
  esperando: boolean;
  alCrearse: (idDelMensaje: number, indice: number, enlace: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 py-6 text-[14px]">
      {mensajes.map((mensaje) =>
        mensaje.autor === 'usuario' ? (
          <div
            key={mensaje.id}
            className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-resalte px-3.5 py-2 leading-6 break-words whitespace-pre-wrap"
          >
            {mensaje.texto}
          </div>
        ) : (
          <div key={mensaje.id} className="flex gap-3 self-stretch">
            <AvatarDelAsistente />
            <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
              <p className="leading-6 break-words whitespace-pre-wrap">{mensaje.texto}</p>
              {mensaje.propuestas.map(({ propuesta, creada }, indice) =>
                propuesta.tipo === 'altaDeProfesor' ? (
                  <TarjetaDeAltaDeProfesor
                    key={indice}
                    propuesta={propuesta}
                    creada={creada}
                    alCrearse={(enlace) => alCrearse(mensaje.id, indice, enlace)}
                  />
                ) : (
                  <TarjetaDePropuesta
                    key={indice}
                    propuesta={propuesta}
                    creada={creada}
                    alCrearse={(enlace) => alCrearse(mensaje.id, indice, enlace)}
                  />
                ),
              )}
            </div>
          </div>
        ),
      )}
      {esperando && <Pensando />}
    </div>
  );
}
