import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraApilada, Barras, BarrasConLinea } from '../Graficos.tsx';

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
  it('dibuja una barra por dato con las asistencias y lo cobrado en el título accesible', () => {
    dibujarBarras();

    expect(screen.getByRole('group', { name: 'Actividad por día' })).toBeInTheDocument();
    expect(screen.getByText('1 mar: 4 asistencias, $0 cobrados')).toBeInTheDocument();
    expect(screen.getByText('2 mar: 2 asistencias, $3000 cobrados')).toBeInTheDocument();
    expect(screen.getByText('3 mar: 0 asistencias, $1500 cobrados')).toBeInTheDocument();
  });

  it('escala las barras al máximo y deja en 0 la del día sin asistencias', () => {
    dibujarBarras();

    const alturas = ['1 mar: 4 asistencias, $0 cobrados', '2 mar: 2 asistencias, $3000 cobrados', '3 mar: 0 asistencias, $1500 cobrados'].map(
      (titulo) => screen.getByText(titulo).parentElement!.getAttribute('height'),
    );
    expect(alturas).toEqual(['144', '72', '0']);
  });

  it('dibuja la línea fina con su propia escala y sin puntos', () => {
    const { container } = render(
      <BarrasConLinea
        etiqueta="Actividad por día"
        datos={DATOS}
        unidadBarra="asistencias"
        textoLinea={(valor) => `$${valor} cobrados`}
      />,
    );

    const linea = container.querySelector('polyline');
    expect(linea).toHaveAttribute('points', '100,152 300,8 500,80');
    expect(linea).toHaveAttribute('stroke-width', '1.5');
    expect(linea).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(container.querySelectorAll('circle')).toHaveLength(0);
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

describe('Barras', () => {
  it('dibuja una barra por dato con su valor en el título y escala al máximo', () => {
    render(
      <Barras
        etiqueta="Sueldo por mes"
        datos={[
          { etiqueta: 'Enero 2026', barra: 1000 },
          { etiqueta: 'Febrero 2026', barra: 4000 },
          { etiqueta: 'Marzo 2026', barra: 0 },
        ]}
        textoBarra={(valor) => `$${valor}`}
      />,
    );

    expect(screen.getByRole('group', { name: 'Sueldo por mes' })).toBeInTheDocument();
    const alturas = ['Enero 2026: $1000', 'Febrero 2026: $4000', 'Marzo 2026: $0'].map((titulo) =>
      screen.getByText(titulo).parentElement!.getAttribute('height'),
    );
    expect(alturas).toEqual(['36', '144', '0']);
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
