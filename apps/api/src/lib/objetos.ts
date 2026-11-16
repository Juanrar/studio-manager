export type SinIndefinidos<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

export function sinIndefinidos<T extends object>(objeto: T): SinIndefinidos<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  ) as SinIndefinidos<T>;
}
