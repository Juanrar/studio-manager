import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventoDeAlumno, FichaDeAlumno, Pago } from '@studio/shared';
import { unAlumnoEnListado, unaFichaDeAlumno, unListadoDeAlumnos, unPack, unPago, unResumenDeAlumno } from '../../../../test/datos.ts';
import { RECEPCION, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';
import { celdasDe } from '../../../../test/tabla.ts';

type Respuestas = {
  ficha?: Partial<FichaDeAlumno>;
  pagos?: Pago[];
  actividad?: EventoDeAlumno[];
  // Cuenta los pedidos al resumen: la función los suma, el test los lee.
  pedidosDelResumen?: number;
};

// Abre la ficha de Martina encima de la lista, que también se carga. Los handlers leen `respuestas`
// en cada pedido: un test las cambia para simular lo que devuelve la API después de una acción.
function fichaDeMartina(respuestas: Respuestas = {}) {
  conSesion(RECEPCION);
  const martina = () => unaFichaDeAlumno({ id: 10, nombre: 'Martina', apellido: 'García', ...respuestas.ficha });
  servidor.use(
    http.get('/api/alumnos', () => {
      const { estadoPack, pagoActual } = martina();
      return HttpResponse.json(
        unListadoDeAlumnos([unAlumnoEnListado({ id: 10, nombre: 'Martina', apellido: 'García', estadoPack, pagoActual })]),
      );
    }),
    http.get('/api/alumnos/10', () => HttpResponse.json(martina())),
    http.get('/api/alumnos/10/resumen', () => {
      respuestas.pedidosDelResumen = (respuestas.pedidosDelResumen ?? 0) + 1;
      return HttpResponse.json(unResumenDeAlumno());
    }),
    http.get('/api/alumnos/10/actividad', () => HttpResponse.json({ items: respuestas.actividad ?? [] })),
    http.get('/api/pagos', () => HttpResponse.json({ items: respuestas.pagos ?? [] })),
    http.get('/api/packs', () =>
      HttpResponse.json({
        items: [
          unPack({ id: 1, nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 }),
          unPack({ id: 3, nombre: 'Pack x8', cantidadClases: 8, precio: 9600 }),
        ],
      }),
    ),
  );
  return renderizarEn('/alumnos/10');
}

async function laFicha() {
  return screen.findByRole('dialog', { name: 'Ficha de Martina García' });
}

// La ficha se abre en Resumen: la actividad se ve después de hacer clic en su pestaña.
async function abrirActividad(ficha: HTMLElement, usuario: ReturnType<typeof renderizarEn>['usuario']) {
  await usuario.click(within(ficha).getByRole('tab', { name: 'Actividad' }));
  return within(ficha).getByRole('tabpanel', { name: 'Actividad' });
}

// Cada mes de la actividad con sus hechos, como se leen en pantalla: [mes, [texto, día], ...].
async function mesesDe(actividad: HTMLElement) {
  const meses = await within(actividad).findAllByRole('region');
  return meses.map((mes) => [
    within(mes).getByRole('heading').textContent,
    ...within(mes)
      .getAllByRole('listitem')
      .map((hecho) => [hecho.querySelector('p')?.textContent, hecho.querySelector('time')?.textContent]),
  ]);
}

// Cada dato como [etiqueta, valor].
function camposDe(panel: HTMLElement) {
  const valores = within(panel).getAllByRole('definition');
  return within(panel)
    .getAllByRole('term')
    .map((etiqueta, indice) => [etiqueta.textContent, valores[indice]?.textContent]);
}

describe('/alumnos/:id', () => {
  it('la actividad agrupa los hechos por mes, con el año, del más nuevo al más viejo, y las clases futuras van como anotadas', async () => {
    const { usuario } = fichaDeMartina({
      actividad: [
        {
          tipo: 'anotado',
          fecha: '2026-03-17',
          clase: 'Hip-Hop',
          profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
        },
        {
          tipo: 'asistencia',
          fecha: '2026-03-10',
          clase: 'Hip-Hop',
          profesor: { id: 2, nombre: 'Julia', apellido: 'Paz' },
        },
        { tipo: 'pago', fecha: '2026-03-02', pack: 'Pack x8', monto: 9600, medio: 'mercado_pago', anulado: false },
        { tipo: 'pago', fecha: '2026-02-20', pack: 'Pack x4', monto: 5200, medio: 'efectivo', anulado: true },
        {
          tipo: 'asistencia',
          fecha: '2025-03-17',
          clase: 'Jazz',
          profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
        },
        { tipo: 'alta', fecha: '2025-03-10' },
      ],
    });

    const actividad = await abrirActividad(await laFicha(), usuario);

    expect(await mesesDe(actividad)).toEqual([
      [
        'Marzo 2026',
        ['Anotado en Hip-Hop con Erik Zapata', '17 mar'],
        ['Asistió a Hip-Hop con Julia Paz', '10 mar'],
        ['Pagó Pack x8 · $9.600 con Mercado Pago', '2 mar'],
      ],
      ['Febrero 2026', ['Pagó Pack x4 · $5.200 en efectivo Anulado', '20 feb']],
      ['Marzo 2025', ['Asistió a Jazz con Erik Zapata', '17 mar'], ['Alta en el estudio', '10 mar']],
    ]);
  });

  it('la actividad distingue la baja automática de la baja a mano, y muestra la reactivación', async () => {
    const { usuario } = fichaDeMartina({
      ficha: { activo: false },
      actividad: [
        { tipo: 'baja', fecha: '2026-03-10', automatica: true },
        { tipo: 'reactivacion', fecha: '2026-01-08' },
        { tipo: 'baja', fecha: '2026-01-05', automatica: false },
        { tipo: 'alta', fecha: '2025-12-01' },
      ],
    });

    const actividad = await abrirActividad(await laFicha(), usuario);

    expect(await mesesDe(actividad)).toEqual([
      ['Marzo 2026', ['Baja automática: 2 meses sin comprar un pack', '10 mar']],
      ['Enero 2026', ['Reactivación en el estudio', '8 ene'], ['Baja en el estudio', '5 ene']],
      ['Diciembre 2025', ['Alta en el estudio', '1 dic']],
    ]);
  });

  it('no hay botón para dar de baja ni reactivar, y a un alumno dado de baja se le puede registrar un pago', async () => {
    const { usuario } = fichaDeMartina({ ficha: { activo: false } });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Datos' }));

    expect(within(ficha).queryByRole('button', { name: /dar de baja|reactivar/i })).toBeNull();
    expect(within(ficha).getByRole('button', { name: 'Registrar pago' })).toBeTruthy();
  });

  describe('la pestaña Datos', () => {
    const DATOS = {
      dni: '38555666',
      telefono: '11 5555-0000',
      email: null,
      fechaNacimiento: '1998-05-04',
      contactoEmergencia: null,
      notas: 'Rodilla operada',
      alta: '2025-03-10',
      estadoPack: 'vigente',
      pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 6, venceEl: '2026-04-01' },
    } satisfies Partial<FichaDeAlumno>;

    async function abrirDatos(ficha: Partial<FichaDeAlumno>) {
      const { usuario } = fichaDeMartina({ ficha });
      const ventana = await laFicha();
      await usuario.click(within(ventana).getByRole('tab', { name: 'Datos' }));
      // El Resumen sigue montado debajo (fija el tamaño de la ventana): se busca solo en el grupo de Datos.
      return { usuario, panel: within(within(ventana).getByRole('tabpanel', { name: 'Datos' })).getByRole('group', { name: 'Datos' }) };
    }

    afterEach(() => vi.useRealTimers());

    it('muestra la identidad con la edad y "Vacío" en lo que falta, sin repetir el pack', async () => {
      // El día del cumpleaños todavía no llegó: 27 años, no 28.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 4, 3, 12));
      const { panel } = await abrirDatos(DATOS);

      expect(camposDe(panel)).toEqual([
        ['DNI', '38555666'],
        ['Nacimiento', '04/05/1998 · 27 años'],
        ['Alta', '10/03/2025'],
      ]);
      expect(within(panel).queryByText('Pack x8')).toBeNull();
    });

    it('muestra el teléfono y ofrece copiar el email solo si está cargado', async () => {
      const sinEmail = await abrirDatos(DATOS);

      expect(within(sinEmail.panel).getByText('11 5555-0000')).toBeInTheDocument();
      expect(within(sinEmail.panel).queryByRole('button', { name: 'Copiar' })).toBeNull();
    });

    it('"WhatsApp" abre el chat con el número completo, en otra pestaña, y no aparece si el teléfono no sirve', async () => {
      const conTelefono = await abrirDatos(DATOS);
      const enlace = within(conTelefono.panel).getByRole('link', { name: 'WhatsApp' });
      expect(enlace).toHaveAttribute('href', 'https://wa.me/5491155550000');
      expect(enlace).toHaveAttribute('target', '_blank');
      expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('con un teléfono que WhatsApp no puede abrir, el botón está desactivado y dice por qué', async () => {
      const { panel } = await abrirDatos({ ...DATOS, telefono: '5555-0000' });

      expect(within(panel).getByText('5555-0000')).toBeInTheDocument();
      expect(within(panel).queryByRole('link', { name: 'WhatsApp' })).toBeNull();
      const boton = within(panel).getByRole('button', { name: 'WhatsApp' });
      expect(boton).toBeDisabled();
      expect(boton).toHaveAttribute('title', 'Falta el código de área en el teléfono');
    });

    it('sin teléfono no hay botón de WhatsApp', async () => {
      const { panel } = await abrirDatos({ ...DATOS, telefono: null });

      expect(within(panel).queryByRole('button', { name: 'WhatsApp' })).toBeNull();
      expect(within(panel).queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    });

    it('"Copiar" manda el email al portapapeles y avisa que lo copió', async () => {
      const { usuario, panel } = await abrirDatos({ ...DATOS, email: 'martina@correo.com' });

      await usuario.click(within(panel).getByRole('button', { name: 'Copiar' }));

      expect(await navigator.clipboard.readText()).toBe('martina@correo.com');
      expect(within(panel).getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    });

    it('destaca el contacto de emergencia y muestra las notas', async () => {
      const { panel } = await abrirDatos({ ...DATOS, contactoEmergencia: 'Ana, mamá, 11 4444-1111' });

      expect(within(panel).getByRole('region', { name: 'En caso de emergencia' })).toHaveTextContent('Ana, mamá, 11 4444-1111');
      expect(within(panel).getByRole('region', { name: 'Notas' })).toHaveTextContent('Rodilla operada');
    });

    it('avisa cuando no hay contacto de emergencia ni notas', async () => {
      const { panel } = await abrirDatos({ ...DATOS, contactoEmergencia: null, notas: null });

      expect(within(panel).getByRole('region', { name: 'En caso de emergencia' })).toHaveTextContent(
        'No cargó un contacto de emergencia.',
      );
      expect(within(panel).getByRole('region', { name: 'Notas' })).toHaveTextContent('Sin notas.');
    });

    it('"Editar" abre el formulario con todos los datos del alumno', async () => {
      const { usuario, panel } = await abrirDatos(DATOS);

      await usuario.click(within(panel).getByRole('button', { name: 'Editar' }));

      const dialogo = screen.getByRole('dialog', { name: 'Editar alumno' });
      expect(within(dialogo).getByLabelText('DNI')).toHaveValue('38555666');
    });
  });

  it('registrar un pago manda pack y medio, y actualiza la ficha y la lista', async () => {
    const respuestas: Respuestas = {};
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const pago = unPago({ id: 104, pack: { id: 3, nombre: 'Pack x8' }, clasesUsadas: 0, clasesRestantes: 8 });
        respuestas.pagos = [pago];
        respuestas.ficha = {
          estadoPack: 'vigente',
          pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 8, venceEl: '2026-04-10' },
        };
        return HttpResponse.json(pago, { status: 201 });
      }),
    );
    const { usuario } = fichaDeMartina(respuestas);
    const ficha = await laFicha();
    expect(await within(ficha).findByText('Sin pack')).toBeInTheDocument();

    await usuario.click(within(ficha).getByRole('button', { name: 'Registrar pago' }));
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago' });
    await usuario.selectOptions(await within(dialogo).findByLabelText('Pack'), 'Pack x8 · $9.600 · 8 clases');
    await usuario.selectOptions(within(dialogo).getByLabelText('Medio de pago'), 'Transferencia');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar' }));

    expect(await within(ficha).findByText('Vigente')).toBeInTheDocument();
    expect(within(within(ficha).getByRole('heading', { name: 'Martina García' }).parentElement!).getByText('Pack x8')).toBeInTheDocument();
    await waitFor(() => expect(celdasDe(screen.getByRole('row', { name: /García, Martina/ }))[1]).toBe('Vigente'));
    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));
    expect(await within(ficha).findByRole('row', { name: /Pack x8/ })).toBeInTheDocument();
    expect(cuerpoRecibido).toEqual({ alumnoId: 10, packId: 3, medio: 'transferencia' });
    // Uno al abrir la ficha y otro al registrar el pago: el resumen se recarga.
    expect(respuestas.pedidosDelResumen).toBe(2);
  });

  it('la pestaña Pagos muestra cada pago con su estado, sus clases y el monto en pesos', async () => {
    const { usuario } = fichaDeMartina({
      pagos: [
        unPago({ id: 101, pack: { id: 3, nombre: 'Pack x8' }, cantidadClases: 8, clasesRestantes: 5, monto: 9600 }),
        unPago({
          id: 102,
          pack: { id: 1, nombre: 'Clase suelta' },
          cantidadClases: 1,
          clasesUsadas: 1,
          clasesRestantes: 0,
          monto: 1500,
          vencido: true,
        }),
        unPago({
          id: 103,
          pack: { id: 2, nombre: 'Pack x4' },
          cantidadClases: 4,
          clasesRestantes: 4,
          monto: 5200,
          anulado: true,
          motivoAnulacion: 'Se cargó dos veces',
        }),
      ],
    });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));

    const packX8 = await within(ficha).findByRole('row', { name: /Pack x8/ });
    expect(within(packX8).getByText('5 de 8')).toBeInTheDocument();
    expect(within(packX8).getByText('$9.600')).toBeInTheDocument();
    expect(within(packX8).getByText('Vigente')).toBeInTheDocument();
    expect(within(within(ficha).getByRole('row', { name: /Clase suelta/ })).getByText('Vencido')).toBeInTheDocument();
    expect(within(within(ficha).getByRole('row', { name: /Pack x4/ })).getByText('Anulado')).toBeInTheDocument();
  });

  it('anular un pago manda el motivo', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/pagos/101/anular', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(unPago({ id: 101, anulado: true }));
      }),
    );
    const { usuario } = fichaDeMartina({ pagos: [unPago({ id: 101, pack: { id: 3, nombre: 'Pack x8' } })] });
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('tab', { name: 'Pagos' }));
    const fila = await within(ficha).findByRole('row', { name: /Pack x8/ });
    await usuario.click(within(fila).getByRole('button', { name: 'Anular' }));
    const dialogo = screen.getByRole('dialog', { name: 'Anular pago' });
    await usuario.type(within(dialogo).getByLabelText('Motivo'), 'Se cargó dos veces');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anular pago' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ motivo: 'Se cargó dos veces' }));
    expect(screen.queryByRole('dialog', { name: 'Anular pago' })).not.toBeInTheDocument();
  });

  it('Escape cierra la ventana y vuelve al listado', async () => {
    const { usuario } = fichaDeMartina();
    await laFicha();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /García, Martina/ })).toBeInTheDocument();
  });

  it('el clic en el fondo cierra la ventana, pero el clic dentro no', async () => {
    const { usuario } = fichaDeMartina();
    const ficha = await laFicha();

    await usuario.click(within(ficha).getByRole('heading', { name: 'Martina García' }));
    expect(screen.getByRole('dialog', { name: 'Ficha de Martina García' })).toBeInTheDocument();

    await usuario.click(ficha.parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('con "Registrar pago" abierto, ni Escape ni el clic en el fondo del diálogo cierran la ventana', async () => {
    const { usuario } = fichaDeMartina();
    const ficha = await laFicha();
    await usuario.click(within(ficha).getByRole('button', { name: 'Registrar pago' }));
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago' });

    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Ficha de Martina García' })).toBeInTheDocument();

    await usuario.click(dialogo.parentElement!);
    expect(screen.queryByRole('dialog', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ficha de Martina García' })).toBeInTheDocument();
  });

  it('un arrastre que empieza dentro de la ventana y termina en el fondo no la cierra', async () => {
    fichaDeMartina();
    const ficha = await laFicha();

    // Seleccionar el email y soltar afuera: mousedown adentro, mouseup y click en el fondo.
    fireEvent.mouseDown(within(ficha).getByRole('heading', { name: 'Martina García' }));
    fireEvent.mouseUp(ficha.parentElement!);
    fireEvent.click(ficha.parentElement!);

    expect(screen.getByRole('dialog', { name: 'Ficha de Martina García' })).toBeInTheDocument();
  });

  it('el encabezado muestra desde cuándo está en el estudio', async () => {
    fichaDeMartina();
    const ficha = await laFicha();

    expect(within(ficha).getByText('En el estudio desde 10/03/2025')).toBeInTheDocument();
  });
});
