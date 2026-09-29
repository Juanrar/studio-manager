export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'mercado_pago', 'otro'] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ROLES = ['admin', 'recepcion'] as const;

export type Rol = (typeof ROLES)[number];

// Pedido del estudio: pasa a baja quien lleva estos meses sin comprar un pack. Lo usan la regla de la
// API y el texto de la actividad.
export const MESES_SIN_COMPRAR = 2;
