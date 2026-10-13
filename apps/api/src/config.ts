import { z } from 'zod';

const esquema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  TZ_ESTUDIO: z.string().default('America/Argentina/Buenos_Aires'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Carpeta del frontend compilado. Solo en producción: en desarrollo lo sirve Vite.
  WEB_DIST: z.string().min(1).optional(),
  // Sin clave, el asistente responde 503. Los modelos se pueden cambiar sin tocar código.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODELO: z.string().min(1).default('gemini-3.5-flash'),
  GEMINI_MODELO_RESPALDO: z.string().min(1).default('gemini-3.1-flash-lite'),
});

const parseado = esquema.safeParse(process.env);

if (!parseado.success) {
  const detalle = parseado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variables de entorno inválidas:\n${detalle}`);
}

export const config = {
  databaseUrl: parseado.data.DATABASE_URL,
  sessionSecret: parseado.data.SESSION_SECRET,
  tzEstudio: parseado.data.TZ_ESTUDIO,
  port: parseado.data.PORT,
  nodeEnv: parseado.data.NODE_ENV,
  directorioWeb: parseado.data.WEB_DIST,
  gemini: {
    clave: parseado.data.GEMINI_API_KEY,
    modelo: parseado.data.GEMINI_MODELO,
    respaldo: parseado.data.GEMINI_MODELO_RESPALDO,
  },
};
