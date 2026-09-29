// Constructores de respuestas de la API para los handlers de MSW.
// Devuelven la misma forma que la API real; el test pisa solo lo que le importa.
import type {
  Alumno,
  AlumnoEnListado,
  Asistencia,
  FichaDeAlumno,
  Listado,
  ListadoDeAlumnos,
  Pack,
  Pago,
  Profesor,
} from '@studio/shared';

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

// Una fila de GET /api/alumnos. Por defecto, sin pack y sin clases.
export function unAlumnoEnListado(datos: Partial<AlumnoEnListado> = {}): AlumnoEnListado {
  return { ...unAlumno(), estadoPack: 'sin_pack', pagoActual: null, ultimaClase: null, ...datos };
}

// GET /api/alumnos/:id. Por defecto, sin pack.
export function unaFichaDeAlumno(datos: Partial<FichaDeAlumno> = {}): FichaDeAlumno {
  return { ...unAlumno(), alta: '2025-03-10', estadoPack: 'sin_pack', pagoActual: null, ...datos };
}

// El martes 10 de marzo de 2026, como el reloj de los tests de la API.
export function unListadoDeAlumnos(
  items: AlumnoEnListado[],
  datos: Partial<ListadoDeAlumnos> = {},
): ListadoDeAlumnos {
  return { ...unListado(items), vigentes: 0, hoy: '2026-03-10', ...datos };
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

export function unProfesor(datos: Partial<Profesor> = {}): Profesor {
  return {
    id: 1,
    nombre: 'Erik',
    apellido: 'Zapata',
    dni: null,
    email: null,
    telefono: null,
    aliasCbu: null,
    activo: true,
    porcentajeVigenteBp: 5000,
    ...datos,
  };
}

export function unaAsistencia(datos: Partial<Asistencia> = {}): Asistencia {
  return {
    id: 900,
    sesionId: 50,
    alumno: { id: 10, nombre: 'Martina', apellido: 'García' },
    pagoId: 100,
    pack: 'Pack x8',
    valorClase: 1200,
    porcentajeBp: 5000,
    ...datos,
  };
}
