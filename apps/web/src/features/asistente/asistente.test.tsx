import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
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
});
