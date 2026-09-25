import { z } from 'zod';

export type Listado<T> = {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
};

export const listadoQuerySchema = z.object({
  q: z.string().trim().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  // z.coerce.boolean convierte 'false' en true, así que se compara el texto.
  incluirInactivos: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

export type ListadoQuery = z.infer<typeof listadoQuerySchema>;

export const fechaDiaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que tener el formato AAAA-MM-DD')
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  }, 'La fecha no existe');

// Los campos opcionales aceptan '' (un input vacío del formulario) y lo guardan como null.
const vacioANull = <T>(valor: T | '' | null | undefined): T | null | undefined =>
  valor === '' ? null : valor;

export const textoOpcional = z.string().trim().nullable().optional().transform(vacioANull);

export const emailOpcional = z
  .union([z.literal(''), z.string().trim().toLowerCase().email('Email inválido')])
  .nullable()
  .optional()
  .transform(vacioANull);

export const fechaOpcional = z
  .union([z.literal(''), fechaDiaSchema])
  .nullable()
  .optional()
  .transform(vacioANull);

export const dniOpcional = z
  .union([z.literal(''), z.string().trim().regex(/^\d{6,9}$/, 'El DNI tiene que tener entre 6 y 9 números')])
  .nullable()
  .optional()
  .transform(vacioANull);

export const nombreSchema = z.string().trim().min(1, 'Es obligatorio');

export const precioSchema = z
  .number({ invalid_type_error: 'El precio tiene que ser un número' })
  .int('El precio es en pesos enteros, sin centavos')
  .min(0, 'El precio no puede ser negativo');
