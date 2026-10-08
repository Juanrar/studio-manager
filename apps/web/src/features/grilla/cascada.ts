// Cómo se dibujan las clases que se superponen en un día, como en DayFlow y Google Calendar: si dos
// empiezan con menos de 30 minutos de diferencia van lado a lado (carriles); si una empieza más tarde,
// se dibuja encima de la que sigue corriendo, corrida a la derecha (sangría).

export type ClaseParaAcomodar = { id: number; fecha: string; inicio: number; fin: number };
export type Lugar = { sangria: number; carril: number; carriles: number };

const LADO_A_LADO = 30;

export function acomodarEnCascada(clases: ClaseParaAcomodar[]): Map<number, Lugar> {
  const lugares = new Map<number, Lugar>();
  // Por día, después por hora; la más larga primero, así queda debajo.
  const ordenadas = [...clases].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio || b.fin - a.fin,
  );
  const grupos: ClaseParaAcomodar[][] = [];
  const grupoDe = new Map<number, ClaseParaAcomodar[]>();
  const ubicadas: ClaseParaAcomodar[] = [];

  for (const clase of ordenadas) {
    const corriendo = ubicadas.filter((otra) => otra.fecha === clase.fecha && otra.fin > clase.inicio);
    const cerca = corriendo.find((otra) => clase.inicio - otra.inicio < LADO_A_LADO);
    if (cerca) {
      const grupo = grupoDe.get(cerca.id)!;
      grupo.push(clase);
      grupoDe.set(clase.id, grupo);
      lugares.set(clase.id, { sangria: lugares.get(cerca.id)!.sangria, carril: 0, carriles: 1 });
    } else {
      const grupo = [clase];
      grupos.push(grupo);
      grupoDe.set(clase.id, grupo);
      const sangria = corriendo.length === 0 ? 0 : Math.max(...corriendo.map((otra) => lugares.get(otra.id)!.sangria)) + 1;
      lugares.set(clase.id, { sangria, carril: 0, carriles: 1 });
    }
    ubicadas.push(clase);
  }

  for (const grupo of grupos) {
    grupo.forEach((clase, indice) => Object.assign(lugares.get(clase.id)!, { carril: indice, carriles: grupo.length }));
  }
  return lugares;
}
