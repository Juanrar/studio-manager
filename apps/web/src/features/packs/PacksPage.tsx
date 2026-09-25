import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { crearPackSchema, type CrearPackInput, type Pack } from '@studio/shared';
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
import { formatearPesos } from '../../lib/formato.ts';
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useActualizarPack, useCrearPack, usePacks } from './api.ts';

export function PacksPage() {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const packs = usePacks({ incluirInactivos });
  const crear = useCrearPack();
  const actualizar = useActualizarPack();
  const [editando, setEditando] = useState<Pack | 'nuevo' | null>(null);

  return (
    <section>
      <Titulo acciones={<Boton onClick={() => setEditando('nuevo')}>Nuevo pack</Boton>}>Packs</Titulo>
      <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} />
        Mostrar los que ya no se venden
      </label>

      {packs.isPending && <Cargando />}
      {packs.isError && <Aviso>{mensajeDeError(packs.error)}</Aviso>}
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      {packs.data && (
        <Tabla columnas={['Pack', 'Clases', 'Precio', 'Estado', '']}>
          {packs.data.map((pack) => (
            <tr key={pack.id}>
              <Celda>{pack.nombre}</Celda>
              <Celda>{pack.cantidadClases}</Celda>
              <Celda>{formatearPesos(pack.precio)}</Celda>
              <Celda>{pack.activo ? <Insignia tono="verde">Se vende</Insignia> : <Insignia>No se vende</Insignia>}</Celda>
              <Celda className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => setEditando(pack)}>
                  Editar
                </Boton>
                <Boton
                  variante="secundario"
                  onClick={() => actualizar.mutate({ id: pack.id, datos: { activo: !pack.activo } })}
                >
                  {pack.activo ? 'Dejar de vender' : 'Volver a vender'}
                </Boton>
              </Celda>
            </tr>
          ))}
        </Tabla>
      )}

      <Dialogo
        titulo={editando === 'nuevo' ? 'Nuevo pack' : 'Editar pack'}
        abierto={editando !== null}
        alCerrar={() => setEditando(null)}
      >
        {editando !== null && (
          <PackForm
            inicial={editando === 'nuevo' ? undefined : editando}
            alGuardar={async (datos) => {
              if (editando === 'nuevo') await crear.mutateAsync(datos);
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

function PackForm({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial: Pack | undefined;
  alGuardar: (datos: CrearPackInput) => Promise<unknown>;
  alCancelar: () => void;
}) {
  const formulario = useForm({
    resolver: zodResolver(crearPackSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? '',
      cantidadClases: inicial?.cantidadClases ?? Number.NaN,
      precio: inicial?.precio ?? Number.NaN,
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
      <Campo etiqueta="Nombre" error={errors.nombre?.message}>
        {(id) => <Entrada id={id} {...formulario.register('nombre')} />}
      </Campo>
      <Campo etiqueta="Cantidad de clases" error={errors.cantidadClases?.message}>
        {(id) => <Entrada id={id} type="number" min={1} {...formulario.register('cantidadClases', { valueAsNumber: true })} />}
      </Campo>
      <Campo etiqueta="Precio" error={errors.precio?.message}>
        {(id) => <Entrada id={id} type="number" min={0} {...formulario.register('precio', { valueAsNumber: true })} />}
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
