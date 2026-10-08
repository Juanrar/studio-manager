import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { crearHorarioSchema, type Horario, type CrearHorarioInput } from '@studio/shared';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Casilla,
  Celda,
  CeldaDeAcciones,
  Dialogo,
  Entrada,
  Insignia,
  Pagina,
  Selector,
  Tabla,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { DIAS_DE_LA_SEMANA, nombreDelDia } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useProfesores } from '../profesores/api.ts';
import { useActualizarHorario, useHorarios, useCrearHorario } from './api.ts';

export function HorariosPage() {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const horarios = useHorarios({ incluirInactivos });
  const crear = useCrearHorario();
  const actualizar = useActualizarHorario();
  const [editando, setEditando] = useState<Horario | 'nueva' | null>(null);

  // La API ya las devuelve ordenadas por día y hora; acá solo se agrupan por día.
  const porDia = Map.groupBy(horarios.data ?? [], (horario) => horario.diaSemana);

  return (
    <Pagina
      titulo="Horario de clases"
      acciones={<Boton onClick={() => setEditando('nueva')}>Nueva clase</Boton>}
      barra={
        <Casilla
          etiqueta="Mostrar clases dadas de baja"
          checked={incluirInactivos}
          onChange={(e) => setIncluirInactivos(e.target.checked)}
        />
      }
    >
      {horarios.isPending && <Cargando />}
      {horarios.isError && <Aviso>{mensajeDeError(horarios.error)}</Aviso>}
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      {horarios.data?.length === 0 && <p className="text-apagado">Todavía no hay clases en el horario.</p>}
      {[...porDia.entries()].map(([dia, delDia]) => (
        <div key={dia} className="mb-6">
          <h2 className="mb-2 text-base font-semibold">{nombreDelDia(dia)}</h2>
          <Tabla columnas={['Horario', 'Estilo', 'Nivel', 'Profesor titular', 'Estado', '']}>
            {delDia.map((horario) => (
              <tr key={horario.id}>
                <Celda>
                  {horario.horaInicio} a {horario.horaFin}
                </Celda>
                <Celda>{horario.estilo}</Celda>
                <Celda>{horario.nivel ?? '—'}</Celda>
                <Celda>
                  {horario.profesor.nombre} {horario.profesor.apellido}
                </Celda>
                <Celda>{horario.activo ? <Insignia tono="verde">Activa</Insignia> : <Insignia>Dada de baja</Insignia>}</Celda>
                <CeldaDeAcciones>
                  <Boton variante="secundario" onClick={() => setEditando(horario)}>
                    Editar
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => actualizar.mutate({ id: horario.id, datos: { activo: !horario.activo } })}
                  >
                    {horario.activo ? 'Dar de baja' : 'Reactivar'}
                  </Boton>
                </CeldaDeAcciones>
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
          <HorarioForm
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
    </Pagina>
  );
}

function HorarioForm({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial: Horario | undefined;
  alGuardar: (datos: CrearHorarioInput) => Promise<unknown>;
  alCancelar: () => void;
}) {
  const profesores = useProfesores();
  const formulario = useForm({
    resolver: zodResolver(crearHorarioSchema),
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
