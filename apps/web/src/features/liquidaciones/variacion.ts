export function variacion(actual: number, anterior: number): string {
  if (anterior === 0) return '—';
  const porcentaje = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  if (porcentaje === 0) return '0%';
  return `${porcentaje > 0 ? '+' : '-'}${Math.abs(porcentaje)}%`;
}
