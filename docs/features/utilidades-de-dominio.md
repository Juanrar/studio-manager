# Utilidades de dinero, fechas y errores

**Estado:** en curso  
**Depende de:** monorepo-y-api  
**Listo cuando:** `pnpm --filter @studio/api test` pasa, incluidos los tests de dinero, fechas y errores.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez, de arriba hacia abajo, y marcá cada checkbox recién cuando su comando de verificación pasa.

**Objetivo:** concentrar en módulos puros todas las cuentas con dinero, todos los cálculos de fechas y los errores de dominio, para que ningún módulo de negocio invente su propio redondeo ni dependa de la zona horaria del servidor.

**Arquitectura:** `lib/dinero.ts` y `lib/fechas.ts` son funciones puras, sin acceso a base ni a HTTP. Se prueban con tests unitarios rápidos, sin contenedores. Todos los módulos de negocio las usan en lugar de escribir las cuentas a mano.

**Stack:** TypeScript, Vitest, `Intl.DateTimeFormat` de Node para la zona horaria (sin librerías externas de fechas).

**Spec:** [Arquitectura del backend](../arquitectura%20backend.md), sección "Dinero y fechas", y [Estructura de base de datos](../estructura%20de%20base%20de%20datos.md), sección "Redondeo".

## Restricciones globales

- Node >= 22, pnpm >= 9, TypeScript `strict`, ESM.
- El dinero se maneja siempre como pesos enteros. No hay centavos en el sistema y nunca se usan decimales.
- Los porcentajes se manejan como entero en puntos básicos: 10000 es el 100%.
- El redondeo es siempre al entero más cercano, con el medio para arriba (`Math.round`).
- Las fechas del negocio (`sesion.fecha`, `pago.vence_el`) son días, no instantes. Se representan como string `YYYY-MM-DD`.
- La zona horaria del estudio es `America/Argentina/Buenos_Aires` y viene de `config.tzEstudio`.
- Ninguna función de estos módulos toca la base de datos, el sistema de archivos ni HTTP.

---

### Tarea 1: Módulo de dinero

**Archivos:**
- Crear: `apps/api/src/lib/dinero.ts`
- Test: `apps/api/src/lib/dinero.test.ts`

**Interfaces:**
- Consume: nada.
- Produce, exportado desde `src/lib/dinero.ts`:
  - `type Pesos = number` — entero, sin centavos.
  - `verificarPesos(valor: number): Pesos` — lanza si no es un entero válido.
  - `dividirEnPartes(total: Pesos, partes: number): Pesos` — valor de una clase dentro de un pack.
  - `aplicarPorcentaje(monto: Pesos, porcentajeBp: number): Pesos` — parte del profesor.
  - `formatearPesos(monto: Pesos): string` — para logs y reportes del backend.

- [x] **Paso 1: Escribir los tests que fallan**

`apps/api/src/lib/dinero.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aplicarPorcentaje, dividirEnPartes, formatearPesos, verificarPesos } from './dinero.ts';

describe('verificarPesos', () => {
  it('devuelve el valor cuando es un entero', () => {
    expect(verificarPesos(8000)).toBe(8000);
    expect(verificarPesos(0)).toBe(0);
  });

  it('rechaza montos con decimales', () => {
    expect(() => verificarPesos(19.99)).toThrow();
  });

  it('rechaza valores que no son finitos', () => {
    expect(() => verificarPesos(Number.NaN)).toThrow();
    expect(() => verificarPesos(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('dividirEnPartes', () => {
  it('divide un pack en partes exactas', () => {
    expect(dividirEnPartes(9600, 8)).toBe(1200);
  });

  it('redondea al peso más cercano cuando no es exacto', () => {
    // 5200 dividido en 3 da 1733,33 y redondea para abajo
    expect(dividirEnPartes(5200, 3)).toBe(1733);
    // 1001 dividido en 2 da 500,5 y redondea para arriba
    expect(dividirEnPartes(1001, 2)).toBe(501);
  });

  it('rechaza una cantidad de partes menor o igual a cero', () => {
    expect(() => dividirEnPartes(9600, 0)).toThrow();
    expect(() => dividirEnPartes(9600, -2)).toThrow();
  });

  it('rechaza un total con decimales', () => {
    expect(() => dividirEnPartes(9600.5, 8)).toThrow();
  });
});

describe('aplicarPorcentaje', () => {
  it('calcula el 50 por ciento', () => {
    expect(aplicarPorcentaje(1200, 5000)).toBe(600);
  });

  it('calcula el 100 por ciento', () => {
    expect(aplicarPorcentaje(1200, 10_000)).toBe(1200);
  });

  it('acepta porcentajes con decimales expresados en puntos básicos', () => {
    // 52,5% de 1200 es 630
    expect(aplicarPorcentaje(1200, 5250)).toBe(630);
  });

  it('redondea al peso más cercano', () => {
    // 60% de 1733 es 1039,8 y redondea a 1040
    expect(aplicarPorcentaje(1733, 6000)).toBe(1040);
    // 33,33% de 1 peso redondea a 0
    expect(aplicarPorcentaje(1, 3333)).toBe(0);
  });

  it('rechaza porcentajes fuera del rango 1 a 10000', () => {
    expect(() => aplicarPorcentaje(1200, 0)).toThrow();
    expect(() => aplicarPorcentaje(1200, 10_001)).toThrow();
  });
});

describe('formatearPesos', () => {
  it('muestra el monto sin decimales y con separador de miles', () => {
    expect(formatearPesos(9600)).toBe('$9.600');
    expect(formatearPesos(1500)).toBe('$1.500');
  });
});
```

