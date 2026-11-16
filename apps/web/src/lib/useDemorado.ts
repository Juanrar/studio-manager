import { useEffect, useState } from 'react';

export function useDemorado<T>(valor: T, ms = 250): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return demorado;
}
