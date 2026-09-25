export abstract class ErrorDeDominio extends Error {
  abstract readonly codigoHttp: number;

  // `codigo` es para el frontend: decide con él, no comparando el texto del mensaje.
  constructor(
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class NoEncontradoError extends ErrorDeDominio {
  override readonly codigoHttp = 404;
}

export class NoAutenticadoError extends ErrorDeDominio {
  override readonly codigoHttp = 401;
}

export class ReglaDeNegocioError extends ErrorDeDominio {
  override readonly codigoHttp = 422;
}

export class SinPermisoError extends ErrorDeDominio {
  override readonly codigoHttp = 403;
}

export function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio;
}
