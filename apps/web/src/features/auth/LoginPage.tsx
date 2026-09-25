import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { loginSchema } from '@studio/shared';
import { Aviso, Boton, Campo, Entrada } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { useLogin, useSesion } from './api.ts';

export function LoginPage() {
  const navegar = useNavigate();
  const sesion = useSesion();
  const login = useLogin();
  const formulario = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (sesion.data) return <Navigate to="/agenda" replace />;

  const enviar = formulario.handleSubmit((datos) =>
    login.mutate(datos, { onSuccess: () => navegar('/agenda', { replace: true }) }),
  );
  const errores = formulario.formState.errors;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow" noValidate>
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        {login.isError && <Aviso>{mensajeDeError(login.error)}</Aviso>}
        <Campo etiqueta="Email" error={errores.email?.message}>
          {(id) => <Entrada id={id} type="email" autoComplete="username" {...formulario.register('email')} />}
        </Campo>
        <Campo etiqueta="Contraseña" error={errores.password?.message}>
          {(id) => (
            <Entrada id={id} type="password" autoComplete="current-password" {...formulario.register('password')} />
          )}
        </Campo>
        <Boton type="submit" disabled={login.isPending}>
          Entrar
        </Boton>
      </form>
    </main>
  );
}
