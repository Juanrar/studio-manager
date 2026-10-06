import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearProfesorSchema, porcentajeBpSchema, type Profesor } from '@studio/shared';
import { Aviso, Boton, Campo, Entrada } from '../../components/ui/index.tsx';
import { textoAPorcentajeBp } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useActualizarProfesor, useCrearProfesor } from './api.ts';

// El porcentaje se escribe como "52,5" y se manda en puntos básicos (5250).
export const porcentajeEscritoSchema = z.string().transform((texto, contexto) => {
  const resultado = porcentajeBpSchema.safeParse(textoAPorcentajeBp(texto));
  if (!resultado.success) {
    contexto.addIssue({ code: 'custom', message: 'Escribí un porcentaje entre 0,01 y 100' });
    return z.NEVER;
  }
  return resultado.data;
});

const datosProfesorSchema = crearProfesorSchema.omit({ porcentajeBp: true });
const nuevoProfesorSchema = datosProfesorSchema.extend({ porcentaje: porcentajeEscritoSchema });

type CamposPersonales = 'nombre' | 'apellido' | 'dni' | 'email' | 'telefono' | 'aliasCbu';

const CAMPOS_PERSONALES: { campo: CamposPersonales; etiqueta: string }[] = [
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'apellido', etiqueta: 'Apellido' },
  { campo: 'dni', etiqueta: 'DNI' },
  { campo: 'telefono', etiqueta: 'Teléfono' },
  { campo: 'email', etiqueta: 'Email' },
  { campo: 'aliasCbu', etiqueta: 'Alias o CBU' },
];

function valoresIniciales(profesor?: Profesor) {
  return {
    nombre: profesor?.nombre ?? '',
    apellido: profesor?.apellido ?? '',
    dni: profesor?.dni ?? '',
    email: profesor?.email ?? '',
    telefono: profesor?.telefono ?? '',
    aliasCbu: profesor?.aliasCbu ?? '',
  };
}

export function NuevoProfesorForm({ alTerminar }: { alTerminar: () => void }) {
  const crear = useCrearProfesor();
  const formulario = useForm({
    resolver: zodResolver(nuevoProfesorSchema),
    defaultValues: { ...valoresIniciales(), porcentaje: '' },
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async ({ porcentaje, ...personales }) => {
    try {
      await crear.mutateAsync({ ...personales, porcentajeBp: porcentaje });
      alTerminar();
    } catch (error) {
      mostrarErrorDeApi(error, formulario.setError);
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      {errors.root?.message !== undefined && <Aviso>{errors.root.message}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS_PERSONALES.map(({ campo, etiqueta }) => (
          <Campo key={campo} etiqueta={etiqueta} error={errors[campo]?.message}>
            {(id) => <Entrada id={id} {...formulario.register(campo)} />}
          </Campo>
        ))}
        <Campo etiqueta="Porcentaje por alumno (%)" error={errors.porcentaje?.message}>
          {(id) => <Entrada id={id} inputMode="decimal" placeholder="50" {...formulario.register('porcentaje')} />}
        </Campo>
      </div>
      <BotonesDeFormulario enviando={isSubmitting} alCancelar={alTerminar} />
    </form>
  );
}

export function EditarProfesorForm({ profesor, alTerminar }: { profesor: Profesor; alTerminar: () => void }) {
  const actualizar = useActualizarProfesor();
  const formulario = useForm({
    resolver: zodResolver(datosProfesorSchema),
    defaultValues: valoresIniciales(profesor),
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await actualizar.mutateAsync({ id: profesor.id, datos });
      alTerminar();
    } catch (error) {
      mostrarErrorDeApi(error, formulario.setError);
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      {errors.root?.message !== undefined && <Aviso>{errors.root.message}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS_PERSONALES.map(({ campo, etiqueta }) => (
          <Campo key={campo} etiqueta={etiqueta} error={errors[campo]?.message}>
            {(id) => <Entrada id={id} {...formulario.register(campo)} />}
          </Campo>
        ))}
      </div>
      <BotonesDeFormulario enviando={isSubmitting} alCancelar={alTerminar} />
    </form>
  );
}

function BotonesDeFormulario({ enviando, alCancelar }: { enviando: boolean; alCancelar: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Boton variante="secundario" onClick={alCancelar}>
        Cancelar
      </Boton>
      <Boton type="submit" disabled={enviando}>
        Guardar
      </Boton>
    </div>
  );
}
