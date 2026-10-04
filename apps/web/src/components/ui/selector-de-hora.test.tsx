import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectorDeHora } from './SelectorDeHora.tsx';

// Las franjas de la lista, escritas a mano: de 08:00 a 23:45 cada 15 minutos, 64 en total.
const FRANJAS = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00', '19:15', '19:30', '19:45',
  '20:00', '20:15', '20:30', '20:45',
  '21:00', '21:15', '21:30', '21:45',
  '22:00', '22:15', '22:30', '22:45',
  '23:00', '23:15', '23:30', '23:45',
];

// Controlado como en la ficha: guarda el valor y avisa de cada cambio. Está dentro de un formulario
// para ver si Enter lo envía, y tiene un botón después para ver adónde va el foco con Tab.
function CampoDeHora({
  inicial = '',
  alCambiar,
  alEnviar,
}: {
  inicial?: string;
  alCambiar?: (valor: string) => void;
  alEnviar?: () => void;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        alEnviar?.();
      }}
    >
      <SelectorDeHora
        etiqueta="Hora de inicio"
        valor={valor}
        alCambiar={(nuevo) => {
          alCambiar?.(nuevo);
          setValor(nuevo);
        }}
      />
      <button type="submit">Guardar</button>
    </form>
  );
}

const campo = () => screen.getByRole('combobox', { name: 'Hora de inicio' });
const reloj = () => screen.getByRole('button', { name: 'Elegir el horario' });
const franjasVisibles = () => screen.getAllByRole('option').map((franja) => franja.textContent);
const franjaMarcada = () => screen.getByRole('option', { selected: true }).textContent;

// jsdom no calcula el diseño. Esto simula franjas de 28px dentro de una lista que muestra 8,
// que es lo que hace falta para mirar hasta dónde se desplaza la lista.
const ALTO_DE_FRANJA = 28;
const ALTO_DE_LA_LISTA = 8 * ALTO_DE_FRANJA;

function simularMedidas() {
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
    return this.parentElement === null ? 0 : Array.from(this.parentElement.children).indexOf(this) * ALTO_DE_FRANJA;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ALTO_DE_FRANJA);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(ALTO_DE_LA_LISTA);
}

