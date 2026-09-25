import type { ActualizarPackInput, CrearPackInput, Pack } from '@studio/shared';
import { db } from '../../db/client.ts';
import { NoEncontradoError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import * as repo from './packs.repository.ts';

export async function crearPack(datos: CrearPackInput): Promise<Pack> {
  return repo.insertar(db, datos);
}

export async function actualizarPack(id: number, datos: ActualizarPackInput): Promise<Pack> {
  const actualizado = await repo.actualizar(db, id, sinIndefinidos(datos));
  if (actualizado === null) throw new NoEncontradoError(`No existe el pack ${id}`);
  return actualizado;
}

export async function obtenerPack(id: number): Promise<Pack> {
  const encontrado = await repo.buscarPorId(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el pack ${id}`);
  return encontrado;
}

export async function listarPacks(incluirInactivos: boolean): Promise<Pack[]> {
  return repo.listar(db, incluirInactivos);
}
