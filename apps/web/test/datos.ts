// Constructores de respuestas de la API para los handlers de MSW.
// Devuelven la misma forma que la API real; el test pisa solo lo que le importa.
import type { Alumno, Listado, Pack, Pago } from '@studio/shared';

export function unAlumno(datos: Partial<Alumno> = {}): Alumno {
  return {
    id: 10,
    nombre: 'Martina',
    apellido: 'García',
    dni: '38555666',
    email: null,
    telefono: '11 5555-0000',
    fechaNacimiento: null,
    contactoEmergencia: null,
    notas: null,
    activo: true,
    ...datos,
  };
}

export function unListado<T>(items: T[], datos: Partial<Listado<T>> = {}): Listado<T> {
  return { items, total: items.length, pagina: 1, porPagina: 20, ...datos };
}

export function unPack(datos: Partial<Pack> = {}): Pack {
  return { id: 3, nombre: 'Pack x8', cantidadClases: 8, precio: 9600, activo: true, ...datos };
}

export function unPago(datos: Partial<Pago> = {}): Pago {
  return {
    id: 100,
    alumnoId: 10,
    pack: { id: 3, nombre: 'Pack x8' },
    cantidadClases: 8,
    clasesUsadas: 3,
    clasesRestantes: 5,
    monto: 9600,
    medio: 'efectivo',
    fecha: '2026-03-10T15:00:00.000Z',
    venceEl: '2026-04-10',
    vencido: false,
    anulado: false,
    motivoAnulacion: null,
    registradoPor: { id: 2, nombre: 'Rita Recepción' },
    ...datos,
  };
}
