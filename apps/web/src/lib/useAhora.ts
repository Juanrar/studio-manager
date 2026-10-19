import { useEffect, useState } from 'react';

// El instante de ahora, renovado cada minuto: lo que depende de la hora se recalcula sin recargar.
export function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(intervalo);
  }, []);
  return ahora;
}
