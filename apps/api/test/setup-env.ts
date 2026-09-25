import { inject } from 'vitest';

// Corre antes de cada archivo de test: la app lee la configuración
// del entorno, así que se apunta al Postgres del contenedor.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.SESSION_SECRET ??= 'secreto-de-test-con-mas-de-treinta-y-dos-caracteres';
process.env.NODE_ENV = 'test';
