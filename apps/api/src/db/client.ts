import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export function crearCliente(url: string) {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { sql, db };
}

const cliente = crearCliente(config.databaseUrl);

export const sql = cliente.sql;
export const db = cliente.db;
export type DrizzleDb = typeof db;
