import { z } from 'zod';
import { ROLES, type Rol } from './constantes.ts';

export const emailSchema = z.string().trim().toLowerCase().email('Email inválido');

const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio');
const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres');

export const crearUsuarioSchema = z.object({
  nombre: nombreSchema,
  email: emailSchema,
  password: passwordSchema,
  rol: z.enum(ROLES),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  nombre: nombreSchema.optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

export type UsuarioPublico = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
};