- [x] **Paso 2: Correr los tests y verificar que fallan**

Correr: `pnpm --filter @studio/api test src/lib/dinero.test.ts`
Esperado: FALLA con "Cannot find module './dinero.ts'".

- [x] **Paso 3: Implementar el módulo**

`apps/api/src/lib/dinero.ts`:

```ts
export type Pesos = number;

const BP_TOTAL = 10_000;

export function verificarPesos(valor: number): Pesos {
  if (!Number.isSafeInteger(valor)) {
    throw new Error(`Monto inválido: ${valor}. Los montos son pesos enteros, sin centavos`);
  }
  return valor;
}

export function dividirEnPartes(total: Pesos, partes: number): Pesos {
  verificarPesos(total);
  if (!Number.isInteger(partes) || partes <= 0) {
    throw new Error(`Cantidad de partes inválida: ${partes}`);
  }
  return Math.round(total / partes);
}

export function aplicarPorcentaje(monto: Pesos, porcentajeBp: number): Pesos {
  verificarPesos(monto);
  if (!Number.isInteger(porcentajeBp) || porcentajeBp <= 0 || porcentajeBp > BP_TOTAL) {
    throw new Error(`Porcentaje en puntos básicos inválido: ${porcentajeBp}`);
  }
  return Math.round((monto * porcentajeBp) / BP_TOTAL);
}

const formateador = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatearPesos(monto: Pesos): string {
  verificarPesos(monto);
  return formateador.format(monto).replace(/\s/g, '');
}
```

- [x] **Paso 4: Correr los tests y verificar que pasan**

Correr: `pnpm --filter @studio/api test src/lib/dinero.test.ts`
Esperado: todos PASAN.

Si `formatearPesos` falla, revisar el separador: `Intl` con `es-AR` deja un espacio duro entre el símbolo y el número, y por eso el `replace`. Ajustar hasta que la salida sea exactamente `$9.600`.

- [x] **Paso 5: Commit**

```bash
git add apps/api/src/lib/dinero.ts apps/api/src/lib/dinero.test.ts
git commit -m "feat(lib): agregar utilidades de dinero en pesos enteros"
```

---

### Tarea 2: Módulo de fechas

**Archivos:**
- Crear: `apps/api/src/lib/fechas.ts`
- Test: `apps/api/src/lib/fechas.test.ts`

**Interfaces:**
- Consume: nada. La zona horaria se pasa por parámetro, con `America/Argentina/Buenos_Aires` como valor por defecto, así las funciones siguen siendo puras y testeables.
- Produce, exportado desde `src/lib/fechas.ts`:
  - `type FechaDia = string` — formato `YYYY-MM-DD`.
  - `hoyEnEstudio(ahora?: Date, tz?: string): FechaDia`
  - `diaSemanaIso(fecha: FechaDia): number` — 1 es lunes, 7 es domingo.
  - `sumarUnMes(fecha: FechaDia): FechaDia` — vencimiento de un pago.
  - `primerDiaDelMes(fecha: FechaDia): FechaDia` — periodo de una liquidación.
  - `esFechaDia(valor: string): boolean`

`sumarUnMes` tiene que resolver el caso de fin de mes: el 31 de enero más un mes es el 28 o 29 de febrero, no el 3 de marzo.

- [ ] **Paso 1: Escribir los tests que fallan**

`apps/api/src/lib/fechas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  diaSemanaIso,
  esFechaDia,
  hoyEnEstudio,
  primerDiaDelMes,
  sumarUnMes,
} from './fechas.ts';

describe('hoyEnEstudio', () => {
  it('devuelve el día en la zona del estudio, no en UTC', () => {
    // 2026-03-10T02:00:00Z son las 23:00 del 9 de marzo en Buenos Aires
    const instante = new Date('2026-03-10T02:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-09');
  });

  it('devuelve el mismo día cuando el instante ya está dentro del día local', () => {
    const instante = new Date('2026-03-10T15:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-10');
  });
});

describe('diaSemanaIso', () => {
  it('devuelve 1 para un lunes', () => {
    expect(diaSemanaIso('2026-03-09')).toBe(1);
  });

  it('devuelve 7 para un domingo', () => {
    expect(diaSemanaIso('2026-03-15')).toBe(7);
  });
});

describe('sumarUnMes', () => {
  it('suma un mes en un caso simple', () => {
    expect(sumarUnMes('2026-03-10')).toBe('2026-04-10');
  });

  it('recorta al último día cuando el mes siguiente es más corto', () => {
    expect(sumarUnMes('2026-01-31')).toBe('2026-02-28');
  });

  it('respeta el año bisiesto', () => {
    expect(sumarUnMes('2028-01-31')).toBe('2028-02-29');
  });

  it('cruza el cambio de año', () => {
    expect(sumarUnMes('2026-12-15')).toBe('2027-01-15');
  });
});

describe('primerDiaDelMes', () => {
  it('devuelve el día 1 del mes de la fecha', () => {
    expect(primerDiaDelMes('2026-03-27')).toBe('2026-03-01');
  });
});

describe('esFechaDia', () => {
  it('acepta un formato válido', () => {
    expect(esFechaDia('2026-03-09')).toBe(true);
  });

  it('rechaza formatos inválidos y fechas que no existen', () => {
    expect(esFechaDia('09-03-2026')).toBe(false);
    expect(esFechaDia('2026-13-01')).toBe(false);
    expect(esFechaDia('2026-02-30')).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `pnpm --filter @studio/api test src/lib/fechas.test.ts`
Esperado: FALLA con "Cannot find module './fechas.ts'".

- [ ] **Paso 3: Implementar el módulo**

`apps/api/src/lib/fechas.ts`:

```ts
export type FechaDia = string;

