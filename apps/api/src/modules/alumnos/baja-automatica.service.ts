import { config } from '../../config.ts';
import { db } from '../../db/client.ts';
import { hoyEnEstudio, type FechaDia } from '../../lib/fechas.ts';
import { comprasDeAlumnos } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';
import { correspondeBajaAutomatica } from './baja-automatica.ts';

// Da de baja a los alumnos activos que pasaron 2 meses sin comprar y devuelve a quiénes. La baja queda
// registrada sin usuario: la hizo el sistema. Vive fuera de alumnos.service porque usa pagos.service,
// que ya usa alumnos.service.
export async function darDeBajaPorNoComprar(ahora: Date, hoy: FechaDia): Promise<number[]> {
  const activos = await repo.listarActivosParaBaja(db);
  const compras = await comprasDeAlumnos(activos.map((alumno) => alumno.id), hoy);

  const aDarDeBaja = activos
    .filter((alumno) => {
      const delAlumno = compras.get(alumno.id);
      return correspondeBajaAutomatica(
        {
          // Una reactivación siempre es posterior al alta.
          activoDesde: hoyEnEstudio(alumno.reactivadoEn ?? alumno.creadoEn, config.tzEstudio),
          ultimaCompra: delAlumno?.ultimaCompra ?? null,
          tienePackSinVencer: delAlumno?.tienePackSinVencer ?? false,
        },
        hoy,
      );
    })
    .map((alumno) => alumno.id);
  if (aDarDeBaja.length === 0) return [];

  return db.transaction(async (tx) => {
    const dados = await repo.darDeBaja(tx, aDarDeBaja);
    await repo.registrarCambiosDeEstado(
      tx,
      dados.map((alumnoId) => ({ alumnoId, activo: false, registradoPor: null, registradoEn: ahora })),
    );
    return dados;
  });
}
