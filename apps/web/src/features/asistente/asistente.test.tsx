import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { CONVERSACION_LARGA, type PropuestaDelAsistente } from '@studio/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN, RECEPCION, conAgendaVacia, conSesion, renderizarEn, sesionDelServidor } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const PREGUNTA = '¿Qué clases hay mañana?';
const RESPUESTA = 'Mañana hay Hip-Hop a las 19:00.';

const ERIK = { id: 7, nombre: 'Erik', apellido: 'Zapata' };
const CLASE_UNICA: PropuestaDelAsistente = {
  tipo: 'claseUnica',
  datos: { fecha: '2026-10-17', horaInicio: '15:00', horaFin: '17:00', estilo: 'Hip-Hop', profesorId: 7 },
  profesor: ERIK,
};
const HORARIOS_DEL_ALTA = [
  { estilo: 'Contemporáneo', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
  { estilo: 'Contemporáneo', diaSemana: 4, horaInicio: '19:00', horaFin: '20:30' },
];
const ALTA: PropuestaDelAsistente = {
  tipo: 'altaDeProfesor',
  datos: { profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000 }, horarios: HORARIOS_DEL_ALTA },
};
const HORARIO: PropuestaDelAsistente = {
  tipo: 'horario',
  datos: { estilo: 'Salsa', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30', profesorId: 7 },
  profesor: ERIK,
};

function asistenteQuePropone(propuesta: PropuestaDelAsistente) {
  servidor.use(
    http.post('/api/asistente/mensajes', () =>
      HttpResponse.json({ historial: [], texto: 'Te propongo esto.', propuestas: [propuesta] }),
    ),
  );
}

// Una respuesta que llega recién cuando el test llama a `responder`.
function respuestaDemorada(respuesta: () => Response) {
  const control = { pedidos: 0, responder: () => {} };
  const llegada = new Promise<void>((resolver) => {
    control.responder = resolver;
  });
  return {
    control,
    manejador: async () => {
      control.pedidos++;
      await llegada;
      return respuesta();
    },
  };
}

// Va a la agenda por el menú, espera que cargue y vuelve al asistente.
async function irALaAgendaYVolver(usuario: ReturnType<typeof renderizarEn>['usuario'], enLaAgenda = () => {}) {
  await usuario.click(screen.getByRole('link', { name: 'Agenda' }));
  expect(await screen.findByText('No hay clases este día.')).toBeInTheDocument();
  enLaAgenda();
  await usuario.click(screen.getByRole('link', { name: 'Asistente' }));
}

// Responde a cada mensaje con la respuesta fija y guarda los cuerpos recibidos.
function asistenteQueResponde(cuerpos: unknown[]) {
  servidor.use(
    http.post('/api/asistente/mensajes', async ({ request }) => {
      cuerpos.push(await request.json());
      return HttpResponse.json({
        historial: [{ rol: 'usuario' }, { rol: 'modelo' }],
        texto: RESPUESTA,
        propuestas: [],
      });
    }),
  );
}

describe('/asistente', () => {
  it('enviar un mensaje lo muestra con la respuesta y manda el historial vacío', async () => {
    const cuerpos: unknown[] = [];
    asistenteQueResponde(cuerpos);
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');

    await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText(RESPUESTA)).toBeInTheDocument();
    expect(screen.getByText(PREGUNTA)).toBeInTheDocument();
    expect(cuerpos).toEqual([{ historial: [], mensaje: PREGUNTA }]);
    expect(screen.getByLabelText('Mensaje para el asistente')).toHaveValue('');
  });

  it('el segundo envío manda el historial que devolvió el primero', async () => {
    const cuerpos: unknown[] = [];
    asistenteQueResponde(cuerpos);
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');

    await usuario.type(campo, PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText(RESPUESTA);
    await usuario.type(campo, 'Y el viernes?');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(cuerpos).toHaveLength(2));

    expect(cuerpos[1]).toEqual({ historial: [{ rol: 'usuario' }, { rol: 'modelo' }], mensaje: 'Y el viernes?' });
  });

  it('Enter envía y Shift+Enter agrega un renglón sin mandar nada', async () => {
    const cuerpos: unknown[] = [];
    asistenteQueResponde(cuerpos);
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');

    await usuario.type(campo, 'Hola{Shift>}{Enter}{/Shift}chau');
    expect(campo).toHaveValue('Hola\nchau');
    expect(cuerpos).toEqual([]);

    await usuario.type(campo, '{Enter}');
    await screen.findByText(RESPUESTA);
    expect(cuerpos).toEqual([{ historial: [], mensaje: 'Hola\nchau' }]);
  });

  it('si la API falla muestra el error y el campo conserva lo escrito', async () => {
    servidor.use(
      http.post('/api/asistente/mensajes', () =>
        HttpResponse.json(
          {
            error: 'Se alcanzó el límite de pedidos del plan gratuito. Probá en un minuto; si sigue, la cuota del día se renueva mañana.',
            codigo: 'CUOTA_AGOTADA',
          },
          { status: 503 },
        ),
      ),
    );
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');

    await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se alcanzó el límite de pedidos del plan gratuito. Probá en un minuto; si sigue, la cuota del día se renueva mañana.',
    );
    expect(screen.getByLabelText('Mensaje para el asistente')).toHaveValue(PREGUNTA);
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
  });

  it('Nueva conversación vacía la lista, conserva lo escrito y el siguiente envío manda el historial vacío', async () => {
    const cuerpos: unknown[] = [];
    asistenteQueResponde(cuerpos);
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');
    expect(screen.queryByRole('button', { name: 'Nueva conversación' })).not.toBeInTheDocument();

    await usuario.type(campo, PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText(RESPUESTA);
    await usuario.type(campo, 'Y el viernes?');
    await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }));

    expect(screen.queryByText(PREGUNTA)).not.toBeInTheDocument();
    expect(screen.queryByText(RESPUESTA)).not.toBeInTheDocument();
    expect(screen.getByText('¿Qué clases hay el jueves?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva conversación' })).not.toBeInTheDocument();
    expect(campo).toHaveValue('Y el viernes?');

    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(cuerpos).toHaveLength(2));
    expect(cuerpos[1]).toEqual({ historial: [], mensaje: 'Y el viernes?' });
  });

  it('Nueva conversación mientras espera descarta la respuesta que llega después', async () => {
    const cuerpos: unknown[] = [];
    let responderPrimera: () => void = () => {};
    servidor.use(
      http.post('/api/asistente/mensajes', async ({ request }) => {
        cuerpos.push(await request.json());
        if (cuerpos.length === 1) {
          await new Promise<void>((resolver) => {
            responderPrimera = resolver;
          });
          return HttpResponse.json({ historial: [{ rol: 'vieja' }], texto: 'Respuesta vieja', propuestas: [] });
        }
        return HttpResponse.json({ historial: [{ rol: 'nueva' }], texto: 'Respuesta nueva', propuestas: [] });
      }),
    );
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');
    await usuario.type(campo, PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));

    await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
    responderPrimera();
    await usuario.type(campo, 'Otra pregunta');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Respuesta nueva')).toBeInTheDocument();
    expect(screen.queryByText('Respuesta vieja')).not.toBeInTheDocument();
    expect(screen.queryByText(PREGUNTA)).not.toBeInTheDocument();
    expect(cuerpos).toEqual([
      { historial: [], mensaje: PREGUNTA },
      { historial: [], mensaje: 'Otra pregunta' },
    ]);
  });

  it('una conversación muy larga muestra el aviso, resalta Nueva conversación y deja lo escrito en el campo', async () => {
    const cuerpos: unknown[] = [];
    servidor.use(
      http.post('/api/asistente/mensajes', async ({ request }) => {
        cuerpos.push(await request.json());
        if (cuerpos.length === 2) {
          return HttpResponse.json(
            { error: 'La conversación es muy larga: empezá una nueva', codigo: CONVERSACION_LARGA },
            { status: 422 },
          );
        }
        return HttpResponse.json({ historial: [{ rol: 'usuario' }, { rol: 'modelo' }], texto: RESPUESTA, propuestas: [] });
      }),
    );
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');
    await usuario.type(campo, PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText(RESPUESTA);
    expect(screen.getByRole('button', { name: 'Nueva conversación' })).not.toHaveClass('bg-acento');

    await usuario.type(campo, 'Y el viernes?');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La conversación es muy larga: empezá una nueva');
    expect(campo).toHaveValue('Y el viernes?');
    expect(screen.getByRole('button', { name: 'Nueva conversación' })).toHaveClass('bg-acento');

    await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText(RESPUESTA)).toBeInTheDocument();
    expect(cuerpos).toEqual([
      { historial: [], mensaje: PREGUNTA },
      { historial: [{ rol: 'usuario' }, { rol: 'modelo' }], mensaje: 'Y el viernes?' },
      { historial: [], mensaje: 'Y el viernes?' },
    ]);
  });

  it('si el pedido falla, lo enviado vuelve al campo sin pisar lo escrito mientras esperaba', async () => {
    const { control, manejador } = respuestaDemorada(() =>
      HttpResponse.json(
        { error: 'El asistente está saturado. Probá en unos minutos.', codigo: 'MODELO_SATURADO' },
        { status: 503 },
      ),
    );
    servidor.use(http.post('/api/asistente/mensajes', manejador));
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');
    const campo = await screen.findByLabelText('Mensaje para el asistente');
    await usuario.type(campo, PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(control.pedidos).toBe(1));

    await usuario.type(campo, 'Y el viernes?');
    control.responder();

    expect(await screen.findByRole('alert')).toHaveTextContent('El asistente está saturado. Probá en unos minutos.');
    expect(campo).toHaveValue(`${PREGUNTA}\nY el viernes?`);
    expect(screen.queryByText(PREGUNTA)).not.toBeInTheDocument();
  });

  it('mientras espera deshabilita Enviar y muestra "Pensando..."', async () => {
    let responder: () => void = () => {};
    servidor.use(
      http.post('/api/asistente/mensajes', async () => {
        await new Promise<void>((resolver) => {
          responder = resolver;
        });
        return HttpResponse.json({ historial: [], texto: RESPUESTA, propuestas: [] });
      }),
    );
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');

    await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Pensando...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();

    responder();
    await screen.findByText(RESPUESTA);
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
  });

  it('recepción ve el menú Asistente y un solo ejemplo; el administrador ve los dos', async () => {
    conSesion(RECEPCION);
    renderizarEn('/asistente');

    const menu = await screen.findByRole('navigation', { name: 'Menú' });
    expect(menu).toHaveTextContent('Asistente');
    expect(screen.getByText('¿Qué clases hay el jueves?')).toBeInTheDocument();
    expect(screen.queryByText(/Creame un workshop/)).not.toBeInTheDocument();
  });

  it('avisa debajo del campo que lo escrito lo procesa Google', async () => {
    conSesion(RECEPCION);
    renderizarEn('/asistente');

    expect(
      await screen.findByText('Lo que escribís acá lo procesa Google. No escribas nombres, DNI ni teléfonos de alumnos.'),
    ).toBeInTheDocument();
  });

  it('el administrador ve el ejemplo de crear un workshop', async () => {
    conSesion(ADMIN);
    renderizarEn('/asistente');

    expect(await screen.findByText('Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik')).toBeInTheDocument();
  });

  describe('propuestas', () => {
    async function pedirPropuesta() {
      conSesion(ADMIN);
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), 'Creame una clase');
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await screen.findByText('Te propongo esto.');
      return usuario;
    }

    it('una clase única propuesta se muestra en una tarjeta con sus datos', async () => {
      asistenteQuePropone(CLASE_UNICA);
      await pedirPropuesta();

      const tarjeta = screen.getByRole('group', { name: 'Propuesta del asistente' });
      expect(within(tarjeta).getByText('Clase única')).toBeInTheDocument();
      expect(within(tarjeta).getByText('Hip-Hop')).toBeInTheDocument();
      expect(within(tarjeta).getByText(/sábado,? 17 de octubre/)).toBeInTheDocument();
      expect(within(tarjeta).getByText('15:00 a 17:00')).toBeInTheDocument();
      expect(within(tarjeta).getByText('Erik Zapata')).toBeInTheDocument();
      expect(within(tarjeta).getByRole('button', { name: 'Crear' })).toBeEnabled();
    });

    it('Crear manda la clase, se deshabilita mientras espera y después muestra Creada con el enlace a la grilla', async () => {
      asistenteQuePropone(CLASE_UNICA);
      const cuerpos: unknown[] = [];
      let responder: () => void = () => {};
      servidor.use(
        http.post('/api/clases', async ({ request }) => {
          cuerpos.push(await request.json());
          await new Promise<void>((resolver) => {
            responder = resolver;
          });
          return HttpResponse.json({ id: 1 }, { status: 201 });
        }),
      );
      const usuario = await pedirPropuesta();

      await usuario.click(screen.getByRole('button', { name: 'Crear' }));
      await waitFor(() => expect(cuerpos).toHaveLength(1));
      expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
      responder();

      expect(await screen.findByText('Creada')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Crear' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver en la grilla' })).toHaveAttribute('href', '/grilla?fecha=2026-10-17');
      expect(cuerpos).toEqual([
        { fecha: '2026-10-17', horaInicio: '15:00', horaFin: '17:00', estilo: 'Hip-Hop', profesorId: 7 },
      ]);
    });

    it('un horario propuesto dice que es todas las semanas y se crea con POST /api/horarios', async () => {
      asistenteQuePropone(HORARIO);
      const cuerpos: unknown[] = [];
      servidor.use(
        http.post('/api/horarios', async ({ request }) => {
          cuerpos.push(await request.json());
          return HttpResponse.json({ id: 3 }, { status: 201 });
        }),
      );
      const usuario = await pedirPropuesta();

      const tarjeta = screen.getByRole('group', { name: 'Propuesta del asistente' });
      expect(within(tarjeta).getByText('Todas las semanas')).toBeInTheDocument();
      expect(within(tarjeta).getByText(/martes/)).toBeInTheDocument();
      expect(within(tarjeta).getByText('19:00 a 20:30')).toBeInTheDocument();

      await usuario.click(within(tarjeta).getByRole('button', { name: 'Crear' }));

      expect(await screen.findByText('Creada')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver en la grilla' })).toHaveAttribute('href', '/grilla');
      expect(cuerpos).toEqual([{ estilo: 'Salsa', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30', profesorId: 7 }]);
    });

    it('si la API rechaza la propuesta muestra el motivo y deja volver a intentar', async () => {
      asistenteQuePropone(CLASE_UNICA);
      servidor.use(
        http.post('/api/clases', () =>
          HttpResponse.json(
            { error: 'Erik Zapata ya tiene una clase en ese horario.', codigo: 'SUPERPOSICION' },
            { status: 422 },
          ),
        ),
      );
      const usuario = await pedirPropuesta();

      await usuario.click(screen.getByRole('button', { name: 'Crear' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Erik Zapata ya tiene una clase en ese horario.');
      expect(screen.getByRole('button', { name: 'Crear' })).toBeEnabled();
      expect(screen.queryByText('Creada')).not.toBeInTheDocument();
    });
  });

  describe('alta de profesor', () => {
    // Martes 13 de octubre de 2026 a las 12:00 de Buenos Aires.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-13T15:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function pedirElAlta(cuerposDelChat: unknown[] = []) {
      servidor.use(
        http.post('/api/asistente/mensajes', async ({ request }) => {
          cuerposDelChat.push(await request.json());
          return HttpResponse.json({ historial: [], texto: 'Te propongo esto.', propuestas: [ALTA] });
        }),
      );
      conSesion(ADMIN);
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), 'Sumá a Lucía Fernández');
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await screen.findByText('Te propongo esto.');
      return usuario;
    }

    it('la tarjeta muestra el nombre, el porcentaje y la clase en el martes 13 y el jueves 15', async () => {
      await pedirElAlta();

      const tarjeta = screen.getByRole('group', { name: 'Propuesta del asistente' });
      expect(within(tarjeta).getByRole('heading', { name: 'Lucía Fernández' })).toBeInTheDocument();
      expect(within(tarjeta).getByText('50%')).toBeInTheDocument();
      const nombreDeLaClase = 'Contemporáneo, 19:00 a 20:30, Lucía Fernández';
      expect(within(within(tarjeta).getByRole('group', { name: 'Martes 13' })).getByLabelText(nombreDeLaClase)).toBeInTheDocument();
      expect(within(within(tarjeta).getByRole('group', { name: 'Jueves 15' })).getByLabelText(nombreDeLaClase)).toBeInTheDocument();
      expect(within(tarjeta).getByText('Estos datos no pasan por el asistente.')).toBeInTheDocument();
    });

    it('Crear profesor manda el DNI escrito en la tarjeta a la API del estudio y no al asistente', async () => {
      const cuerposDelChat: unknown[] = [];
      const cuerpos: unknown[] = [];
      servidor.use(
        http.post('/api/asistente/altas-de-profesor', async ({ request }) => {
          cuerpos.push(await request.json());
          return HttpResponse.json({ id: 31 }, { status: 201 });
        }),
      );
      const usuario = await pedirElAlta(cuerposDelChat);

      await usuario.type(screen.getByLabelText('DNI'), '30123456');
      await usuario.click(screen.getByRole('button', { name: 'Crear profesor' }));

      await waitFor(() => expect(cuerpos).toHaveLength(1));
      expect(cuerpos[0]).toEqual({
        profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000, dni: '30123456', email: '', telefono: '', aliasCbu: '' },
        horarios: HORARIOS_DEL_ALTA,
      });
      expect(cuerposDelChat).toHaveLength(1);
      expect(JSON.stringify(cuerposDelChat)).not.toContain('30123456');
    });

    it('con 201 desaparece el botón y se ve Creado con el enlace a la ficha', async () => {
      let responder: () => void = () => {};
      let pedidos = 0;
      servidor.use(
        http.post('/api/asistente/altas-de-profesor', async () => {
          pedidos++;
          await new Promise<void>((resolver) => {
            responder = resolver;
          });
          return HttpResponse.json({ id: 31 }, { status: 201 });
        }),
      );
      const usuario = await pedirElAlta();

      await usuario.click(screen.getByRole('button', { name: 'Crear profesor' }));
      await waitFor(() => expect(pedidos).toBe(1));
      expect(screen.getByRole('button', { name: 'Crear profesor' })).toBeDisabled();
      responder();

      expect(await screen.findByText('Creado')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Crear profesor' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', '/profesores/31');
    });

    it('con 422 muestra el motivo en la tarjeta y deja volver a intentar', async () => {
      servidor.use(
        http.post('/api/asistente/altas-de-profesor', () =>
          HttpResponse.json({ error: 'Ya existe un profesor con ese DNI', codigo: 'REGLA_DE_NEGOCIO' }, { status: 422 }),
        ),
      );
      const usuario = await pedirElAlta();

      await usuario.click(screen.getByRole('button', { name: 'Crear profesor' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un profesor con ese DNI');
      expect(screen.getByRole('button', { name: 'Crear profesor' })).toBeEnabled();
      expect(screen.queryByText('Creado')).not.toBeInTheDocument();
    });
  });

  describe('al cambiar de pantalla', () => {
    it('ir a otra pantalla y volver conserva los mensajes, la propuesta creada y lo escrito', async () => {
      asistenteQuePropone(CLASE_UNICA);
      servidor.use(http.post('/api/clases', () => HttpResponse.json({ id: 1 }, { status: 201 })));
      conAgendaVacia();
      conSesion(ADMIN);
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), 'Creame una clase');
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await usuario.click(await screen.findByRole('button', { name: 'Crear' }));
      await screen.findByText('Creada');
      await usuario.type(screen.getByLabelText('Mensaje para el asistente'), 'Y otra el domingo');

      await irALaAgendaYVolver(usuario);

      expect(await screen.findByText('Te propongo esto.')).toBeInTheDocument();
      expect(screen.getByText('Creame una clase')).toBeInTheDocument();
      const tarjeta = screen.getByRole('group', { name: 'Propuesta del asistente' });
      expect(within(tarjeta).getByText('Creada')).toBeInTheDocument();
      expect(within(tarjeta).queryByRole('button', { name: 'Crear' })).not.toBeInTheDocument();
      expect(within(tarjeta).getByRole('link', { name: 'Ver en la grilla' })).toHaveAttribute('href', '/grilla?fecha=2026-10-17');
      expect(screen.getByLabelText('Mensaje para el asistente')).toHaveValue('Y otra el domingo');
    });

    it('una respuesta que llega mientras el usuario está en otra pantalla aparece al volver', async () => {
      const { control, manejador } = respuestaDemorada(() =>
        HttpResponse.json({ historial: [], texto: RESPUESTA, propuestas: [] }),
      );
      servidor.use(http.post('/api/asistente/mensajes', manejador));
      conAgendaVacia();
      conSesion(RECEPCION);
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(control.pedidos).toBe(1));

      await irALaAgendaYVolver(usuario, () => control.responder());

      expect(await screen.findByText(RESPUESTA)).toBeInTheDocument();
      expect(screen.getByText(PREGUNTA)).toBeInTheDocument();
      expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
    });

    it('una propuesta que se termina de crear con el usuario en otra pantalla figura como Creada al volver', async () => {
      asistenteQuePropone(CLASE_UNICA);
      const { control, manejador } = respuestaDemorada(() => HttpResponse.json({ id: 1 }, { status: 201 }));
      servidor.use(http.post('/api/clases', manejador));
      conAgendaVacia();
      conSesion(ADMIN);
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), 'Creame una clase');
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await usuario.click(await screen.findByRole('button', { name: 'Crear' }));
      await waitFor(() => expect(control.pedidos).toBe(1));

      await irALaAgendaYVolver(usuario, () => control.responder());

      const tarjeta = await screen.findByRole('group', { name: 'Propuesta del asistente' });
      expect(await within(tarjeta).findByText('Creada')).toBeInTheDocument();
      expect(within(tarjeta).queryByRole('button', { name: 'Crear' })).not.toBeInTheDocument();
      expect(control.pedidos).toBe(1);
    });

    it('cerrar sesión borra la conversación', async () => {
      asistenteQueResponde([]);
      sesionDelServidor(RECEPCION, true);
      conAgendaVacia();
      const { usuario } = renderizarEn('/asistente');
      await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
      await usuario.click(screen.getByRole('button', { name: 'Enviar' }));
      await screen.findByText(RESPUESTA);
      await usuario.type(screen.getByLabelText('Mensaje para el asistente'), 'Algo sin mandar');

      await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      await usuario.type(await screen.findByLabelText('Email'), 'rita@estudio.test');
      await usuario.type(screen.getByLabelText('Contraseña'), 'clave-de-rita-1');
      await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
      await usuario.click(await screen.findByRole('link', { name: 'Asistente' }));

      expect(await screen.findByText('¿Qué clases hay el jueves?')).toBeInTheDocument();
      expect(screen.queryByText(PREGUNTA)).not.toBeInTheDocument();
      expect(screen.queryByText(RESPUESTA)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Mensaje para el asistente')).toHaveValue('');
    });
  });
});
