export type SinIndefinidos<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

// Para los PATCH: deja solo los campos que vinieron en el cuerpo.
// Un campo ausente no se toca; un campo en null sí se guarda como null.
export function sinIndefinidos<T extends object>(objeto: T): SinIndefinidos<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  ) as SinIndefinidos<T>;
}
