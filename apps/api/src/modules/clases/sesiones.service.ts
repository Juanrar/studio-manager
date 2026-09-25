import type { ActualizarSesionInput, AgendaDelDia, Sesion, SesionDetalle } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { diaSemanaIso, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { verificarMesAbierto } from '../liquidaciones/liquidaciones.service.ts';
import { porcentajeVigente, verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as clasesRepo from './clases.repository.ts';
import * as repo from './sesiones.repository.ts';

export async function agendaDelDia(fecha: FechaDia): Promise<AgendaDelDia> {
  const [clases, sesiones] = await Promise.all([
    clasesRepo.listarDelDia(db, diaSemanaIso(fecha)),
    repo.listarDeFecha(db, fecha),
  ]);
  const sesionPorClase = new Map(sesiones.map((s) => [s.claseId, s]));

  return {
    fecha,
    items: clases.map((clase) => ({
      claseId: clase.id,
      estilo: clase.estilo,
      nivel: clase.nivel,
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      profesorTitular: clase.profesor,
      sesion: sesionPorClase.get(clase.id) ?? null,
    })),
  };
}

// Abrir dos veces la misma sesión devuelve la existente: un doble clic no es un error.
export async function abrirSesion(claseId: number, fecha: FechaDia): Promise<{ sesion: Sesion; creada: boolean }> {
  const clase = await clasesRepo.buscarPorId(db, claseId);
  if (clase === null) throw new NoEncontradoError(`No existe la clase ${claseId}`);
  if (!clase.activa) throw new ReglaDeNegocioError(`La clase ${clase.estilo} está dada de baja`);
  if (diaSemanaIso(fecha) !== clase.diaSemana) {
    throw new ReglaDeNegocioError(`La clase ${clase.estilo} no se dicta el ${fecha}`);
  }

  const existente = await repo.buscarPorClaseYFecha(db, claseId, fecha);
  if (existente !== null) return { sesion: existente, creada: false };

  const id = await repo.insertarSiNoExiste(db, { claseId, fecha, profesorId: clase.profesor.id });
  const sesion = await repo.buscarPorClaseYFecha(db, claseId, fecha);
  return { sesion: sesion!, creada: id !== null };
}

export async function actualizarSesion(id: number, datos: ActualizarSesionInput): Promise<Sesion> {
  await db.transaction(async (tx) => {
    const actual = await bloquearSesion(tx, id);

    if (datos.estado === 'cancelada' && (await repo.contarAsistencias(tx, id)) > 0) {
      throw new ReglaDeNegocioError('La clase tiene asistencias registradas. Borralas antes de cancelarla');
    }

    if (datos.profesorId !== undefined && datos.profesorId !== actual.profesorId) {
      // La suplencia mueve el sueldo de esta clase de un profesor a otro: los dos meses tienen que estar abiertos.
      await verificarMesAbierto(tx, actual.profesorId, actual.fecha);
      await verificarMesAbierto(tx, datos.profesorId, actual.fecha);
      await verificarProfesorActivo(tx, datos.profesorId);
      const porcentajeBp = await porcentajeVigente(tx, datos.profesorId, actual.fecha);
      await repo.actualizarPorcentajeDeAsistencias(tx, id, porcentajeBp);
    }

    await repo.actualizar(tx, id, sinIndefinidos(datos));
  });
  return obtenerSesion(id);
}

export async function obtenerSesion(id: number): Promise<Sesion> {
  const encontrada = await repo.buscarPorId(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}

// La usa asistencias dentro de su transacción.
export async function bloquearSesion(ej: Ejecutor, id: number): Promise<repo.SesionBloqueada> {
  const encontrada = await repo.bloquear(ej, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}

export async function obtenerDetalleDeSesion(id: number): Promise<SesionDetalle> {
  const encontrada = await repo.buscarDetalle(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}
