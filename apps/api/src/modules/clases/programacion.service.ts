import type { CrearHorarioInput, Horario } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { semanasDelHorizonte, sumarDias, type FechaDia } from '../../lib/fechas.ts';
import { crearHorario, horariosParaGenerar } from '../horarios/horarios.service.ts';
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
