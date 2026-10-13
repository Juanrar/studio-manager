import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropuestaDelAsistente } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { ADMIN, RECEPCION, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

const PREGUNTA = '¿Qué clases hay mañana?';
const RESPUESTA = 'Mañana hay Hip-Hop a las 19:00.';

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
          { error: 'Se terminó la cuota del asistente por hoy. Probá mañana.', codigo: 'CUOTA_AGOTADA' },
          { status: 503 },
        ),
      ),
    );
    conSesion(RECEPCION);
    const { usuario } = renderizarEn('/asistente');

    await usuario.type(await screen.findByLabelText('Mensaje para el asistente'), PREGUNTA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Se terminó la cuota del asistente por hoy. Probá mañana.');
    expect(screen.getByLabelText('Mensaje para el asistente')).toHaveValue(PREGUNTA);
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
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

  it('el administrador ve el ejemplo de crear un workshop', async () => {
    conSesion(ADMIN);
    renderizarEn('/asistente');

    expect(await screen.findByText('Creame un workshop de Hip-Hop el sábado de 15 a 17 con Erik')).toBeInTheDocument();
  });

  describe('propuestas', () => {
    const ERIK = { id: 7, nombre: 'Erik', apellido: 'Zapata' };
    const CLASE_UNICA: PropuestaDelAsistente = {
      tipo: 'claseUnica',
      datos: { fecha: '2026-10-17', horaInicio: '15:00', horaFin: '17:00', estilo: 'Hip-Hop', profesorId: 7 },
      profesor: ERIK,
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
});
