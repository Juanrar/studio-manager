import { expect, test, type Page } from '@playwright/test';
import { ADMIN_E2E } from './entorno.ts';

// La API usa el reloj real, así que la clase se crea para el día de hoy en Buenos Aires.
function hoyEnBuenosAires(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function nombreDelDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const diaUtc = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return DIAS[diaUtc === 0 ? 6 : diaUtc - 1]!;
}

// Navega por el menú lateral: otras partes de la pantalla pueden tener un link con el mismo nombre.
async function irA(page: Page, pantalla: string) {
  await page.getByRole('navigation', { name: 'Menú' }).getByRole('link', { name: pantalla }).click();
}

async function crearAlumno(page: Page, nombre: string, apellido: string) {
  await irA(page, 'Alumnos');
  await page.getByRole('button', { name: 'Nuevo alumno' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo alumno' });
  await dialogo.getByLabel('Nombre', { exact: true }).fill(nombre);
  await dialogo.getByLabel('Apellido', { exact: true }).fill(apellido);
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('link', { name: `${apellido}, ${nombre}` })).toBeVisible();
}

test('recepción de punta a punta: pago, asistencia, cobro en el acto y liquidación', async ({ page }) => {
  const hoy = hoyEnBuenosAires();

  await test.step('iniciar sesión', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_E2E.email);
    await page.getByLabel('Contraseña').fill(ADMIN_E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  });

  await test.step('dar de alta a un profesor con 50%', async () => {
    await irA(page, 'Profesores');
    await page.getByRole('button', { name: 'Nuevo profesor' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Nuevo profesor' });
    await dialogo.getByLabel('Nombre', { exact: true }).fill('Erik');
    await dialogo.getByLabel('Apellido', { exact: true }).fill('Zapata');
    await dialogo.getByLabel('Porcentaje por alumno (%)').fill('50');
    await dialogo.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('row', { name: /Zapata/ })).toContainText('50%');
  });

  await test.step('armar una clase para hoy', async () => {
    await irA(page, 'Horarios');
    await page.getByRole('button', { name: 'Nueva clase' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Nueva clase' });
    await dialogo.getByLabel('Estilo').fill('Hip-Hop');
    await dialogo.getByLabel('Día', { exact: true }).selectOption({ label: nombreDelDia(hoy) });
    await dialogo.getByLabel('Empieza').fill('19:00');
    await dialogo.getByLabel('Termina').fill('20:30');
    await dialogo.getByLabel('Profesor titular').selectOption({ label: 'Erik Zapata' });
    await dialogo.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: nombreDelDia(hoy) })).toBeVisible();
  });

  await test.step('cobrarle un pack x4 a una alumna', async () => {
    await crearAlumno(page, 'Martina', 'García');
    await page.getByRole('link', { name: 'García, Martina' }).click();
    const ficha = page.getByRole('complementary', { name: 'Ficha de Martina García' });
    await ficha.getByRole('button', { name: 'Registrar pago' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Registrar pago' });
    await dialogo.getByLabel('Pack').selectOption({ label: 'Pack x4 · $5.200 · 4 clases' });
    await dialogo.getByRole('button', { name: 'Registrar' }).click();
    await expect(ficha.getByText('Vigente')).toBeVisible();
    await ficha.getByRole('tab', { name: 'Pagos' }).click();
    await expect(ficha.getByRole('row', { name: /Pack x4/ })).toContainText('4 de 4');
  });

  await test.step('dar de alta a un alumno sin pack', async () => {
    await crearAlumno(page, 'Joaquín', 'Pérez');
  });

  await test.step('tomar asistencia y cobrar una clase suelta en el acto', async () => {
    await irA(page, 'Agenda');
    await page.getByRole('row', { name: /Hip-Hop/ }).getByRole('link', { name: 'Tomar asistencia' }).click();
    await expect(page.getByRole('heading', { name: 'Asistencia · Hip-Hop' })).toBeVisible();

    const buscador = page.getByRole('searchbox', { name: 'Buscar alumno para anotar' });
    await buscador.fill('García');
    await page.getByRole('button', { name: 'García, Martina' }).click();
    await expect(page.getByRole('row', { name: /García, Martina/ })).toContainText('Pack x4');

    await buscador.fill('Pérez');
    await page.getByRole('button', { name: 'Pérez, Joaquín' }).click();
    const cobro = page.getByRole('form', { name: 'Cobrar y anotar' });
    await expect(cobro).toContainText('no tiene clases disponibles');
    await cobro.getByRole('button', { name: 'Cobrar y anotar' }).click();
    await expect(page.getByRole('row', { name: /Pérez, Joaquín/ })).toContainText('Clase suelta');
  });

  await test.step('ver el sueldo del profesor y los ingresos del mes', async () => {
    await page.goto(`/liquidaciones?periodo=${hoy.slice(0, 7)}`);
    // Pack x4: $1.300 la clase, 50% = $650. Clase suelta: $1.500, 50% = $750.
    const erik = page.getByRole('row', { name: /Zapata/ });
    await expect(erik).toContainText('$1.400');
    await expect(erik).toContainText('Abierta');
    await expect(page.getByRole('region', { name: 'Ingresos del mes' })).toContainText('$6.700');
  });
});
