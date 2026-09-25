import { count } from 'drizzle-orm';
import { db, sql as cliente } from './client.ts';
import { pack } from './schema.ts';

// Precios de ejemplo en pesos enteros. El administrador los cambia desde la aplicación.
const PACKS = [
  { nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 },
  { nombre: 'Pack x4', cantidadClases: 4, precio: 5200 },
  { nombre: 'Pack x8', cantidadClases: 8, precio: 9600 },
  { nombre: 'Pack x16', cantidadClases: 16, precio: 17_600 },
];

const [existentes] = await db.select({ total: count() }).from(pack);

if ((existentes?.total ?? 0) > 0) {
  console.log(`Ya hay ${existentes?.total} packs cargados. No se insertó nada.`);
} else {
  const insertados = await db.insert(pack).values(PACKS).returning();
  console.log(`Packs insertados: ${insertados.length}`);
}

await cliente.end();
