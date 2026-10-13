import { createContext, use, useRef, useState, type ReactNode } from 'react';
import type { PropuestaDelAsistente } from '@studio/shared';
import { useConversar } from './api.ts';

// `creada` aparece cuando el usuario tocó "Crear" y la API respondió bien.
export type PropuestaDelChat = { propuesta: PropuestaDelAsistente; creada?: { enlace: string } };

export type MensajeDelChat = { id: number; autor: 'usuario' | 'asistente'; texto: string; propuestas: PropuestaDelChat[] };

type Conversacion = {
  mensajes: MensajeDelChat[];
  borrador: string;
  cambiarBorrador: (texto: string) => void;
  enviar: () => void;
  esperando: boolean;
  error: Error | null;
  marcarCreada: (idDelMensaje: number, indice: number, enlace: string) => void;
  empezarDeNuevo: () => void;
};

const ContextoDeConversacion = createContext<Conversacion | null>(null);

// La conversación vive acá y no en la página: ir a otra pantalla no la borra, y una respuesta que llega
// mientras tanto no se pierde. Todo queda en memoria: recargar la página o cerrar sesión empieza de cero.
export function ProveedorDeConversacion({ children }: { children: ReactNode }) {
  const conversar = useConversar();
  const [historial, setHistorial] = useState<unknown[]>([]);
  const [mensajes, setMensajes] = useState<MensajeDelChat[]>([]);
  const [borrador, setBorrador] = useState('');
  const siguienteId = useRef(1);

  function enviar() {
    const mensaje = borrador.trim();
    if (mensaje === '' || conversar.isPending) return;
    const idDelUsuario = siguienteId.current++;
    setMensajes((actuales) => [...actuales, { id: idDelUsuario, autor: 'usuario', texto: mensaje, propuestas: [] }]);
    setBorrador('');
    conversar.mutate(
      { historial, mensaje },
      {
        onSuccess: (respuesta) => {
          setHistorial(respuesta.historial);
          setMensajes((actuales) => [
            ...actuales,
            {
              id: siguienteId.current++,
              autor: 'asistente',
              texto: respuesta.texto,
              propuestas: respuesta.propuestas.map((propuesta) => ({ propuesta })),
            },
          ]);
        },
        onError: () => {
          setMensajes((actuales) => actuales.filter((m) => m.id !== idDelUsuario));
          // Lo enviado vuelve al campo sin pisar lo que el usuario escribió mientras esperaba.
          setBorrador((actual) => (actual.trim() === '' ? mensaje : `${mensaje}\n${actual}`));
        },
      },
    );
  }

  function marcarCreada(idDelMensaje: number, indice: number, enlace: string) {
    setMensajes((actuales) =>
      actuales.map((m) =>
        m.id !== idDelMensaje
          ? m
          : { ...m, propuestas: m.propuestas.map((p, i) => (i === indice ? { ...p, creada: { enlace } } : p)) },
      ),
    );
  }

  // Lo escrito en el campo queda, para mandarlo en la conversación nueva. `reset` borra el error y descarta
  // una respuesta que todavía no llegó: sus callbacks no se llaman.
  function empezarDeNuevo() {
    conversar.reset();
    setHistorial([]);
    setMensajes([]);
  }

  const valor: Conversacion = {
    mensajes,
    borrador,
    cambiarBorrador: setBorrador,
    enviar,
    esperando: conversar.isPending,
    error: conversar.error,
    marcarCreada,
    empezarDeNuevo,
  };
  return <ContextoDeConversacion value={valor}>{children}</ContextoDeConversacion>;
}

export function useConversacion(): Conversacion {
  const conversacion = use(ContextoDeConversacion);
  if (conversacion === null) throw new Error('useConversacion necesita un ProveedorDeConversacion más arriba');
  return conversacion;
}
