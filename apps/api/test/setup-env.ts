import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.SESSION_SECRET ??= 'secreto-de-test-con-mas-de-treinta-y-dos-caracteres';
process.env.NODE_ENV = 'test';
