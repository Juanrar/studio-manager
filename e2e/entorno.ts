// Constantes compartidas entre la preparación y Playwright.
export const BASE_E2E = 'studio_manager_e2e';
export const SERVIDOR_POSTGRES = 'postgres://studio:studio@127.0.0.1:5433';
export const URL_BASE_E2E = `${SERVIDOR_POSTGRES}/${BASE_E2E}`;
export const PUERTO_E2E = 3100;

export const ADMIN_E2E = { email: 'e2e@estudio.test', password: 'clave-e2e-segura', nombre: 'Admin E2E' };
