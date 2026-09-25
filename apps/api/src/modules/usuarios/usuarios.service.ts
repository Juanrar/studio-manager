import type { CrearUsuarioInput, UsuarioPublico } from '@studio/shared';
import { db } from '../../db/client.ts';
import { hashearContrasena } from '../../lib/contrasenas.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
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
