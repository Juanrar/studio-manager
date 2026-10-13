import type { PropuestaDelAsistente, Rol } from '@studio/shared';
import type { FechaDia } from '../../lib/fechas.ts';
import { buscarProfesores, listarClasesDelRango } from './consultas.ts';
import type { DefinicionDeHerramienta } from './modelo.ts';
import { proponerAltaDeProfesor, proponerClaseUnica, proponerHorario } from './propuestas.ts';

export type ContextoDeHerramienta = { hoy: FechaDia };

// `resultado` vuelve al modelo. `propuesta` va a la web, que la muestra como tarjeta.
export type SalidaDeHerramienta = { resultado: Record<string, unknown>; propuesta?: PropuestaDelAsistente };

// Una herramienta lanza ZodError o un error de dominio cuando no puede: el service se lo pasa al modelo.
export type Herramienta = DefinicionDeHerramienta & {
  soloAdmin: boolean;
  ejecutar(argumentos: Record<string, unknown>, contexto: ContextoDeHerramienta): Promise<SalidaDeHerramienta>;
};

const TODAS: Herramienta[] = [buscarProfesores, listarClasesDelRango, proponerClaseUnica, proponerHorario, proponerAltaDeProfesor];

export function herramientasPara(rol: Rol): Herramienta[] {
  return TODAS.filter((herramienta) => rol === 'admin' || !herramienta.soloAdmin);
}
