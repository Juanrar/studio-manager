import type { DetalleSesion } from '@studio/shared';
import { formatearFecha } from '../../lib/formato.ts';

// Excel en español usa la coma como separador decimal: el CSV va separado por punto y coma.
const SEPARADOR = ';';

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

function fila(valores: (string | number)[]): string {
  return valores.map(celda).join(SEPARADOR);
}

export function detalleACsv(items: DetalleSesion[]): string {
  const asistentes = items.reduce((suma, item) => suma + item.asistentes, 0);
  const total = items.reduce((suma, item) => suma + item.monto, 0);
  return [
    fila(['Fecha', 'Clase', 'Asistentes', 'Monto']),
    ...items.map((item) => fila([formatearFecha(item.fecha), item.estilo, item.asistentes, item.monto])),
    fila(['Total', '', asistentes, total]),
  ].join('\r\n');
}

// El BOM hace que Excel lea el archivo como UTF-8 y muestre bien las tildes.
export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const archivo = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
