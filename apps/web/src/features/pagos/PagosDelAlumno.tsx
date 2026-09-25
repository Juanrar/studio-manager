import { useState } from 'react';
import { MEDIOS_PAGO, type MedioPago, type Pago } from '@studio/shared';
import {
  AreaDeTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Celda,
  Dialogo,
  Insignia,
  Selector,
  Tabla,
} from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import {
  NOMBRES_MEDIO_DE_PAGO,
  formatearFecha,
  formatearInstante,
  formatearPesos,
} from '../../lib/formato.ts';
import { usePacks } from '../packs/api.ts';
import { useAnularPago, usePagosDeAlumno, useRegistrarPago } from './api.ts';

// Un pago anulado o vencido ya no se puede usar, aunque le queden clases.
function EstadoDelPago({ pago }: { pago: Pago }) {
  if (pago.anulado) return <Insignia tono="rojo">Anulado</Insignia>;
  if (pago.vencido) return <Insignia>Vencido</Insignia>;
  if (pago.clasesRestantes === 0) return <Insignia tono="ambar">Sin clases</Insignia>;
  return <Insignia tono="verde">Vigente</Insignia>;
}

export function PagosDelAlumno({ alumnoId, puedeRegistrar }: { alumnoId: number; puedeRegistrar: boolean }) {
  const pagos = usePagosDeAlumno(alumnoId);
  const [registrando, setRegistrando] = useState(false);
  const [anulando, setAnulando] = useState<Pago | null>(null);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pagos</h2>
        {puedeRegistrar && <Boton onClick={() => setRegistrando(true)}>Registrar pago</Boton>}
      </div>

      {pagos.isPending && <Cargando />}
      {pagos.isError && <Aviso>{mensajeDeError(pagos.error)}</Aviso>}
      {pagos.data && pagos.data.length === 0 && <p className="text-sm text-stone-500">Todavía no tiene pagos.</p>}
      {pagos.data && pagos.data.length > 0 && (
        <Tabla columnas={['Pack', 'Compra', 'Vence', 'Clases', 'Monto', 'Medio', 'Estado', '']}>
          {pagos.data.map((pago) => (
            <tr key={pago.id}>
              <Celda>{pago.pack.nombre}</Celda>
              <Celda>{formatearInstante(pago.fecha)}</Celda>
              <Celda>{formatearFecha(pago.venceEl)}</Celda>
              <Celda>
                {pago.clasesRestantes} de {pago.cantidadClases}
              </Celda>
              <Celda>{formatearPesos(pago.monto)}</Celda>
              <Celda>{NOMBRES_MEDIO_DE_PAGO[pago.medio]}</Celda>
              <Celda>
                <EstadoDelPago pago={pago} />
                {pago.motivoAnulacion !== null && (
                  <span className="ml-2 text-xs text-stone-500">{pago.motivoAnulacion}</span>
                )}
              </Celda>
              <Celda>
                {!pago.anulado && (
                  <Boton variante="secundario" onClick={() => setAnulando(pago)}>
                    Anular
                  </Boton>
                )}
              </Celda>
            </tr>
          ))}
        </Tabla>
      )}

      <Dialogo titulo="Registrar pago" abierto={registrando} alCerrar={() => setRegistrando(false)}>
        <RegistrarPagoForm alumnoId={alumnoId} alTerminar={() => setRegistrando(false)} />
      </Dialogo>

      <Dialogo titulo="Anular pago" abierto={anulando !== null} alCerrar={() => setAnulando(null)}>
        {anulando !== null && (
          <AnularPagoForm alumnoId={alumnoId} pago={anulando} alTerminar={() => setAnulando(null)} />
        )}
      </Dialogo>
    </section>
  );
}

function RegistrarPagoForm({ alumnoId, alTerminar }: { alumnoId: number; alTerminar: () => void }) {
  const packs = usePacks();
  const registrar = useRegistrarPago();
  const [packId, setPackId] = useState('');
  const [medio, setMedio] = useState<MedioPago>('efectivo');

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        registrar.mutate({ alumnoId, packId: Number(packId), medio }, { onSuccess: alTerminar });
      }}
    >
      {registrar.isError && <Aviso>{mensajeDeError(registrar.error)}</Aviso>}
      {packs.isPending && <Cargando />}
      <Campo etiqueta="Pack">
        {(id) => (
          <Selector id={id} value={packId} onChange={(evento) => setPackId(evento.target.value)} required>
            <option value="">Elegí un pack</option>
            {packs.data?.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {`${pack.nombre} · ${formatearPesos(pack.precio)} · ${pack.cantidadClases} ${pack.cantidadClases === 1 ? 'clase' : 'clases'}`}
              </option>
            ))}
          </Selector>
        )}
      </Campo>
      <Campo etiqueta="Medio de pago">
        {(id) => (
          <Selector id={id} value={medio} onChange={(evento) => setMedio(evento.target.value as MedioPago)}>
            {MEDIOS_PAGO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {NOMBRES_MEDIO_DE_PAGO[opcion]}
              </option>
            ))}
          </Selector>
        )}
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={packId === '' || registrar.isPending}>
          Registrar
        </Boton>
      </div>
    </form>
  );
}

function AnularPagoForm({ alumnoId, pago, alTerminar }: { alumnoId: number; pago: Pago; alTerminar: () => void }) {
  const anular = useAnularPago(alumnoId);
  const [motivo, setMotivo] = useState('');

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        anular.mutate({ pagoId: pago.id, motivo }, { onSuccess: alTerminar });
      }}
    >
      <p className="text-sm text-stone-600">
        {pago.pack.nombre} del {formatearInstante(pago.fecha)} por {formatearPesos(pago.monto)}.
      </p>
      {anular.isError && <Aviso>{mensajeDeError(anular.error)}</Aviso>}
      <Campo etiqueta="Motivo">
        {(id) => <AreaDeTexto id={id} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="peligro" disabled={motivo.trim() === '' || anular.isPending}>
          Anular pago
        </Boton>
      </div>
    </form>
  );
}
