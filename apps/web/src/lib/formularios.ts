import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorDeApi, mensajeDeError } from './api.ts';

// Lleva el error de la API al formulario: los `detalles` de un 400 van a su campo
// y el mensaje general queda en `root`, que el formulario muestra como aviso.
export function mostrarErrorDeApi<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): void {
  if (error instanceof ErrorDeApi) {
    for (const detalle of error.detalles) {
      setError(detalle.campo as Path<T>, { message: detalle.mensaje });
    }
  }
  setError('root', { message: mensajeDeError(error) });
}
