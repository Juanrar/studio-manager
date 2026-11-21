import { expect, test } from '@playwright/test';
import { entrarALaApi } from './datos-de-ejemplo.ts';
import { ADMIN_E2E, URL_E2E } from './entorno.ts';

const ALUMNA = { nombre: 'Valeria', apellido: 'Acosta' };

test('un pack anulado deja de contar como vigente en el listado de alumnos', async ({ page }) => {
  const api = await entrarALaApi(URL_E2E, ADMIN_E2E);
  await api('/api/alumnos', { metodo: 'POST', cuerpo: ALUMNA });

  const fila = page.getByRole('row', { name: /Acosta, Valeria/ });
  const ficha = page.getByRole('dialog', { name: 'Ficha de Valeria Acosta' });

  await test.step('iniciar sesión y ver a la alumna sin pack', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_E2E.email);
    await page.getByLabel('Contraseña').fill(ADMIN_E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Menú' }).getByRole('link', { name: 'Alumnos' }).click();
    await expect(fila).toContainText('Sin pack');
  });

  await test.step('registrarle un pack x8 por transferencia', async () => {
    await page.getByRole('link', { name: 'Acosta, Valeria' }).click();
    await ficha.getByRole('button', { name: 'Registrar pago' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Registrar pago' });
    await dialogo.getByLabel('Pack').selectOption({ label: 'Pack x8 · $9.600 · 8 clases' });
    await dialogo.getByLabel('Medio de pago').selectOption({ label: 'Transferencia' });
    await dialogo.getByRole('button', { name: 'Registrar' }).click();
    await expect(ficha.getByText('Vigente')).toBeVisible();
    await ficha.getByRole('button', { name: 'Cerrar' }).click();
    await expect(fila).toContainText('Vigente');
    await expect(fila).toContainText('Pack x8');
    await expect(fila).toContainText('8 de 8');
  });

  await test.step('anular el pago con un motivo', async () => {
    await page.getByRole('link', { name: 'Acosta, Valeria' }).click();
    await ficha.getByRole('tab', { name: 'Pagos' }).click();
    const pago = ficha.getByRole('row', { name: /Pack x8/ });
    await pago.getByRole('button', { name: 'Anular' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Anular pago' });
    await expect(dialogo).toContainText('Pack x8');
    await expect(dialogo).toContainText('$9.600');
    await dialogo.getByLabel('Motivo').fill('Se cargó dos veces');
    await dialogo.getByRole('button', { name: 'Anular pago' }).click();
    await expect(dialogo).toBeHidden();
    await expect(pago).toContainText('Anulado');
    await expect(pago).toContainText('Se cargó dos veces');
    await expect(pago.getByRole('button', { name: 'Anular' })).toHaveCount(0);
    await ficha.getByRole('button', { name: 'Cerrar' }).click();
  });

  await test.step('el listado deja de mostrar el pack vigente', async () => {
    await expect(fila).toContainText('Sin pack');
    await expect(fila).not.toContainText('Vigente');
    await expect(fila).not.toContainText('Pack x8');
  });
});
