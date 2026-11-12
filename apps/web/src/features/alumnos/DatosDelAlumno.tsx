import { useEffect, useId, useState, type ReactNode } from 'react';
import type { FichaDeAlumno } from '@studio/shared';
import { Aviso, Boton, Dialogo, Icono, claseDeBoton } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { formatearFecha } from '../../lib/formato.ts';
import { enlaceDeWhatsapp } from '../../lib/whatsapp.ts';
import { AlumnoForm } from './AlumnoForm.tsx';
import { useActualizarAlumno } from './api.ts';

// Años cumplidos hoy, con el reloj del navegador.
function edadDe(nacimiento: string): number {
  const [anio, mes, dia] = nacimiento.split('-').map(Number) as [number, number, number];
  const hoy = new Date();
  const todaviaNoCumplio = hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia);
  return hoy.getFullYear() - anio - (todaviaNoCumplio ? 1 : 0);
}

function Titulo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mb-2.5 text-[15px] font-semibold">
      {children}
    </h3>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-apagado">{etiqueta}</dt>
      <dd className="mt-0.5 break-words">{valor ?? <span className="text-apagado">Vacío</span>}</dd>
    </div>
  );
}

// Copia el texto al portapapeles y durante dos segundos dice "Copiado".
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const espera = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(espera);
  }, [copiado]);
  return (
    <Boton
      variante="secundario"
      className="h-7 gap-1.5 px-2"
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => setCopiado(true));
      }}
    >
      <Icono nombre={copiado ? 'tilde' : 'copiar'} className="size-3.5" />
      {copiado ? 'Copiado' : 'Copiar'}
    </Boton>
  );
}

// wa.me abre la app de WhatsApp si está instalada y, si no, WhatsApp Web.
function BotonWhatsapp({ telefono }: { telefono: string }) {
  const enlace = enlaceDeWhatsapp(telefono);
  if (enlace === null) {
    return (
      <Boton variante="secundario" className="h-7 gap-1.5 px-2" disabled title="Falta el código de área en el teléfono">
        <Icono nombre="whatsapp" className="size-3.5" />
        WhatsApp
      </Boton>
    );
  }
  return (
    <a href={enlace} target="_blank" rel="noopener noreferrer" className={`${claseDeBoton('secundario')} h-7 gap-1.5 px-2`}>
      <Icono nombre="whatsapp" className="size-3.5" />
      WhatsApp
    </a>
  );
}

function FilaDeContacto({ icono, etiqueta, valor, accion }: { icono: 'telefono' | 'correo'; etiqueta: string; valor: string | null; accion?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 p-3">
      <Icono nombre={icono} className="size-4 flex-none text-apagado" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-apagado">{etiqueta}</div>
        <div className="truncate">{valor ?? <span className="text-apagado">Vacío</span>}</div>
      </div>
      {valor !== null && accion}
    </li>
  );
}

// Lo que el personal hace con los datos: contactar al alumno, avisar en una emergencia, leer las notas.
// El pack no está acá: ya se ve en el encabezado y en el Resumen.
export function DatosDelAlumno({ datos }: { datos: FichaDeAlumno }) {
  const actualizar = useActualizarAlumno(datos.id);
  const [editando, setEditando] = useState(false);
  const idContacto = useId();
  const idIdentidad = useId();
  const idEmergencia = useId();
  const idNotas = useId();

  return (
    <div className="grid grid-cols-2 gap-8 p-6">
      <div>
        <section aria-labelledby={idContacto}>
          {/* El botón es más alto que el título: el margen va en la fila, si no la lista queda pegada al botón. */}
          <div className="mb-2.5 flex items-center justify-between [&>h3]:mb-0">
            <Titulo id={idContacto}>Contacto</Titulo>
            <Boton variante="secundario" onClick={() => setEditando(true)}>
              Editar
            </Boton>
          </div>
          {actualizar.isError && <Aviso>{mensajeDeError(actualizar.error)}</Aviso>}
          <ul className="flex flex-col divide-y divide-borde rounded-md border border-borde">
            <FilaDeContacto
              icono="telefono"
              etiqueta="Teléfono"
              valor={datos.telefono}
              accion={datos.telefono !== null && <BotonWhatsapp telefono={datos.telefono} />}
            />
            <FilaDeContacto
              icono="correo"
              etiqueta="Email"
              valor={datos.email}
              accion={datos.email !== null && <BotonCopiar texto={datos.email} />}
            />
          </ul>
        </section>

        <section aria-labelledby={idIdentidad} className="mt-6">
          <Titulo id={idIdentidad}>Identidad</Titulo>
          <dl className="grid grid-cols-3 gap-4">
            <Dato etiqueta="DNI" valor={datos.dni} />
            <Dato
              etiqueta="Nacimiento"
              valor={datos.fechaNacimiento && `${formatearFecha(datos.fechaNacimiento)} · ${edadDe(datos.fechaNacimiento)} años`}
            />
            <Dato etiqueta="Alta" valor={formatearFecha(datos.alta)} />
          </dl>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby={idEmergencia}>
          <Titulo id={idEmergencia}>En caso de emergencia</Titulo>
          <div className="flex items-start gap-3 rounded-md border border-amber-400/40 bg-amber-500/10 p-3">
            <Icono nombre="botiquin" className="mt-0.5 size-4 flex-none text-amber-300" />
            <p className="min-w-0 break-words">
              {datos.contactoEmergencia ?? <span className="text-apagado">No cargó un contacto de emergencia.</span>}
            </p>
          </div>
        </section>
        <section aria-labelledby={idNotas} className="flex flex-1 flex-col">
          <Titulo id={idNotas}>Notas</Titulo>
          <div className="min-h-24 flex-1 rounded-md border border-borde p-3 whitespace-pre-wrap">
            {datos.notas ?? <span className="text-apagado">Sin notas.</span>}
          </div>
        </section>
      </div>

      <Dialogo titulo="Editar alumno" abierto={editando} alCerrar={() => setEditando(false)}>
        <AlumnoForm
          inicial={datos}
          alGuardar={async (cambios) => {
            await actualizar.mutateAsync(cambios);
            setEditando(false);
          }}
          alCancelar={() => setEditando(false)}
        />
      </Dialogo>
    </div>
  );
}
