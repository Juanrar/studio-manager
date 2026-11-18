import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraApilada, BarrasConLinea } from '../Graficos.tsx';

const DATOS = [
  { etiqueta: '1 mar', barra: 4, linea: 0 },
  { etiqueta: '2 mar', barra: 2, linea: 3000 },
  { etiqueta: '3 mar', barra: 0, linea: 1500 },
];

function dibujarBarras() {
  render(
    <BarrasConLinea
      etiqueta="Actividad por día"
      datos={DATOS}
      unidadBarra="asistencias"
      textoLinea={(valor) => `$${valor} cobrados`}
    />,
  );
}

describe('BarrasConLinea', () => {
  it('dibuja una barra por dato con su valor en el título accesible', () => {
    dibujarBarras();

    expect(screen.getByRole('group', { name: 'Actividad por día' })).toBeInTheDocument();
    expect(screen.getByText('1 mar: 4 asistencias')).toBeInTheDocument();
    expect(screen.getByText('2 mar: 2 asistencias')).toBeInTheDocument();
    expect(screen.getByText('3 mar: 0 asistencias')).toBeInTheDocument();
  });

  it('escala las barras al máximo y deja en 0 la del día sin asistencias', () => {
    dibujarBarras();

    const alturas = DATOS.map((dato) =>
      screen.getByText(`${dato.etiqueta}: ${dato.barra} asistencias`).parentElement!.getAttribute('height'),
    );
    expect(alturas).toEqual(['144', '72', '0']);
  });

  it('dibuja la línea con su propia escala y un punto con título por día', () => {
    const { container } = render(
      <BarrasConLinea
        etiqueta="Actividad por día"
        datos={DATOS}
        unidadBarra="asistencias"
        textoLinea={(valor) => `$${valor} cobrados`}
      />,
    );

    expect(container.querySelector('polyline')).toHaveAttribute('points', '100,152 300,8 500,80');
    expect(screen.getByText('1 mar: $0 cobrados')).toBeInTheDocument();
    expect(screen.getByText('2 mar: $3000 cobrados')).toBeInTheDocument();
    expect(screen.getByText('3 mar: $1500 cobrados')).toBeInTheDocument();
  });

  it('con todo en 0 no produce alturas negativas ni NaN', () => {
    const { container } = render(
      <BarrasConLinea
        etiqueta="Vacío"
        datos={[{ etiqueta: '1 mar', barra: 0, linea: 0 }]}
        unidadBarra="asistencias"
        textoLinea={(valor) => `$${valor}`}
      />,
    );

    expect(container.querySelector('rect')).toHaveAttribute('height', '0');
    expect(container.querySelector('polyline')).toHaveAttribute('points', '300,152');
  });
});

describe('BarraApilada', () => {
  it('dibuja un segmento por tramo con su valor, proporcional al total', () => {
    const { container } = render(
      <BarraApilada
        etiqueta="Estado de los alumnos"
        segmentos={[
          { etiqueta: 'Al día', valor: 6, tono: 'verde' },
          { etiqueta: 'Por vencer', valor: 2, tono: 'ambar' },
          { etiqueta: 'Sin renovar', valor: 0, tono: 'rojo' },
          { etiqueta: 'Sin pack', valor: 2, tono: 'neutro' },
        ]}
      />,
    );

    expect(screen.getByRole('group', { name: 'Estado de los alumnos' })).toBeInTheDocument();
    const anchos = [...container.querySelectorAll('rect')].map((rect) => rect.getAttribute('width'));
    expect(anchos).toEqual(['600', '360', '120', '0', '120']);
    expect(screen.getByText('Al día: 6', { selector: 'title' })).toBeInTheDocument();
    expect(screen.getByText('Sin renovar: 0', { selector: 'title' })).toBeInTheDocument();
  });
});
