import { buildApp } from './app.ts';
import { config } from './config.ts';

const app = buildApp({ directorioWeb: config.directorioWeb });

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