describe('SelectorDeHora', () => {
  afterEach(() => vi.restoreAllMocks());

  it('el reloj abre la lista con las 64 franjas de 15 minutos, de 08:00 a 23:45', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:00" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await usuario.click(reloj());

    expect(franjasVisibles()).toEqual(FRANJAS);
  });

  it('volver a tocar el reloj cierra la lista', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:00" />);

    await usuario.click(reloj());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(reloj()).toHaveAttribute('aria-expanded', 'true');
    await usuario.click(reloj());

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(reloj()).toHaveAttribute('aria-expanded', 'false');
  });

  it('elegir una franja avisa con alCambiar, cierra la lista y deja la hora y el foco en el campo', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora inicial="18:00" alCambiar={alCambiar} />);

    await usuario.click(reloj());
    await usuario.click(screen.getByRole('option', { name: '19:30' }));

    expect(alCambiar.mock.calls).toEqual([['19:30']]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(campo()).toHaveValue('19:30');
    expect(campo()).toHaveFocus();
  });

  it('tipear 19 deja solo las cuatro franjas de las 19 y avisa de cada tecla', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora alCambiar={alCambiar} />);

    await usuario.type(campo(), '19');

    expect(franjasVisibles()).toEqual(['19:00', '19:15', '19:30', '19:45']);
    // Lo tipeado se avisa aunque todavía no sea una hora: validar el formato no es cosa del selector.
    expect(alCambiar.mock.calls).toEqual([['1'], ['19']]);
  });

  it.each(['193', '19:3'])('tipear %s deja solo 19:30 porque la comparación ignora los dos puntos', async (escrito) => {
    const usuario = userEvent.setup();
    render(<CampoDeHora />);

    await usuario.type(campo(), escrito);

    expect(franjasVisibles()).toEqual(['19:30']);
  });

  it('se compara desde el principio de la hora: tipear 21 no trae las 12:15', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora />);

    await usuario.type(campo(), '21');

    expect(franjasVisibles()).toEqual(['21:00', '21:15', '21:30', '21:45']);
  });

  it('si lo tipeado no coincide con ninguna franja, la lista muestra todas', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora />);

    await usuario.type(campo(), '99');

    expect(franjasVisibles()).toEqual(FRANJAS);
  });

  it('un horario fuera de la grilla aparece en su lugar al abrir la lista y queda marcado', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:20" />);

    await usuario.click(reloj());

    expect(franjasVisibles()).toEqual(FRANJAS.toSpliced(FRANJAS.indexOf('18:30'), 0, '18:20'));
    expect(franjaMarcada()).toBe('18:20');
  });

  it('al abrir, el horario actual queda marcado y en el medio de la lista', async () => {
    simularMedidas();
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="21:00" />);

    await usuario.click(reloj());

    // La de las 21:00 es la franja 52: sin desplazar la lista, en pantalla estarían solo las 8 primeras.
    // Empieza a 52 × 28px = 1456 del borde de arriba y la lista se corre 98px menos, la mitad de lo que sobra.
    expect(screen.getByRole('listbox').scrollTop).toBe(1358);
    expect(franjaMarcada()).toBe('21:00');
  });

  it('al moverse con las flechas, la franja marcada no se sale de lo que se ve', async () => {
    simularMedidas();
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="08:00" />);
    await usuario.click(campo());

    // La primera flecha abre la lista; las doce siguientes bajan hasta las 11:00.
    await usuario.keyboard('{ArrowDown}');
    await usuario.keyboard('{ArrowDown}'.repeat(12));

    const arribaDeLas1100 = FRANJAS.indexOf('11:00') * ALTO_DE_FRANJA;
    const lista = screen.getByRole('listbox');
    expect(franjaMarcada()).toBe('11:00');
    expect(lista.scrollTop).toBeGreaterThanOrEqual(arribaDeLas1100 + ALTO_DE_FRANJA - ALTO_DE_LA_LISTA);
    expect(lista.scrollTop).toBeLessThanOrEqual(arribaDeLas1100);
  });

  it('flecha abajo abre la lista cerrada y las flechas marcan una franja que Enter elige', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora inicial="18:00" alCambiar={alCambiar} />);
    await usuario.click(campo());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(franjaMarcada()).toBe('18:00');

    await usuario.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(franjaMarcada()).toBe('18:15');

    await usuario.keyboard('{Enter}');
    expect(alCambiar.mock.calls).toEqual([['18:15']]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(campo()).toHaveValue('18:15');
  });

  it('tipear 21 y elegir con las flechas y Enter deja la hora elegida', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora alCambiar={alCambiar} />);

    await usuario.type(campo(), '21');
    // La primera flecha marca 21:00 y la segunda, 21:15.
    await usuario.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(alCambiar.mock.calls).toEqual([['2'], ['21'], ['21:15']]);
    expect(campo()).toHaveValue('21:15');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Escape cierra la lista sin cambiar la hora', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora inicial="18:00" alCambiar={alCambiar} />);
    await usuario.click(campo());

    await usuario.keyboard('{ArrowDown}{ArrowDown}');
    expect(franjaMarcada()).toBe('18:15');
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
    expect(campo()).toHaveValue('18:00');
  });

  it('Enter sin una franja marcada cierra la lista y deja lo tipeado', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<CampoDeHora alCambiar={alCambiar} />);

    await usuario.type(campo(), '19');
    await usuario.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(alCambiar.mock.calls).toEqual([['1'], ['19']]);
    expect(campo()).toHaveValue('19');
  });

  it('Enter con la lista abierta elige y no envía el formulario; con la lista cerrada, sí', async () => {
    const usuario = userEvent.setup();
    const alEnviar = vi.fn();
    render(<CampoDeHora inicial="18:00" alEnviar={alEnviar} />);
    await usuario.click(campo());

    await usuario.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(alEnviar).not.toHaveBeenCalled();

    await usuario.keyboard('{Enter}');
    expect(alEnviar).toHaveBeenCalledTimes(1);
  });

  it('un clic fuera del selector cierra la lista y uno adentro no', async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <CampoDeHora inicial="18:00" />
        {/* Una zona que no toma el foco, como pasa al tocar la pantalla de una tablet. */}
        <p onMouseDown={(evento) => evento.preventDefault()}>Afuera</p>
      </>,
    );

    await usuario.click(reloj());
    await usuario.click(campo());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await usuario.click(screen.getByText('Afuera'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(campo()).toHaveFocus();

    await usuario.click(reloj());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await usuario.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Tab pasa al campo siguiente sin parar en el reloj ni en la lista, y cierra la lista', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:00" />);
    await usuario.click(reloj());
    // Chrome deja enfocar con Tab una lista con scroll que no tiene nada enfocable adentro; jsdom no.
    expect(screen.getByRole('listbox')).toHaveAttribute('tabindex', '-1');

    await usuario.tab();

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('la lista se abre debajo del campo si entra', async () => {
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:00" />);

    await usuario.click(reloj());

    expect(screen.getByRole('listbox')).toHaveClass('top-full');
  });

  it('la lista se abre hacia arriba si no entra debajo del campo', async () => {
    // El campo está pegado al borde de abajo de la ventana: debajo quedan 6px y arriba, todo lo demás.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, window.innerHeight - 40, 90, 34),
    );
    const usuario = userEvent.setup();
    render(<CampoDeHora inicial="18:00" />);

    await usuario.click(reloj());

    expect(screen.getByRole('listbox')).toHaveClass('bottom-full');
  });

  it('se nombra con la etiqueta y, por el id, con una label', () => {
    render(
      <>
        <label htmlFor="empieza">Empieza</label>
        <SelectorDeHora id="empieza" etiqueta="Hora de inicio" valor="18:00" alCambiar={() => {}} />
      </>,
    );

    expect(screen.getByRole('combobox', { name: 'Hora de inicio' })).toHaveValue('18:00');
    expect(screen.getByLabelText('Empieza')).toBe(screen.getByRole('combobox'));
  });
});