export const TZ_ESTUDIO_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

const PATRON = /^\d{4}-\d{2}-\d{2}$/;

export function hoyEnEstudio(ahora: Date = new Date(), tz: string = TZ_ESTUDIO_POR_DEFECTO): FechaDia {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formateador.format(ahora);
}

export function esFechaDia(valor: string): boolean {
  if (!PATRON.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

export function diaSemanaIso(fecha: FechaDia): number {
  const dia = aUtc(fecha).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function sumarUnMes(fecha: FechaDia): FechaDia {
  const [anio, mes, dia] = partes(fecha);
  const anioDestino = mes === 12 ? anio + 1 : anio;
  const mesDestino = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return formatear(anioDestino, mesDestino, diaDestino);
}

export function primerDiaDelMes(fecha: FechaDia): FechaDia {
  const [anio, mes] = partes(fecha);
  return formatear(anio, mes, 1);
}

function partes(fecha: FechaDia): [number, number, number] {
  if (!esFechaDia(fecha)) {
    throw new Error(`Fecha inválida: ${fecha}. Se espera YYYY-MM-DD`);
  }
  return fecha.split('-').map(Number) as [number, number, number];
}

function aUtc(fecha: FechaDia): Date {
  const [anio, mes, dia] = partes(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function formatear(anio: number, mes: number, dia: number): FechaDia {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `pnpm --filter @studio/api test src/lib/fechas.test.ts`
Esperado: todos PASAN.

- [ ] **Paso 5: Commit**

```bash
git add apps/api/src/lib/fechas.ts apps/api/src/lib/fechas.test.ts
git commit -m "feat(lib): agregar utilidades de fechas con la zona del estudio"
```

---

### Tarea 3: Errores de dominio

**Archivos:**
- Crear: `apps/api/src/lib/errores.ts`
- Test: `apps/api/src/lib/errores.test.ts`

**Interfaces:**
- Consume: nada.
- Produce, exportado desde `src/lib/errores.ts`:
  - `class ErrorDeDominio extends Error` con la propiedad `codigoHttp: number`.
  - `class NoEncontradoError extends ErrorDeDominio` con `codigoHttp = 404`.
  - `class ReglaDeNegocioError extends ErrorDeDominio` con `codigoHttp = 422`.
  - `class SinPermisoError extends ErrorDeDominio` con `codigoHttp = 403`.
  - `esErrorDeDominio(error: unknown): error is ErrorDeDominio`

El plugin de errores de Fastify, que se crea en la feature `autenticacion`, usa `esErrorDeDominio` para traducir estos errores a respuestas HTTP.

- [ ] **Paso 1: Escribir los tests que fallan**

`apps/api/src/lib/errores.test.ts`:

```ts
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
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `pnpm --filter @studio/api test src/lib/errores.test.ts`
Esperado: FALLA con "Cannot find module './errores.ts'".

- [ ] **Paso 3: Implementar el módulo**

`apps/api/src/lib/errores.ts`:

```ts
export abstract class ErrorDeDominio extends Error {
  abstract readonly codigoHttp: number;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class NoEncontradoError extends ErrorDeDominio {
  readonly codigoHttp = 404;
}

export class ReglaDeNegocioError extends ErrorDeDominio {
  readonly codigoHttp = 422;
}

export class SinPermisoError extends ErrorDeDominio {
  readonly codigoHttp = 403;
}

export function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio;
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `pnpm --filter @studio/api test src/lib/errores.test.ts`
Esperado: los 4 tests PASAN.

- [ ] **Paso 5: Commit**

```bash
git add apps/api/src/lib/errores.ts apps/api/src/lib/errores.test.ts
git commit -m "feat(lib): agregar errores de dominio con su código HTTP"
```

---

## Verificación final del plan

- [ ] `pnpm --filter @studio/api test` pasa, incluidos los tests de los planes anteriores.
- [ ] `pnpm --filter @studio/api typecheck` pasa.
- [ ] Ninguna función de `src/lib/` importa nada de `src/db/` ni de `src/modules/`.
- [ ] `git status` está limpio.
