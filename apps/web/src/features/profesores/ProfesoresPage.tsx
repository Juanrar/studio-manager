import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearProfesorSchema, porcentajeBpSchema, type Profesor } from '@studio/shared';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Celda,
  Dialogo,
  Entrada,
  Insignia,
  Tabla,
  Titulo,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha, formatearPorcentaje, textoAPorcentajeBp } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import {
  useActualizarProfesor,
  useAgregarPorcentaje,
  useCrearProfesor,
  usePorcentajes,
  useProfesores,
} from './api.ts';

// El porcentaje se escribe como "52,5" y se manda en puntos básicos (5250).
const porcentajeEscritoSchema = z.string().transform((texto, contexto) => {
  const resultado = porcentajeBpSchema.safeParse(textoAPorcentajeBp(texto));
  if (!resultado.success) {
    contexto.addIssue({ code: 'custom', message: 'Escribí un porcentaje entre 0,01 y 100' });
    return z.NEVER;
  }
  return resultado.data;
});

const datosProfesorSchema = crearProfesorSchema.omit({ porcentajeBp: true });
const nuevoProfesorSchema = datosProfesorSchema.extend({ porcentaje: porcentajeEscritoSchema });

export function ProfesoresPage() {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const profesores = useProfesores({ incluirInactivos });
  const actualizar = useActualizarProfesor();
  const [editando, setEditando] = useState<Profesor | 'nuevo' | null>(null);
  const [verPorcentajes, setVerPorcentajes] = useState<Profesor | null>(null);

  return (
    <section>
      <Titulo acciones={<Boton onClick={() => setEditando('nuevo')}>Nuevo profesor</Boton>}>Profesores</Titulo>
      <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} />
        Mostrar dados de baja
      </label>

      {profesores.isPending && <Cargando />}
      {profesores.isError && <Aviso>{mensajeDeError(profesores.error)}</Aviso>}
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      {profesores.data && (
        <Tabla columnas={['Profesor', 'Alias o CBU', 'Teléfono', 'Porcentaje', 'Estado', '']}>
          {profesores.data.map((profesor) => (
            <tr key={profesor.id}>
              <Celda>
                {profesor.apellido}, {profesor.nombre}
              </Celda>
              <Celda>{profesor.aliasCbu ?? '—'}</Celda>
              <Celda>{profesor.telefono ?? '—'}</Celda>
              <Celda>
                {profesor.porcentajeVigenteBp === null ? '—' : formatearPorcentaje(profesor.porcentajeVigenteBp)}
              </Celda>
              <Celda>{profesor.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia>Dado de baja</Insignia>}</Celda>
              <Celda className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => setVerPorcentajes(profesor)}>
                  Porcentajes
                </Boton>
                <Boton variante="secundario" onClick={() => setEditando(profesor)}>
                  Editar
                </Boton>
                <Boton
                  variante="secundario"
                  onClick={() => actualizar.mutate({ id: profesor.id, datos: { activo: !profesor.activo } })}
                >
                  {profesor.activo ? 'Dar de baja' : 'Reactivar'}
                </Boton>
              </Celda>
            </tr>
          ))}
        </Tabla>
      )}

      <Dialogo
        titulo={editando === 'nuevo' ? 'Nuevo profesor' : 'Editar profesor'}
        abierto={editando !== null}
        alCerrar={() => setEditando(null)}
      >
        {editando === 'nuevo' && <NuevoProfesorForm alTerminar={() => setEditando(null)} />}
        {editando !== null && editando !== 'nuevo' && (
          <EditarProfesorForm profesor={editando} alTerminar={() => setEditando(null)} />
        )}
      </Dialogo>

      <Dialogo
        titulo={verPorcentajes === null ? '' : `Porcentajes de ${verPorcentajes.nombre} ${verPorcentajes.apellido}`}
        abierto={verPorcentajes !== null}
        alCerrar={() => setVerPorcentajes(null)}
      >
        {verPorcentajes !== null && <HistorialDePorcentajes profesorId={verPorcentajes.id} />}
      </Dialogo>
    </section>
  );
}

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

function NuevoProfesorForm({ alTerminar }: { alTerminar: () => void }) {
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

function EditarProfesorForm({ profesor, alTerminar }: { profesor: Profesor; alTerminar: () => void }) {
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

const nuevoPorcentajeFormSchema = z.object({
  porcentaje: porcentajeEscritoSchema,
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí la fecha desde la que vale'),
});

function HistorialDePorcentajes({ profesorId }: { profesorId: number }) {
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
        <ul className="text-sm">
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
