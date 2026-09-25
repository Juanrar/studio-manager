import { useEffect, useState } from 'react';

// Devuelve el valor recién cuando dejó de cambiar durante `ms`. Sirve para no pedir a la API en cada tecla.
export function useDemorado<T>(valor: T, ms = 250): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return demorado;
}
