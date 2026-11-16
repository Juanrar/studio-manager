import { execSync } from 'node:child_process';
import postgres from 'postgres';
import { ADMIN_E2E, BASE_E2E, SERVIDOR_POSTGRES, URL_BASE_E2E } from './entorno.ts';

const servidor = postgres(`${SERVIDOR_POSTGRES}/postgres`, { max: 1, onnotice: () => {} });
await servidor.unsafe(`drop database if exists ${BASE_E2E} with (force)`);
await servidor.unsafe(`create database ${BASE_E2E}`);
await servidor.end();

const entorno = { ...process.env, DATABASE_URL: URL_BASE_E2E, ADMIN_PASSWORD: ADMIN_E2E.password };
const enApi = (comando: string) => execSync(comando, { cwd: '../apps/api', env: entorno, stdio: 'inherit' });

enApi('pnpm db:migrate');
enApi('pnpm db:seed');
enApi(`pnpm usuario:admin ${ADMIN_E2E.email} "${ADMIN_E2E.nombre}"`);
execSync('pnpm --filter @studio/web build', { cwd: '..', stdio: 'inherit' });
