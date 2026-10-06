import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Boton, Campo, Cargando, Entrada } from '../../components/ui/index.tsx';
import { formatearFecha, formatearPorcentaje } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useAgregarPorcentaje, usePorcentajes } from './api.ts';
import { porcentajeEscritoSchema } from './ProfesorForm.tsx';

const nuevoPorcentajeFormSchema = z.object({
  porcentaje: porcentajeEscritoSchema,
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí la fecha desde la que vale'),
});

export function HistorialDePorcentajes({ profesorId }: { profesorId: number }) {
  const porcentajes = usePorcentajes(profesorId);
  const agregar = useAgregarPorcentaje(profesorId);
  const formulario = useForm({
    resolver: zodResolver(nuevoPorcentajeFormSchema),
    defaultValues: { porcentaje: '', vigenteDesde: '' },
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async ({ porcentaje, vigenteDesde }) => {
    try {
      await agregar.mutateAsync({ porcentajeBp: porcentaje, vigenteDesde });
      formulario.reset();
    } catch (error) {
      mostrarErrorDeApi(error, formulario.setError);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {porcentajes.isPending && <Cargando />}
      {porcentajes.data && (
        <ul>
          {porcentajes.data.map((porcentaje) => (
            <li key={porcentaje.id}>
              {formatearPorcentaje(porcentaje.porcentajeBp)} desde el {formatearFecha(porcentaje.vigenteDesde)}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        {errors.root?.message !== undefined && <Aviso>{errors.root.message}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nuevo porcentaje (%)" error={errors.porcentaje?.message}>
            {(id) => <Entrada id={id} inputMode="decimal" {...formulario.register('porcentaje')} />}
          </Campo>
          <Campo etiqueta="Vigente desde" error={errors.vigenteDesde?.message}>
            {(id) => <Entrada id={id} type="date" {...formulario.register('vigenteDesde')} />}
          </Campo>
        </div>
        <div className="flex justify-end">
          <Boton type="submit" disabled={isSubmitting}>
            Agregar
          </Boton>
        </div>
      </form>
    </div>
  );
}
