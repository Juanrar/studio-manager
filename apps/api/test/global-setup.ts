import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { GlobalSetupContext } from 'vitest/node';

// Un solo Postgres por corrida de tests. Los archivos corren en serie
// (fileParallelism: false) y cada uno limpia las tablas antes de cada test.
export default async function ({ provide }: GlobalSetupContext) {
  // En Windows, testcontainers resuelve localhost a ::1 y Docker Desktop
  // publica los puertos solo en IPv4. Se fuerza IPv4 salvo que ya venga definido.
  process.env.TESTCONTAINERS_HOST_OVERRIDE ??= '127.0.0.1';

  const contenedor = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = contenedor.getConnectionUri();

  const cliente = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(cliente), { migrationsFolder: './src/db/migrations' });
  await cliente.end();

  provide('databaseUrl', url);

  return async () => {
    await contenedor.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
