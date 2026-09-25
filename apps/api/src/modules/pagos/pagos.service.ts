import type { Pago, RegistrarPagoInput } from '@studio/shared';
import { config } from '../../config.ts';
import { db } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { hoyEnEstudio, sumarUnMes, type FechaDia } from '../../lib/fechas.ts';
import { obtenerAlumno } from '../alumnos/alumnos.service.ts';
import { obtenerPack } from '../packs/packs.service.ts';
import * as repo from './pagos.repository.ts';

// El pago congela el precio y la cantidad de clases del pack al momento de la compra.
export async function registrarPago(
  datos: RegistrarPagoInput,
  usuarioId: number,
  ahora: Date,
  hoy: FechaDia,
): Promise<Pago> {
  const alumno = await obtenerAlumno(datos.alumnoId);
  if (!alumno.activo) {
    throw new ReglaDeNegocioError(`El alumno ${alumno.nombre} ${alumno.apellido} está dado de baja`);
  }
  const pack = await obtenerPack(datos.packId);
  if (!pack.activo) throw new ReglaDeNegocioError(`El pack ${pack.nombre} ya no se vende`);

  const id = await repo.insertar(db, {
    alumnoId: alumno.id,
    packId: pack.id,
    cantidadClases: pack.cantidadClases,
    monto: pack.precio,
    medio: datos.medio,
    fecha: ahora,
    venceEl: sumarUnMes(hoy),
    registradoPor: usuarioId,
  });
  return obtenerPago(id, hoy);
}

export async function anularPago(id: number, motivo: string, ahora: Date, hoy: FechaDia): Promise<Pago> {
  await db.transaction(async (tx) => {
    const pago = await repo.bloquear(tx, id);
    if (pago === null) throw new NoEncontradoError(`No existe el pago ${id}`);
    if (pago.anuladoEn !== null) throw new ReglaDeNegocioError('El pago ya está anulado');
    await repo.actualizar(tx, id, { anuladoEn: ahora, motivoAnulacion: motivo });
  });
  return obtenerPago(id, hoy);
}

export async function extenderVencimiento(id: number, venceEl: FechaDia, hoy: FechaDia): Promise<Pago> {
  const pago = await repo.buscarPorId(db, id);
  if (pago === null) throw new NoEncontradoError(`No existe el pago ${id}`);
  const diaDeCompra = hoyEnEstudio(pago.fecha, config.tzEstudio);
  if (venceEl <= diaDeCompra) {
    throw new ReglaDeNegocioError(`El vencimiento tiene que ser posterior a la compra (${diaDeCompra})`);
  }
  await repo.actualizar(db, id, { venceEl });
  return obtenerPago(id, hoy);
}

export async function obtenerPago(id: number, hoy: FechaDia): Promise<Pago> {
  const fila = await repo.buscarPorId(db, id);
  if (fila === null) throw new NoEncontradoError(`No existe el pago ${id}`);
  return aPago(fila, hoy);
}

export async function listarPagosDeAlumno(alumnoId: number, hoy: FechaDia): Promise<Pago[]> {
  const filas = await repo.listarDeAlumno(db, alumnoId);
  return filas.map((fila) => aPago(fila, hoy));
}

function aPago(fila: repo.FilaPago, hoy: FechaDia): Pago {
  const { anuladoEn, fecha, ...resto } = fila;
  return {
    ...resto,
    fecha: fecha.toISOString(),
    clasesRestantes: fila.cantidadClases - fila.clasesUsadas,
    // El día del vencimiento todavía vale.
    vencido: fila.venceEl < hoy,
    anulado: anuladoEn !== null,
  };
}
