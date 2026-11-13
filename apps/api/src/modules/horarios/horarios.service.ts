import type { ActualizarHorarioInput, CrearHorarioInput, Horario } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { lunesDe, semanasDelHorizonte, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { adoptarClaseUnica, crearClasesQueFaltan, quitarClasesDesde, seguirAlHorario } from '../clases/clases.service.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './horarios.repository.ts';

// El horario y sus clases. Este módulo decide qué horarios, qué semanas y desde cuándo; qué le pasa a
// cada clase lo decide clases.service. Ninguna función exportada cambia la fila sin sus clases.

// Un horario nuevo aparece en la agenda en el momento, sin esperar a la tarea de cada hora. Con `claseId`,
// esa clase única pasa a ser la primera de la serie ("Agregar a todas las semanas" en la grilla).
export async function crearHorario(datos: CrearHorarioInput, hoy: FechaDia): Promise<Horario> {
  return db.transaction((tx) => crearHorarioEn(tx, datos, hoy));
}

// Recibe el ejecutor para que el asistente cree un profesor y todos sus horarios en una sola transacción.
export async function crearHorarioEn(ej: Ejecutor, datos: CrearHorarioInput, hoy: FechaDia): Promise<Horario> {
  const creado = await insertarFila(ej, datos, hoy);
  if (datos.claseId !== undefined) {
    await adoptarClaseUnica(ej, datos.claseId, creado.id, datos.desde ?? lunesDe(hoy));
  }
  await generarClases(ej, hoy, creado.id);
  return creado;
}

// Cambiar un horario cambia también sus clases desde la semana `desde` (o desde hoy) que todavía eran
// iguales a él. Las que ya pasaron y las que tienen cambios propios (un suplente, una cancelación) no se
// tocan. Es "Aplicar a todas las semanas" en la grilla; sin `desde`, la pantalla de horarios.
export async function actualizarHorario(id: number, datos: ActualizarHorarioInput, hoy: FechaDia): Promise<Horario> {
  return db.transaction(async (tx) => {
    const viejo = await obtenerHorario(id, tx);
    const { activo, desde, ...cambios } = datos;
    const inicio = desde !== undefined && desde > hoy ? desde : hoy;

    if (Object.values(cambios).some((valor) => valor !== undefined)) {
      await seguirAlHorario(tx, id, inicio, hoy, async () => {
        const nuevo = await actualizarFila(tx, id, cambios);
        return { diaSemana: nuevo.diaSemana, profesorId: nuevo.profesor.id };
      });
    }
    if (activo === false && viejo.activo) {
      await quitarClasesDesde(tx, viejo, inicio);
      await actualizarFila(tx, id, { activo: false });
    }
    if (activo === true && !viejo.activo) {
      await reactivar(tx, id, lunesDe(hoy));
      await generarClases(tx, hoy, id);
    }

    return obtenerHorario(id, tx);
  });
}

// Crea las clases de cada horario activo para las semanas del horizonte desde su `vigente_desde`.
// Nunca pisa una clase que ya existe, aunque se haya movido de día. Devuelve cuántas creó.
export async function generarClases(ej: Ejecutor, hoy: FechaDia, horarioId?: number): Promise<number> {
  const horarios = await repo.listarParaGenerar(ej, horarioId);
  const semanas = semanasDelHorizonte(hoy);
  let creadas = 0;
  // Cada horario tiene sus semanas: las del horizonte desde que rige.
  for (const horario of horarios) {
    const suyas = semanas.filter((lunes) => lunes >= horario.vigenteDesde);
    creadas += await crearClasesQueFaltan(ej, [horario], suyas);
  }
  return creadas;
}

export async function obtenerHorario(id: number, ej: Ejecutor = db): Promise<Horario> {
  const encontrado = await repo.buscarPorId(ej, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el horario ${id}`);
  return encontrado;
}

// No verifica al profesor como crear y actualizar: uno que no existe da una lista vacía y uno
// dado de baja da sus horarios, que es lo que muestra su ficha.
export async function listarHorarios(filtros: repo.FiltrosDeHorarios): Promise<Horario[]> {
  return repo.listar(db, filtros);
}

// Solo la fila
//
// Sin export: desde afuera, un horario cambia siempre junto con sus clases.

// Un horario nuevo rige desde `desde` o, sin él, desde el lunes de la semana de hoy.
async function insertarFila(ej: Ejecutor, datos: CrearHorarioInput, hoy: FechaDia): Promise<Horario> {
  const { desde, claseId: _claseId, ...horario } = datos;
  const vigenteDesde = desde ?? lunesDe(hoy);
  if (vigenteDesde < lunesDe(hoy)) throw new ReglaDeNegocioError('Un horario nuevo rige desde esta semana o una posterior');
  await verificarProfesorActivo(ej, horario.profesorId);
  const id = await repo.insertar(ej, { ...horario, nivel: horario.nivel ?? null, vigenteDesde });
  return obtenerHorario(id, ej);
}

async function actualizarFila(ej: Ejecutor, id: number, cambios: Omit<ActualizarHorarioInput, 'desde'>): Promise<Horario> {
  if (cambios.profesorId !== undefined) await verificarProfesorActivo(ej, cambios.profesorId);
  let existe: boolean;
  try {
    existe = await repo.actualizar(ej, id, sinIndefinidos(cambios));
  } catch (error) {
    // En un PATCH el esquema no ve la otra hora; la base la controla con su check.
    if (esViolacionCheck(error, 'horario_horas_validas')) {
      throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
    }
    throw error;
  }
  if (!existe) throw new NoEncontradoError(`No existe el horario ${id}`);
  return obtenerHorario(id, ej);
}

// Vuelve a dictarse desde la semana `desde`: las anteriores no tienen sus clases.
async function reactivar(ej: Ejecutor, id: number, desde: FechaDia): Promise<void> {
  await repo.actualizar(ej, id, { activo: true, vigenteDesde: desde });
}
