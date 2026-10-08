import type { ActualizarHorarioInput, CrearHorarioInput, Horario } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { lunesDe, semanasDelHorizonte, sumarDias, type FechaDia } from '../../lib/fechas.ts';
import {
  actualizarHorario,
  crearHorario,
  horariosParaGenerar,
  obtenerHorario,
  reactivarHorario,
} from '../horarios/horarios.service.ts';
import { porcentajeVigente } from '../profesores/profesores.service.ts';
import * as repo from './clases.repository.ts';

// Lo que toca a la vez un horario y sus clases. Vive en el módulo de clases y usa el service de
// horarios: clases.service ya importa horarios.service, y al revés sería un ciclo.

// Crea las clases de cada horario activo para las semanas del horizonte desde su `vigente_desde`.
// Nunca pisa una clase que ya existe, aunque se haya movido de día. Devuelve cuántas creó.
export async function generarClases(ej: Ejecutor, hoy: FechaDia, horarioId?: number): Promise<number> {
  const horarios = await horariosParaGenerar(ej, horarioId);
  const semanas = semanasDelHorizonte(hoy);
  const filas = horarios.flatMap((horario) =>
    semanas
      .filter((lunes) => lunes >= horario.vigenteDesde)
      .map((lunes) => ({
        horarioId: horario.id,
        semana: lunes,
        fecha: sumarDias(lunes, horario.diaSemana - 1),
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        estilo: horario.estilo,
        nivel: horario.nivel,
        profesorId: horario.profesorId,
      })),
  );
  return repo.insertarLasQueFaltan(ej, filas);
}

// Un horario nuevo aparece en la agenda en el momento, sin esperar a la tarea de cada hora.
export async function crearHorarioConSusClases(datos: CrearHorarioInput, hoy: FechaDia): Promise<Horario> {
  return db.transaction(async (tx) => {
    const creado = await crearHorario(datos, hoy, tx);
    await generarClases(tx, hoy, creado.id);
    return creado;
  });
}

// Cambiar un horario cambia también sus clases desde hoy que todavía eran iguales a él. Las que ya
// pasaron y las que tienen cambios propios (un suplente, una cancelación) no se tocan.
export async function actualizarHorarioYSusClases(id: number, datos: ActualizarHorarioInput, hoy: FechaDia): Promise<Horario> {
  return db.transaction(async (tx) => {
    const viejo = await obtenerHorario(id, tx);
    const { activo, ...cambios } = datos;

    if (Object.values(cambios).some((valor) => valor !== undefined)) {
      const nuevo = await actualizarHorario(id, cambios, tx);
      await seguirAlHorario(tx, viejo, nuevo, hoy);
    }
    if (activo === false && viejo.activo) await darDeBaja(tx, viejo, hoy);
    if (activo === true && !viejo.activo) {
      await reactivarHorario(id, lunesDe(hoy), tx);
      await generarClases(tx, hoy, id);
    }

    return obtenerHorario(id, tx);
  });
}

const datosDe = (horario: Horario): repo.DatosDeHorario => ({
  diaSemana: horario.diaSemana,
  horaInicio: horario.horaInicio,
  horaFin: horario.horaFin,
  estilo: horario.estilo,
  nivel: horario.nivel,
  profesorId: horario.profesor.id,
});

async function seguirAlHorario(tx: Ejecutor, viejo: Horario, nuevo: Horario, hoy: FechaDia): Promise<void> {
  const { diaSemana, ...copiados } = datosDe(nuevo);
  const cambiaElProfesor = nuevo.profesor.id !== viejo.profesor.id;

  for (const clase of await repo.igualesAlHorario(tx, viejo.id, datosDe(viejo), hoy)) {
    const fecha = sumarDias(clase.semana, diaSemana - 1);
    // Una clase de esta semana no pasa a un día que ya pasó: se queda donde estaba.
    if (fecha < hoy) continue;
    if (fecha > clase.fecha && (await repo.hayAnotadosConPackQueVenceAntes(tx, clase.id, fecha))) {
      throw new ReglaDeNegocioError(
        `La clase del ${clase.fecha} tiene alumnos anotados con un pack que vence antes del ${fecha}`,
      );
    }
    await repo.copiarDelHorario(tx, clase.id, fecha, copiados);
    // Como en una suplencia: el sueldo de la clase sigue a quien la da.
    if (cambiaElProfesor) {
      await repo.actualizarPorcentajeDeAsistencias(tx, clase.id, await porcentajeVigente(tx, nuevo.profesor.id, fecha));
    }
  }
}

async function darDeBaja(tx: Ejecutor, horario: Horario, hoy: FechaDia): Promise<void> {
  const conAnotados = await repo.primeraConAsistenciasDesde(tx, horario.id, hoy);
  if (conAnotados !== null) {
    throw new ReglaDeNegocioError(
      `El horario de ${horario.estilo} tiene alumnos anotados el ${conAnotados}. Quitalos antes de darlo de baja`,
    );
  }
  await repo.borrarDesde(tx, horario.id, hoy);
  await actualizarHorario(horario.id, { activo: false }, tx);
}
