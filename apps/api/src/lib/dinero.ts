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
