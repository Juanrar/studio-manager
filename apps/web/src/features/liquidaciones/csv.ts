import type { ClaseDelMes, TableroDelProfesor } from '@studio/shared';
import { formatearFecha } from '../../lib/formato.ts';

const SEPARADOR = ';';

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

function fila(valores: (string | number)[]): string {
  return valores.map(celda).join(SEPARADOR);
}

export function cantidadDeAlumnos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'alumno' : 'alumnos'}`;
}

export function detalleACsv(clases: ClaseDelMes[]): string {
  const total = clases.reduce((suma, clase) => suma + clase.monto, 0);
  return [
    fila(['Fecha', 'Clase', 'Alumno', 'Pack', 'Valor de la clase', 'Parte del profesor']),
    ...clases.flatMap((clase) => [
      fila([formatearFecha(clase.fecha), clase.estilo, cantidadDeAlumnos(clase.asistentes), '', '', clase.monto]),
      ...clase.alumnos.map((alumno) =>
        fila(['', '', `${alumno.nombre} ${alumno.apellido}`, alumno.pack, alumno.valorClase, alumno.parte]),
      ),
    ]),
    fila(['Total', '', '', '', '', total]),
  ].join('\r\n');
}

export function nombreDelCsv(ficha: TableroDelProfesor): string {
  const { profesor, periodo } = ficha;
  return `sueldo-${profesor.apellido}-${profesor.nombre}-${periodo}.csv`.toLowerCase();
}

export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const archivo = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
