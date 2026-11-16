import type {
  Alumno,
  AlumnoEnListado,
  Asistencia,
  Clase,
  FichaDeAlumno,
  Horario,
  Listado,
  ListadoDeAlumnos,
  Pack,
  Pago,
  Profesor,
  ProfesorEnListado,
  ResumenDeAlumno,
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

export function unAlumnoEnListado(datos: Partial<AlumnoEnListado> = {}): AlumnoEnListado {
  return { ...unAlumno(), estadoPack: 'sin_pack', pagoActual: null, ultimaClase: null, ...datos };
}

export function unaFichaDeAlumno(datos: Partial<FichaDeAlumno> = {}): FichaDeAlumno {
  return { ...unAlumno(), alta: '2025-03-10', estadoPack: 'sin_pack', pagoActual: null, ...datos };
}

const erik = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const julia = { id: 2, nombre: 'Julia', apellido: 'Paz' };
const mesVacio = (mes: string) => ({ mes, compras: [], tomadas: 0, vencidas: 0, clases: [] });

export function unResumenDeAlumno(datos: Partial<ResumenDeAlumno> = {}): ResumenDeAlumno {
  return {
    clasesTomadas: 6,
    clasesEnOchoSemanas: 4,
    ultimaClase: '2026-03-10',
    hoy: '2026-03-10',
    estiloMasTomado: 'Jazz',
    sueleVenir: { diasSemana: [2, 4], horaInicio: '19:00' },
    vencidasSinUsar: 3,
    totalPagado: 17800,
    profesores: [
      { ...erik, estilo: 'Salsa', clases: 5 },
      { ...julia, estilo: 'Jazz', clases: 1 },
    ],
    meses: [
      ...['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'].map(mesVacio),
      {
        mes: '2026-01',
        compras: [{ pack: 'Pack x4', veces: 1 }],
        tomadas: 1,
        vencidas: 3,
        clases: [{ fecha: '2026-01-13', estilo: 'Salsa', profesor: erik }],
      },
      {
        mes: '2026-02',
        compras: [{ pack: 'Clase suelta', veces: 2 }],
        tomadas: 1,
        vencidas: 0,
        clases: [{ fecha: '2026-02-26', estilo: 'Salsa', profesor: erik }],
      },
      {
        mes: '2026-03',
        compras: [{ pack: 'Pack x8', veces: 1 }],
        tomadas: 3,
        vencidas: 0,
        clases: [
          { fecha: '2026-03-10', estilo: 'Jazz', profesor: julia },
          { fecha: '2026-03-05', estilo: 'Jazz', profesor: erik },
          { fecha: '2026-03-03', estilo: 'Jazz', profesor: erik },
        ],
      },
    ],
    ...datos,
  };
}

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

export function unProfesorEnListado(datos: Partial<ProfesorEnListado> = {}): ProfesorEnListado {
  return { ...unProfesor(), clasesPorSemana: 0, diasConClase: [], ...datos };
}

export function unHorario(datos: Partial<Horario> = {}): Horario {
  return {
    id: 1,
    estilo: 'Salsa',
    nivel: null,
    diaSemana: 1,
    horaInicio: '18:00',
    horaFin: '19:30',
    profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
    activo: true,
    ...datos,
  };
}

export function unaClase(datos: Partial<Clase> = {}): Clase {
  const erik = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
  return {
    id: 50,
    horarioId: 2,
    fecha: '2026-03-10',
    horaInicio: '19:00',
    horaFin: '20:30',
    estilo: 'Hip-Hop',
    nivel: 'Inicial',
    estado: 'programada',
    profesor: erik,
    profesorTitular: erik,
    tieneCambios: false,
    asistentes: 0,
    ...datos,
  };
}

export function unaAsistencia(datos: Partial<Asistencia> = {}): Asistencia {
  return {
    id: 900,
    claseId: 50,
    alumno: { id: 10, nombre: 'Martina', apellido: 'García' },
    pagoId: 100,
    pack: 'Pack x8',
    valorClase: 1200,
    porcentajeBp: 5000,
    ...datos,
  };
}
