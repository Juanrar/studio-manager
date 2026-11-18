import { describe, expect, it } from 'vitest';
import type { TableroDelProfesor } from '@studio/shared';
import { detalleACsv, nombreDelCsv } from '../csv.ts';

describe('detalleACsv', () => {
  it('escribe cada clase con sus alumnos debajo y cierra con el total de las partes', () => {
    const csv = detalleACsv([
      {
        claseId: 1,
        fecha: '2026-03-03',
        estilo: 'Hip-Hop',
        asistentes: 2,
        monto: 1400,
        alumnos: [
          { alumnoId: 5, nombre: 'Martina', apellido: 'García', pack: 'Pack x4', valorClase: 1300, parte: 700 },
          { alumnoId: 6, nombre: 'Joaquín', apellido: 'Pérez', pack: 'Clase suelta', valorClase: 1500, parte: 700 },
        ],
      },
      {
        claseId: 2,
        fecha: '2026-03-10',
        estilo: 'Hip-Hop; avanzado',
        asistentes: 2,
        monto: 1300,
        alumnos: [
          { alumnoId: 5, nombre: 'Martina', apellido: 'García', pack: 'Pack x4', valorClase: 1300, parte: 650 },
          { alumnoId: 7, nombre: 'Lucía', apellido: 'Gómez', pack: 'Pack x8', valorClase: 1300, parte: 650 },
        ],
      },
    ]);

    expect(csv).toBe(
      [
        'Fecha;Clase;Alumno;Pack;Valor de la clase;Parte del profesor',
        '03/03/2026;Hip-Hop;2 alumnos;;;1400',
        ';;Martina García;Pack x4;1300;700',
        ';;Joaquín Pérez;Clase suelta;1500;700',
        '10/03/2026;"Hip-Hop; avanzado";2 alumnos;;;1300',
        ';;Martina García;Pack x4;1300;650',
        ';;Lucía Gómez;Pack x8;1300;650',
        'Total;;;;;2700',
      ].join('\r\n'),
    );
  });

  it('una clase de un alumno dice "1 alumno"', () => {
    const csv = detalleACsv([
      {
        claseId: 1,
        fecha: '2026-03-03',
        estilo: 'Salsa',
        asistentes: 1,
        monto: 650,
        alumnos: [{ alumnoId: 5, nombre: 'Martina', apellido: 'García', pack: 'Pack x4', valorClase: 1300, parte: 650 }],
      },
    ]);

    expect(csv).toBe(
      [
        'Fecha;Clase;Alumno;Pack;Valor de la clase;Parte del profesor',
        '03/03/2026;Salsa;1 alumno;;;650',
        ';;Martina García;Pack x4;1300;650',
        'Total;;;;;650',
      ].join('\r\n'),
    );
  });
});

describe('nombreDelCsv', () => {
  it('arma el nombre con apellido, nombre y período en minúsculas', () => {
    const ficha = {
      periodo: '2026-03',
      profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata', aliasCbu: null, porcentajeBp: null },
    } as TableroDelProfesor;

    expect(nombreDelCsv(ficha)).toBe('sueldo-zapata-erik-2026-03.csv');
  });
});
