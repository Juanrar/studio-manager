// Crea el primer usuario admin. Uso:
//   ADMIN_PASSWORD='...' pnpm --filter @studio/api usuario:admin <email> "<nombre>"
// La contraseña va por variable de entorno para que no quede en el historial de la terminal.
import { crearUsuarioSchema } from '@studio/shared';
import { sql } from '../db/client.ts';
import { crearUsuario } from '../modules/usuarios/usuarios.service.ts';

const [email, nombre] = process.argv.slice(2);

const datos = crearUsuarioSchema.safeParse({
  email,
  nombre,
  password: process.env.ADMIN_PASSWORD,
  rol: 'admin',
});

if (!datos.success) {
  console.error('Datos inválidos:');
  for (const issue of datos.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nUso: ADMIN_PASSWORD=... pnpm --filter @studio/api usuario:admin <email> "<nombre>"');
  process.exitCode = 1;
} else {
  try {
    const admin = await crearUsuario(datos.data);
    console.log(`Admin creado: ${admin.nombre} <${admin.email}> (id ${admin.id})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await sql.end();
