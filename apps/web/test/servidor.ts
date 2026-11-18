import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Por defecto el asistente está configurado, así la solapa aparece. Un test que pruebe lo contrario la reemplaza.
export const servidor = setupServer(
  http.get('/api/asistente/disponible', () => HttpResponse.json({ disponible: true })),
);
