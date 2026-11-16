import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { GlobalSetupContext } from 'vitest/node';

export default async function ({ provide }: GlobalSetupContext) {
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
