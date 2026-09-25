import type { ActualizarUsuarioInput, CrearUsuarioInput, UsuarioPublico } from '@studio/shared';
import { db } from '../../db/client.ts';
import { hashearContrasena } from '../../lib/contrasenas.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import { cerrarSesionesDeUsuario } from '../auth/auth.service.ts';
import * as repo from './usuarios.repository.ts';

export async function crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioPublico> {
  const passwordHash = await hashearContrasena(datos.password);
  try {
    return await repo.insertar(db, {
      nombre: datos.nombre,
      email: datos.email,
      passwordHash,
      rol: datos.rol,
    });
  } catch (error) {
    if (esViolacionUnica(error, 'usuario_email_unique')) {
      throw new ReglaDeNegocioError('Ya existe un usuario con ese email');
    }
    throw error;
  }
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  return repo.listar(db);
}

export async function actualizarUsuario(
  id: number,
  datos: ActualizarUsuarioInput,
): Promise<UsuarioPublico> {
  const cambios: Parameters<typeof repo.actualizar>[2] = {};
  if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
  if (datos.rol !== undefined) cambios.rol = datos.rol;
  if (datos.activo !== undefined) cambios.activo = datos.activo;
  if (datos.password !== undefined) cambios.passwordHash = await hashearContrasena(datos.password);

  return db.transaction(async (tx) => {
    const actualizado = await repo.actualizar(tx, id, cambios);
    if (actualizado === null) {
      throw new NoEncontradoError(`No existe el usuario ${id}`);
    }
    // Un usuario dado de baja o con contraseña nueva no sigue logueado con sesiones viejas.
    if (datos.activo === false || datos.password !== undefined) {
      await cerrarSesionesDeUsuario(tx, id);
    }
    return actualizado;
  });
}
