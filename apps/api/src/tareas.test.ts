import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppDeTest } from '../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../test/db.ts';
import { crearAlumnoDeTest } from '../test/fabricas.ts';
import { alumno } from './db/schema.ts';
import { programarTareas } from './tareas.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let detener: (() => void) | undefined;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
});

afterEach(async () => {
  detener?.();
  await app.close();
});

describe('programarTareas', () => {
  it('al arrancar da de baja a quien pasó 2 meses sin comprar', async () => {
    // AHORA es el 2026-03-10. Lucía se anotó en enero y nunca compró; Martina se anotó hoy.
    const lucia = await crearAlumnoDeTest({ nombre: 'Lucía' }, new Date('2026-01-05T15:00:00Z'));
    const martina = await crearAlumnoDeTest({ nombre: 'Martina' });

    detener = programarTareas(app);

    await vi.waitFor(async () => {
      expect(await base.db.select({ id: alumno.id, activo: alumno.activo }).from(alumno).orderBy(alumno.id)).toEqual([
        { id: lucia.id, activo: false },
        { id: martina.id, activo: true },
      ]);
    });
  });
});
