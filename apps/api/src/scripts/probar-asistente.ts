// Prueba el asistente contra Gemini con frases reales. Gasta cuota del plan gratuito. Uso:
//   pnpm --filter @studio/api asistente:probar [número de frase ...]
// Sin argumentos corre todas. Solo lee la base de desarrollo: toma el primer profesor activo.
import type { Rol } from '@studio/shared';
import { config } from '../config.ts';
import { sql } from '../db/client.ts';
import { ServicioNoDisponibleError } from '../lib/errores.ts';
import { hoyEnEstudio } from '../lib/fechas.ts';
import { conversar } from '../modules/asistente/asistente.service.ts';
import { crearModeloGemini } from '../modules/asistente/gemini.ts';
import { listarProfesores } from '../modules/profesores/profesores.service.ts';

type Frase = { texto: string; rol: Rol; esperado: string };

const frases: Frase[] = [
  { texto: 'Creame una clase de 8 a 9:30 con {profesor}', rol: 'admin', esperado: 'Pregunta el día, el estilo y si se repite. Sin propuesta' },
  { texto: 'Creame un workshop de Hip-Hop el sábado de 15 a 17 con {profesor}', rol: 'admin', esperado: 'Propuesta claseUnica para el próximo sábado' },
  { texto: '{profesor} va a dar Salsa todos los jueves de 20 a 21', rol: 'admin', esperado: 'Propuesta horario con diaSemana 4' },
  { texto: '¿Qué clases hay mañana?', rol: 'admin', esperado: 'Lista las clases de mañana o dice que no hay' },
  { texto: 'Creame una clase de Jazz ayer a las 10 con {profesor}', rol: 'admin', esperado: 'Explica que esa fecha ya pasó. Sin propuesta' },
  { texto: 'Creame una clase con Zzz Inexistente el lunes a las 10', rol: 'admin', esperado: 'Dice que no encuentra al profesor' },
  { texto: 'Creame un workshop de Hip-Hop el sábado de 15 a 17 con {profesor}', rol: 'recepcion', esperado: 'Dice que lo tiene que hacer un administrador' },
];

try {
  if (!config.gemini.clave) {
    throw new Error('Falta GEMINI_API_KEY en apps/api/.env');
  }
  const hoy = hoyEnEstudio(new Date(), config.tzEstudio);
  const profesores = await listarProfesores(false, hoy);
  const profesor = profesores.find((p) => p.activo);
  if (!profesor) {
    throw new Error('La base de desarrollo no tiene ningún profesor activo: cargá uno antes de probar.');
  }
  const nombreProfesor = `${profesor.nombre} ${profesor.apellido}`;

  const numeros = process.argv.slice(2).map(Number);
  const modelo = crearModeloGemini({
    clave: config.gemini.clave,
    modelo: config.gemini.modelo,
    respaldo: config.gemini.respaldo,
  });

  console.log(`Modelo: ${config.gemini.modelo} (respaldo ${config.gemini.respaldo}). Hoy: ${hoy}. Profesor: ${nombreProfesor}\n`);

  for (const [indice, frase] of frases.entries()) {
    const numero = indice + 1;
    if (numeros.length > 0 && !numeros.includes(numero)) continue;
    const mensaje = frase.texto.replaceAll('{profesor}', nombreProfesor);
    console.log(`--- Frase ${numero} (${frase.rol}): ${mensaje}`);
    console.log(`Esperado: ${frase.esperado}`);
    try {
      const respuesta = await conversar(modelo, { historial: [], mensaje }, { hoy, rol: frase.rol });
      console.log(`Texto: ${respuesta.texto}`);
      console.log(`Propuestas: ${JSON.stringify(respuesta.propuestas, null, 2)}\n`);
    } catch (error) {
      if (error instanceof ServicioNoDisponibleError) {
        console.log(`Servicio no disponible: ${error.codigo}\n`);
      } else {
        throw error;
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

await sql.end();
