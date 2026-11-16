import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorDeApi, mensajeDeError } from './api.ts';

export function mostrarErrorDeApi<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): void {
  if (error instanceof ErrorDeApi) {
    for (const detalle of error.detalles) {
      setError(detalle.campo as Path<T>, { message: detalle.mensaje });
    }
  }
  setError('root', { message: mensajeDeError(error) });
}
