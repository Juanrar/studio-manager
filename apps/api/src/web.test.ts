import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDeTest } from '../test/app.ts';

let directorioWeb: string;
let app: FastifyInstance;

// Un frontend compilado mínimo: index.html y un archivo en assets/.
beforeAll(async () => {
  directorioWeb = await mkdtemp(join(tmpdir(), 'studio-web-'));
  await mkdir(join(directorioWeb, 'assets'));
  await writeFile(join(directorioWeb, 'index.html'), '<!doctype html><title>Studio Manager</title>');
  await writeFile(join(directorioWeb, 'assets', 'app.js'), 'console.log("app")');
});

afterAll(async () => {
  await rm(directorioWeb, { recursive: true, force: true });
});

beforeEach(async () => {
  app = await crearAppDeTest({ directorioWeb });
});

afterEach(async () => {
  await app.close();
});

describe('frontend compilado', () => {
  it('sirve index.html en / y en las rutas del frontend, y los archivos de assets tal cual', async () => {
    const raiz = await app.inject({ method: 'GET', url: '/' });
    const fichaDeAlumno = await app.inject({ method: 'GET', url: '/alumnos/10' });
    const script = await app.inject({ method: 'GET', url: '/assets/app.js' });

    expect(raiz.statusCode).toBe(200);
    expect(raiz.body).toContain('<title>Studio Manager</title>');
    expect(fichaDeAlumno.statusCode).toBe(200);
    expect(fichaDeAlumno.body).toContain('<title>Studio Manager</title>');
    expect(script.body).toBe('console.log("app")');
  });

  it('una ruta de la API que no existe sigue respondiendo 404 en JSON', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/no-existe' });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: 'Ruta no encontrada' });
  });

  // El README usa WEB_DIST=../web/dist: una ruta relativa al directorio de la API.
  it('acepta la carpeta como ruta relativa', async () => {
    const appRelativa = await crearAppDeTest({ directorioWeb: relative(process.cwd(), directorioWeb) });
    const raiz = await appRelativa.inject({ method: 'GET', url: '/' });
    await appRelativa.close();

    expect(raiz.body).toContain('<title>Studio Manager</title>');
  });
});
