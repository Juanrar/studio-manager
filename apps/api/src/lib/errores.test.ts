import { describe, expect, it } from 'vitest';
import {
  esErrorDeDominio,
  NoEncontradoError,
  ReglaDeNegocioError,
  SinPermisoError,
} from './errores.ts';

describe('errores de dominio', () => {
  it('NoEncontradoError usa el código 404 y conserva el mensaje', () => {
    const error = new NoEncontradoError('No existe el alumno 7');

    expect(error.codigoHttp).toBe(404);
    expect(error.message).toBe('No existe el alumno 7');
    expect(error.name).toBe('NoEncontradoError');
    expect(error).toBeInstanceOf(Error);
  });

  it('ReglaDeNegocioError usa el código 422', () => {
    expect(new ReglaDeNegocioError('El pack está vencido').codigoHttp).toBe(422);
  });

  it('SinPermisoError usa el código 403', () => {
    expect(new SinPermisoError('Necesitás rol admin').codigoHttp).toBe(403);
  });

  it('esErrorDeDominio distingue los errores propios de los demás', () => {
    expect(esErrorDeDominio(new ReglaDeNegocioError('x'))).toBe(true);
    expect(esErrorDeDominio(new Error('cualquier cosa'))).toBe(false);
    expect(esErrorDeDominio('no soy un error')).toBe(false);
  });
});
