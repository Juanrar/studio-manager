import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { usuario } from '../../db/schema.ts';
import { verificarContrasena } from '../../lib/contrasenas.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { crearUsuario } from './usuarios.service.ts';

let base: BaseDeTest;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
});

describe('crearUsuario', () => {
  it('guarda la contraseña hasheada y verificable, y no la devuelve', async () => {
    const creado = await crearUsuario({
      nombre: 'Laura Recepción',
      email: 'laura@estudio.test',
      password: 'clave-de-laura-1',
      rol: 'recepcion',
    });

    expect(creado).toEqual({
      id: expect.any(Number),
      nombre: 'Laura Recepción',
      email: 'laura@estudio.test',
      rol: 'recepcion',
      activo: true,
    });

    const [fila] = await base.db.select().from(usuario);
    expect(fila?.passwordHash).not.toContain('clave-de-laura-1');
    expect(await verificarContrasena('clave-de-laura-1', fila!.passwordHash)).toBe(true);
    expect(await verificarContrasena('clave-de-otra-persona', fila!.passwordHash)).toBe(false);
  });

  it('rechaza un email que ya usa otro usuario', async () => {
    await crearUsuario({
      nombre: 'Laura Recepción',
      email: 'laura@estudio.test',
      password: 'clave-de-laura-1',
      rol: 'recepcion',
    });

    await expect(
      crearUsuario({
        nombre: 'Otra Laura',
        email: 'laura@estudio.test',
        password: 'otra-clave-123',
        rol: 'admin',
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('Ya existe un usuario con ese email'));
  });
});
