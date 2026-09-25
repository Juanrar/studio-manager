import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { levantarBaseDeTest, type BaseDeTest } from '../../test/db.ts';
import { alumno, pack, profesor } from './schema.ts';

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

describe('esquema', () => {
  it('inserta un alumno sin email ni dni', async () => {
    const [creado] = await base.db
      .insert(alumno)
      .values({ nombre: 'Ana', apellido: 'García' })
      .returning();

    expect(creado?.id).toBeGreaterThan(0);
    expect(creado?.activo).toBe(true);
    expect(creado?.email).toBeNull();
  });

  it('rechaza dos alumnos con el mismo dni', async () => {
    await base.db.insert(alumno).values({ nombre: 'Ana', apellido: 'García', dni: '30111222' });

    await expect(
      base.db.insert(alumno).values({ nombre: 'Otro', apellido: 'Alumno', dni: '30111222' }),
    ).rejects.toThrow();
  });

  it('guarda el precio del pack como entero en pesos', async () => {
    const [creado] = await base.db
      .insert(pack)
      .values({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600 })
      .returning();

    expect(creado?.precio).toBe(9600);
    expect(Number.isInteger(creado?.precio)).toBe(true);
  });

  it('rechaza un pack con precio negativo', async () => {
    await expect(
      base.db.insert(pack).values({ nombre: 'Inválido', cantidadClases: 4, precio: -1 }),
    ).rejects.toThrow();
  });

  it('rechaza un porcentaje mayor a 10000 puntos básicos', async () => {
    const [profe] = await base.db
      .insert(profesor)
      .values({ nombre: 'Erik', apellido: 'Zapata' })
      .returning();

    await expect(
      base.db.execute(sql`
        insert into porcentaje_profesor (profesor_id, porcentaje_bp, vigente_desde)
        values (${profe!.id}, 10001, current_date)
      `),
    ).rejects.toThrow();
  });
});
