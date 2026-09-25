import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { crearAlumnoSchema, type Alumno, type CrearAlumnoInput } from '@studio/shared';
import { AreaDeTexto, Aviso, Boton, Campo, Entrada } from '../../components/ui/index.tsx';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';

export function AlumnoForm({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: Alumno;
  alGuardar: (datos: CrearAlumnoInput) => Promise<unknown>;
  alCancelar: () => void;
}) {
  const formulario = useForm({
    resolver: zodResolver(crearAlumnoSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? '',
      apellido: inicial?.apellido ?? '',
      dni: inicial?.dni ?? '',
      email: inicial?.email ?? '',
      telefono: inicial?.telefono ?? '',
      fechaNacimiento: inicial?.fechaNacimiento ?? '',
      contactoEmergencia: inicial?.contactoEmergencia ?? '',
      notas: inicial?.notas ?? '',
    },
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await alGuardar(datos);
    } catch (error) {
      mostrarErrorDeApi(error, formulario.setError);
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      {errors.root?.message !== undefined && <Aviso>{errors.root.message}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" error={errors.nombre?.message}>
          {(id) => <Entrada id={id} {...formulario.register('nombre')} />}
        </Campo>
        <Campo etiqueta="Apellido" error={errors.apellido?.message}>
          {(id) => <Entrada id={id} {...formulario.register('apellido')} />}
        </Campo>
        <Campo etiqueta="DNI" error={errors.dni?.message}>
          {(id) => <Entrada id={id} inputMode="numeric" {...formulario.register('dni')} />}
        </Campo>
        <Campo etiqueta="Teléfono" error={errors.telefono?.message}>
          {(id) => <Entrada id={id} type="tel" {...formulario.register('telefono')} />}
        </Campo>
        <Campo etiqueta="Email" error={errors.email?.message}>
          {(id) => <Entrada id={id} type="email" {...formulario.register('email')} />}
        </Campo>
        <Campo etiqueta="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
          {(id) => <Entrada id={id} type="date" {...formulario.register('fechaNacimiento')} />}
        </Campo>
      </div>
      <Campo etiqueta="Contacto de emergencia" error={errors.contactoEmergencia?.message}>
        {(id) => <Entrada id={id} {...formulario.register('contactoEmergencia')} />}
      </Campo>
      <Campo etiqueta="Notas" error={errors.notas?.message}>
        {(id) => <AreaDeTexto id={id} {...formulario.register('notas')} />}
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={isSubmitting}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}
