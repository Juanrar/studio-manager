export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'mercado_pago', 'otro'] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ROLES = ['admin', 'recepcion'] as const;

export type Rol = (typeof ROLES)[number];
