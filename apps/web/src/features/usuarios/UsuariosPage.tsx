import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearUsuarioSchema, ROLES, type Rol, type UsuarioPublico } from '@studio/shared';
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
import { mostrarErrorDeApi } from '../../lib/formularios.ts';
import { useSesion } from '../auth/api.ts';
import { useActualizarUsuario, useCrearUsuario, useUsuarios } from './api.ts';

const NOMBRES_ROL: Record<Rol, string> = { admin: 'Administración', recepcion: 'Recepción' };

export function UsuariosPage() {
  const usuarios = useUsuarios();
  const sesion = useSesion();
  const actualizar = useActualizarUsuario();
  const [editando, setEditando] = useState<UsuarioPublico | 'nuevo' | null>(null);

  return (
    <section>
      <Titulo acciones={<Boton onClick={() => setEditando('nuevo')}>Nuevo usuario</Boton>}>Usuarios</Titulo>

      {usuarios.isPending && <Cargando />}
      {usuarios.isError && <Aviso>{mensajeDeError(usuarios.error)}</Aviso>}
      {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
      {usuarios.data && (
        <Tabla columnas={['Nombre', 'Email', 'Rol', 'Estado', '']}>
          {usuarios.data.map((usuario) => {
            const esUnoMismo = usuario.id === sesion.data?.id;
            return (
              <tr key={usuario.id}>
                <Celda>{usuario.nombre}</Celda>
                <Celda>{usuario.email}</Celda>
                <Celda>{NOMBRES_ROL[usuario.rol]}</Celda>
                <Celda>{usuario.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia>Desactivado</Insignia>}</Celda>
                <Celda className="flex justify-end gap-2">
                  <Boton variante="secundario" onClick={() => setEditando(usuario)}>
                    Editar
                  </Boton>
                  {/* Desactivarse a uno mismo dejaría la sesión cerrada y quizás el sistema sin admin. */}
                  {!esUnoMismo && (
                    <Boton
                      variante="secundario"
                      onClick={() => actualizar.mutate({ id: usuario.id, datos: { activo: !usuario.activo } })}
                    >
                      {usuario.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  )}
                </Celda>
              </tr>
            );
          })}
        </Tabla>
      )}

      <Dialogo
        titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
        abierto={editando !== null}
        alCerrar={() => setEditando(null)}
      >
        {editando === 'nuevo' && <NuevoUsuarioForm alTerminar={() => setEditando(null)} />}
        {editando !== null && editando !== 'nuevo' && (
          <EditarUsuarioForm usuario={editando} alTerminar={() => setEditando(null)} />
        )}
      </Dialogo>
    </section>
  );
}

function SelectorDeRol(props: ComponentProps<typeof Selector>) {
  return (
    <Selector {...props}>
      {ROLES.map((rol) => (
        <option key={rol} value={rol}>
          {NOMBRES_ROL[rol]}
        </option>
      ))}
    </Selector>
  );
}

function NuevoUsuarioForm({ alTerminar }: { alTerminar: () => void }) {
  const crear = useCrearUsuario();
  const formulario = useForm({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: { nombre: '', email: '', password: '', rol: 'recepcion' as Rol },
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await crear.mutateAsync(datos);
      alTerminar();
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
      <Campo etiqueta="Email" error={errors.email?.message}>
        {(id) => <Entrada id={id} type="email" {...formulario.register('email')} />}
      </Campo>
      <Campo etiqueta="Contraseña" error={errors.password?.message}>
        {(id) => <Entrada id={id} type="password" autoComplete="new-password" {...formulario.register('password')} />}
      </Campo>
      <Campo etiqueta="Rol" error={errors.rol?.message}>
        {(id) => <SelectorDeRol id={id} {...formulario.register('rol')} />}
      </Campo>
      <BotonesDeFormulario enviando={isSubmitting} alCancelar={alTerminar} />
    </form>
  );
}

// La contraseña nueva es opcional: vacía no se cambia.
const editarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'Es obligatorio'),
  rol: z.enum(ROLES),
  password: z.union([z.literal(''), z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')]),
});

function EditarUsuarioForm({ usuario, alTerminar }: { usuario: UsuarioPublico; alTerminar: () => void }) {
  const actualizar = useActualizarUsuario();
  const formulario = useForm({
    resolver: zodResolver(editarUsuarioSchema),
    defaultValues: { nombre: usuario.nombre, rol: usuario.rol, password: '' },
  });
  const { errors, isSubmitting } = formulario.formState;

  const enviar = formulario.handleSubmit(async ({ password, ...resto }) => {
    try {
      await actualizar.mutateAsync({ id: usuario.id, datos: password === '' ? resto : { ...resto, password } });
      alTerminar();
    } catch (error) {
      mostrarErrorDeApi(error, formulario.setError);
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      {errors.root?.message !== undefined && <Aviso>{errors.root.message}</Aviso>}
      <p className="text-sm text-stone-600">{usuario.email}</p>
      <Campo etiqueta="Nombre" error={errors.nombre?.message}>
        {(id) => <Entrada id={id} {...formulario.register('nombre')} />}
      </Campo>
      <Campo etiqueta="Rol" error={errors.rol?.message}>
        {(id) => <SelectorDeRol id={id} {...formulario.register('rol')} />}
      </Campo>
      <Campo etiqueta="Contraseña nueva (opcional)" error={errors.password?.message}>
        {(id) => <Entrada id={id} type="password" autoComplete="new-password" {...formulario.register('password')} />}
      </Campo>
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
