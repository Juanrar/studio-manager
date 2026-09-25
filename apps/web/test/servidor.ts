import { setupServer } from 'msw/node';

// Servidor MSW compartido. Cada test registra con `servidor.use(...)` las respuestas que necesita.
export const servidor = setupServer();
