import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { crearClaseSchema, type Clase, type CrearClaseInput } from '@studio/shared';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Celda,
  Dialogo,
  Entrada,
  Insignia,
  Selector,
  Tabla,
  Titulo,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { DIAS_DE_LA_SEMANA, nombreDelDia } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useProfesores } from '../profesores/api.ts';
import { useActualizarClase, useClases, useCrearClase } from './api.ts';

export function ClasesPage() {
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const clases = useClases({ incluirInactivas });
  const crear = useCrearClase();
  const actualizar = useActualizarClase();
  const [editando, setEditando] = useState<Clase | 'nueva' | null>(null);

  // La API ya las devuelve ordenadas por día y hora; acá solo se agrupan por día.
  const porDia = Map.groupBy(clases.data ?? [], (clase) => clase.diaSemana);

  return (
    <section>
      <Titulo acciones={<Boton onClick={() => setEditando('nueva')}>Nueva clase</Boton>}>Horario de clases</Titulo>
      <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={incluirInactivas} onChange={(e) => setIncluirInactivas(e.target.checked)} />
        Mostrar clases dadas de baja
      </label>

      {clases.isPending && <Cargando />}
      {clases.isError && <Aviso>{mensajeDeError(clases.error)}</Aviso>}
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      {clases.data?.length === 0 && <p className="text-stone-500">Todavía no hay clases en el horario.</p>}
      {[...porDia.entries()].map(([dia, delDia]) => (
        <div key={dia} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{nombreDelDia(dia)}</h2>
          <Tabla columnas={['Horario', 'Estilo', 'Nivel', 'Profesor titular', 'Estado', '']}>
            {delDia.map((clase) => (
              <tr key={clase.id}>
                <Celda>
                  {clase.horaInicio} a {clase.horaFin}
                </Celda>
                <Celda>{clase.estilo}</Celda>
                <Celda>{clase.nivel ?? '—'}</Celda>
                <Celda>
                  {clase.profesor.nombre} {clase.profesor.apellido}
                </Celda>
                <Celda>{clase.activa ? <Insignia tono="verde">Activa</Insignia> : <Insignia>Dada de baja</Insignia>}</Celda>
                <Celda className="flex justify-end gap-2">
                  <Boton variante="secundario" onClick={() => setEditando(clase)}>
                    Editar
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => actualizar.mutate({ id: clase.id, datos: { activa: !clase.activa } })}
                  >
                    {clase.activa ? 'Dar de baja' : 'Reactivar'}
                  </Boton>
                </Celda>
              </tr>
            ))}
          </Tabla>
        </div>
      ))}

      <Dialogo
        titulo={editando === 'nueva' ? 'Nueva clase' : 'Editar clase'}
        abierto={editando !== null}
        alCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <ClaseForm
            inicial={editando === 'nueva' ? undefined : editando}
            alGuardar={async (datos) => {
              if (editando === 'nueva') await crear.mutateAsync(datos);
              else await actualizar.mutateAsync({ id: editando.id, datos });
              setEditando(null);
            }}
            alCancelar={() => setEditando(null)}
          />
        )}
      </Dialogo>
    </section>
  );
}

function ClaseForm({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial: Clase | undefined;
  alGuardar: (datos: CrearClaseInput) => Promise<unknown>;
  alCancelar: () => void;
}) {
  const profesores = useProfesores();
  const formulario = useForm({
    resolver: zodResolver(crearClaseSchema),
    defaultValues: {
      estilo: inicial?.estilo ?? '',
      nivel: inicial?.nivel ?? '',
      diaSemana: inicial?.diaSemana ?? 1,
      horaInicio: inicial?.horaInicio ?? '',
      horaFin: inicial?.horaFin ?? '',
      profesorId: inicial?.profesor.id ?? Number.NaN,
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
        <Campo etiqueta="Estilo" error={errors.estilo?.message}>
          {(id) => <Entrada id={id} {...formulario.register('estilo')} />}
        </Campo>
        <Campo etiqueta="Nivel" error={errors.nivel?.message}>
          {(id) => <Entrada id={id} placeholder="Inicial, Intermedio…" {...formulario.register('nivel')} />}
        </Campo>
        <Campo etiqueta="Día" error={errors.diaSemana?.message}>
          {(id) => (
            // El valor es el número ISO del día: lunes 1, domingo 7, igual que la API.
            <Selector id={id} {...formulario.register('diaSemana', { valueAsNumber: true })}>
              {DIAS_DE_LA_SEMANA.map((nombre, indice) => (
                <option key={nombre} value={indice + 1}>
                  {nombre}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo etiqueta="Profesor titular" error={errors.profesorId?.message}>
          {(id) => (
            <Selector id={id} {...formulario.register('profesorId', { valueAsNumber: true })}>
              <option value="">Elegí un profesor</option>
              {profesores.data?.map((profesor) => (
                <option key={profesor.id} value={profesor.id}>
                  {profesor.nombre} {profesor.apellido}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo etiqueta="Empieza" error={errors.horaInicio?.message}>
          {(id) => <Entrada id={id} type="time" {...formulario.register('horaInicio')} />}
        </Campo>
        <Campo etiqueta="Termina" error={errors.horaFin?.message}>
          {(id) => <Entrada id={id} type="time" {...formulario.register('horaFin')} />}
        </Campo>
      </div>
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
