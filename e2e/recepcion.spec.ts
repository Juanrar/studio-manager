import { expect, test } from '@playwright/test';
import { diaSemanaIso } from '@studio/shared';
import { entrarALaApi, hoyDeLaApi } from './datos-de-ejemplo.ts';
import { ADMIN_E2E, URL_E2E } from './entorno.ts';

const RECEPCION = { email: 'recepcion-flujo@estudio.test', password: 'clave-recepcion-flujo', nombre: 'Recepción Flujo' };
const PROFESORA = { nombre: 'Valentina', apellido: 'Ruiz', porcentajeBp: 4000 };
const ALUMNA = { nombre: 'Camila', apellido: 'Romero' };

type ConId = { id: number };

async function prepararDatos() {
  const api = await entrarALaApi(URL_E2E, ADMIN_E2E);
  const hoy = await hoyDeLaApi(api);
  await api('/api/usuarios', { metodo: 'POST', cuerpo: { ...RECEPCION, rol: 'recepcion' } });
  const profesora = await api<ConId>('/api/profesores', { metodo: 'POST', cuerpo: PROFESORA });
  await api('/api/horarios', {
    metodo: 'POST',
    cuerpo: { estilo: 'Salsa', nivel: 'Intermedio', diaSemana: diaSemanaIso(hoy), horaInicio: '10:00', horaFin: '11:00', profesorId: profesora.id },
  });
  const alumna = await api<ConId>('/api/alumnos', { metodo: 'POST', cuerpo: ALUMNA });
  const { items: packs } = await api<{ items: (ConId & { nombre: string })[] }>('/api/packs');
  const packX4 = packs.find((pack) => pack.nombre === 'Pack x4')!;
  await api('/api/pagos', { metodo: 'POST', cuerpo: { alumnoId: alumna.id, packId: packX4.id, medio: 'efectivo' } });
  return { hoy };
}

test('recepción anota a una alumna desde la grilla y no ve las liquidaciones', async ({ page }) => {
  const { hoy } = await prepararDatos();

  await test.step('entrar como recepción y ver solo su menú', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(RECEPCION.email);
    await page.getByLabel('Contraseña').fill(RECEPCION.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menú' }).getByRole('link')).toHaveText(['Agenda', 'Grilla', 'Alumnos', 'Asistente']);
  });

  await test.step('entrar a la clase de hoy desde la grilla', async () => {
    await page.getByRole('navigation', { name: 'Menú' }).getByRole('link', { name: 'Grilla' }).click();
    await page.getByRole('link', { name: 'Salsa Intermedio, 10:00 a 11:00, Valentina Ruiz' }).click();
    await expect(page.getByRole('heading', { name: 'Asistencia · Salsa' })).toBeVisible();
  });

  await test.step('anotar a la alumna con pack', async () => {
    await page.getByRole('searchbox', { name: 'Buscar alumno para anotar' }).fill('Romero');
    await page.getByRole('button', { name: 'Romero, Camila' }).click();
    await expect(page.getByRole('row', { name: /Romero, Camila/ })).toContainText('Pack x4');
  });

  await test.step('ir a liquidaciones muestra que no tiene permiso, sin pedir ni mostrar datos', async () => {
    const pedidosDeLiquidaciones: string[] = [];
    page.on('request', (pedido) => {
      if (/\/api\/(tablero|liquidaciones)/.test(pedido.url())) pedidosDeLiquidaciones.push(pedido.url());
    });
    await page.goto(`/liquidaciones?periodo=${hoy.slice(0, 7)}`);
    await expect(page.getByText('No tenés permiso para ver esta pantalla.')).toBeVisible();
    await expect(page).toHaveURL(`/liquidaciones?periodo=${hoy.slice(0, 7)}`);
    await expect(page.getByRole('region', { name: 'Ingresos del mes' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Liquidar' })).toHaveCount(0);
    expect(pedidosDeLiquidaciones).toEqual([]);
  });
});
