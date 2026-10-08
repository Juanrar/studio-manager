import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { ActualizarClaseInput, ActualizarHorarioInput, Clase } from '@studio/shared';
import { Aviso, Boton, BotonIcono, Flotante, Pagina, type Ancla } from '../../components/ui/index.tsx';
import { mensajeDeError } from '../../lib/api.ts';
import { diaDeLaSemana, formatearMes, hoyEnEstudio, lunesDe, nombreDelDia, sumarDias } from '../../lib/formato.ts';
import { useBorrarClase, useCambiarClase, useCambiarHorario, useClasesDelRango, useCrearClaseUnica, useCrearHorario } from './api.ts';
import type { Arrastre, Destino } from './arrastre.ts';
import { AvisoDeCambio, type ContenidoDelAviso } from './AvisoDeCambio.tsx';
import { EditorDeClase, type Borrador } from './EditorDeClase.tsx';
import { FIN_GRILLA, INICIO_GRILLA, PASO, PX_POR_MINUTO, aHora, aMinutos } from './minutos.ts';
import { useArrastre } from './useArrastre.ts';
import { VistaDelMes } from './VistaDelMes.tsx';
import { VistaDeSemana } from './VistaDeSemana.tsx';

const NAVEGACION = 'border border-borde-fuerte disabled:pointer-events-none disabled:opacity-40';

type Vista = 'dia' | 'semana' | 'mes';
const VISTAS: { id: Vista; texto: string }[] = [
  { id: 'dia', texto: 'Día' },
  { id: 'semana', texto: 'Semana' },
  { id: 'mes', texto: 'Mes' },
];

// El primer día del mes `meses` meses después del de `fecha`.
function primeroDelMes(fecha: string, meses = 0): string {
  const [anio, mes] = fecha.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(anio, mes - 1 + meses, 1)).toISOString().slice(0, 10);
}

// Lo que muestra cada vista alrededor de `fecha`: el rango que se pide, los días de la grilla (o las
// semanas del mes), adónde llevan las flechas y el mes del título.
type Periodo = {
  etiqueta: string;
  desde: string;
  hasta: string;
  fechas: string[];
  semanas: string[];
  mes: string;
  anterior: string;
  siguiente: string;
};

function periodoDe(vista: Vista, fecha: string): Periodo {
  if (vista === 'dia') {
    return {
      etiqueta: 'Día',
      desde: fecha,
      hasta: fecha,
      fechas: [fecha],
      semanas: [],
      mes: fecha.slice(0, 7),
      anterior: sumarDias(fecha, -1),
      siguiente: sumarDias(fecha, 1),
    };
  }
  if (vista === 'mes') {
    const primero = primeroDelMes(fecha);
    const ultimo = sumarDias(primeroDelMes(fecha, 1), -1);
    const semanas: string[] = [];
    for (let lunes = lunesDe(primero); lunes <= ultimo; lunes = sumarDias(lunes, 7)) semanas.push(lunes);
    return {
      etiqueta: 'Mes',
      desde: semanas[0]!,
      hasta: sumarDias(semanas.at(-1)!, 6),
      fechas: [],
      semanas,
      mes: primero.slice(0, 7),
      anterior: primeroDelMes(fecha, -1),
      siguiente: primeroDelMes(fecha, 1),
    };
  }
  const lunes = lunesDe(fecha);
  return {
    etiqueta: 'Semana',
    desde: lunes,
    hasta: sumarDias(lunes, 6),
    fechas: Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice)),
    semanas: [],
    mes: sumarDias(lunes, 3).slice(0, 7),
    anterior: sumarDias(lunes, -7),
    siguiente: sumarDias(lunes, 7),
  };
}

type Editor =
  | { modo: 'editar'; clase: Clase; ancla: Ancla }
  | { modo: 'crear'; borrador: Borrador; ancla: Ancla }
  | { modo: 'cancelada'; clase: Clase; ancla: Ancla };

const diaEnTexto = (fecha: string) => nombreDelDia(diaDeLaSemana(fecha)).toLowerCase();
const tituloDe = (clase: { estilo: string; nivel: string | null }) =>
  clase.nivel === null ? clase.estilo : `${clase.estilo} ${clase.nivel}`;

// Los mismos datos, como cambio del horario: la fecha pasa a ser el día de la semana.
function comoHorario(datos: ActualizarClaseInput): ActualizarHorarioInput {
  const { fecha, estado: _estado, ...resto } = datos;
  return fecha === undefined ? resto : { ...resto, diaSemana: diaDeLaSemana(fecha) };
}

// Lo que tenía la clase en los mismos campos que se cambian: es lo que manda "Deshacer".
function anterioresDe(clase: Clase, datos: ActualizarClaseInput): ActualizarClaseInput {
  const actuales: ActualizarClaseInput = {
    fecha: clase.fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    estilo: clase.estilo,
    nivel: clase.nivel,
    profesorId: clase.profesor.id,
    estado: clase.estado === 'cancelada' ? 'cancelada' : 'programada',
  };
  return Object.fromEntries(Object.keys(datos).map((clave) => [clave, actuales[clave as keyof ActualizarClaseInput]]));
}

// La grilla de clases para el administrador. `vista` en la dirección elige Día, Semana o Mes, y `fecha` el
// día alrededor del que se muestra; sin ellas, la semana de hoy.
// Arrastrar una clase la mueve, su borde de abajo cambia cuánto dura y arrastrar sobre un hueco crea una.
// Cada cambio vale solo esa semana; el aviso de abajo ofrece llevarlo a todas o deshacerlo.
export function GrillaPage() {
  const [parametros, setParametros] = useSearchParams();
  const hoy = hoyEnEstudio();
  const pedida = parametros.get('vista');
  const vista: Vista = pedida === 'dia' || pedida === 'mes' ? pedida : 'semana';
  const fecha = parametros.get('fecha') ?? hoy;
  const periodo = periodoDe(vista, fecha);
  const { fechas } = periodo;
  const clases = useClasesDelRango(periodo.desde, periodo.hasta);
  const items = clases.data?.items ?? [];
  const ir = (destino: { vista?: Vista; fecha?: string | undefined }) => {
    const nuevaVista = destino.vista ?? vista;
    setParametros({
      ...(nuevaVista === 'semana' ? {} : { vista: nuevaVista }),
      ...(destino.fecha === undefined ? {} : { fecha: destino.fecha }),
    });
  };
  // Después del horizonte no hay clases creadas: la grilla de ese período todavía no está armada.
  const ultimoPeriodo = clases.data !== undefined && periodo.siguiente > clases.data.finDelHorizonte;

  const columnas = useRef<HTMLDivElement>(null);
  const anclaApretada = useRef<Ancla>({ left: 0, right: 0, top: 0 });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [aviso, setAviso] = useState<ContenidoDelAviso | null>(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);
  const mostrarError = (error: unknown) => setAviso({ tipo: 'error', texto: mensajeDeError(error) });

  const cambiarClase = useCambiarClase();
  const crearUnica = useCrearClaseUnica();
  const borrar = useBorrarClase();
  const cambiarHorario = useCambiarHorario();
  const crearHorario = useCrearHorario();

  // Cambia una clase sola y deja en el aviso cómo llevar el cambio a todas las semanas o deshacerlo.
  function cambiarSoloEsta(clase: Clase, datos: ActualizarClaseInput, texto: string) {
    setEditor(null);
    const anteriores = anterioresDe(clase, datos);
    cambiarClase.mutate(
      { id: clase.id, datos },
      {
        onSuccess: () =>
          setAviso({
            tipo: 'cambio',
            texto: `${texto}, solo esta semana.`,
            todas:
              clase.horarioId === null
                ? undefined
                : {
                    etiqueta: 'Aplicar a todas las semanas',
                    hacer: () =>
                      cambiarHorario.mutate(
                        { id: clase.horarioId!, datos: { ...comoHorario(datos), desde: lunesDe(clase.fecha) } },
                        { onError: mostrarError },
                      ),
                  },
            deshacer: () => cambiarClase.mutate({ id: clase.id, datos: anteriores }, { onError: mostrarError }),
          }),
        onError: mostrarError,
      },
    );
  }

  function quitar(clase: Clase) {
    setEditor(null);
    if (clase.horarioId === null) {
      // Una clase única se borra; "Deshacer" la vuelve a crear.
      const { fecha, horaInicio, horaFin, estilo, nivel } = clase;
      borrar.mutate(clase.id, {
        onSuccess: () =>
          setAviso({
            tipo: 'cambio',
            texto: `${estilo} se quitó.`,
            deshacer: () =>
              crearUnica.mutate({ fecha, horaInicio, horaFin, estilo, nivel, profesorId: clase.profesor.id }, { onError: mostrarError }),
          }),
        onError: mostrarError,
      });
      return;
    }
    cambiarClase.mutate(
      { id: clase.id, datos: { estado: 'cancelada' } },
      {
        onSuccess: () =>
          setAviso({
            tipo: 'cambio',
            texto: `${clase.estilo} no se dicta esta semana.`,
            todas: {
              etiqueta: 'Quitar de todas las semanas',
              hacer: () =>
                cambiarHorario.mutate(
                  { id: clase.horarioId!, datos: { activo: false, desde: lunesDe(clase.fecha) } },
                  { onError: mostrarError },
                ),
            },
            deshacer: () => cambiarClase.mutate({ id: clase.id, datos: { estado: 'programada' } }, { onError: mostrarError }),
          }),
        onError: mostrarError,
      },
    );
  }

  function agregar(borrador: Borrador) {
    setEditor(null);
    const datos = { ...borrador, nivel: borrador.nivel === '' ? null : borrador.nivel };
    crearUnica.mutate(datos, {
      onSuccess: (creada) =>
        setAviso({
          tipo: 'cambio',
          texto: `${datos.estilo} agregada el ${diaEnTexto(datos.fecha)} ${datos.horaInicio}, solo esta semana.`,
          todas: {
            etiqueta: 'Agregar a todas las semanas',
            hacer: () =>
              crearHorario.mutate(
                {
                  estilo: datos.estilo,
                  nivel: datos.nivel,
                  diaSemana: diaDeLaSemana(datos.fecha),
                  horaInicio: datos.horaInicio,
                  horaFin: datos.horaFin,
                  profesorId: datos.profesorId,
                  desde: lunesDe(datos.fecha),
                  claseId: creada.id,
                },
                { onError: mostrarError },
              ),
          },
          deshacer: () => borrar.mutate(creada.id, { onError: mostrarError }),
        }),
      onError: mostrarError,
    });
  }

  function guardar(clase: Clase, borrador: Borrador) {
    const datos: ActualizarClaseInput = { ...borrador, nivel: borrador.nivel === '' ? null : borrador.nivel };
    const seMovio = borrador.fecha !== clase.fecha || borrador.horaInicio !== clase.horaInicio || borrador.horaFin !== clase.horaFin;
    const texto = seMovio
      ? `${borrador.estilo} pasa al ${diaEnTexto(borrador.fecha)} ${borrador.horaInicio}`
      : `${borrador.estilo} cambia`;
    cambiarSoloEsta(clase, datos, texto);
  }

  // Dónde se abre el editor de una clase nueva: junto a su lugar en la grilla.
  function anclaDe(destino: Destino): Ancla {
    const caja = columnas.current!.getBoundingClientRect();
    const ancho = caja.width / fechas.length;
    return {
      left: caja.left + (destino.dia - 1) * ancho,
      right: caja.left + destino.dia * ancho,
      top: caja.top + (destino.inicio - INICIO_GRILLA) * PX_POR_MINUTO,
    };
  }

  function abrirNueva(destino: Destino) {
    const fecha = fechas[destino.dia - 1]!;
    if (fecha < hoy) return;
    setEditor({
      modo: 'crear',
      ancla: anclaDe(destino),
      borrador: { fecha, horaInicio: aHora(destino.inicio), horaFin: aHora(destino.fin), estilo: '', nivel: '', profesorId: 0 },
    });
  }

  const { fantasma, empezar } = useArrastre({
    columnas,
    cantidadDeDias: fechas.length,
    alTocar: (arrastre: Arrastre, _destino: Destino, id: number | null) => {
      if (arrastre.modo === 'crear') {
        // Un toque en un hueco propone una clase de una hora en esa franja.
        const inicio = Math.min(Math.floor(arrastre.minutosAlEmpezar / PASO) * PASO, FIN_GRILLA - 60);
        abrirNueva({ dia: arrastre.dia, inicio: Math.max(inicio, INICIO_GRILLA), fin: Math.max(inicio, INICIO_GRILLA) + 60 });
        return;
      }
      const clase = items.find((item) => item.id === id);
      if (!clase) return;
      setEditor({ modo: clase.estado === 'cancelada' ? 'cancelada' : 'editar', clase, ancla: anclaApretada.current });
    },
    alSoltar: (arrastre: Arrastre, destino: Destino, id: number | null) => {
      if (arrastre.modo === 'crear') return abrirNueva(destino);
      const clase = items.find((item) => item.id === id);
      if (!clase || clase.estado === 'cancelada') return;
      const datos = { fecha: fechas[destino.dia - 1]!, horaInicio: aHora(destino.inicio), horaFin: aHora(destino.fin) };
      if (datos.fecha === clase.fecha && datos.horaInicio === clase.horaInicio && datos.horaFin === clase.horaFin) return;
      const texto =
        arrastre.modo === 'estirar'
          ? `${clase.estilo} ahora termina ${datos.horaFin}`
          : `${clase.estilo} pasa al ${diaEnTexto(datos.fecha)} ${datos.horaInicio}`;
      cambiarSoloEsta(clase, datos, texto);
    },
  });

  const enLaGrilla = (clase: Clase) => ({
    dia: fechas.indexOf(clase.fecha) + 1,
    inicio: aMinutos(clase.horaInicio),
    fin: aMinutos(clase.horaFin),
  });

  function alApretarClase(evento: PointerEvent, clase: Clase) {
    // Lo que ya pasó se ve pero no se edita desde la grilla.
    if (clase.fecha < hoy) return;
    const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    anclaApretada.current = { left: caja.left, right: caja.right, top: caja.top };
    empezar(evento, (apretado) => ({ modo: 'mover', clase: enLaGrilla(clase), minutosAlEmpezar: apretado.minutos }), clase.id);
  }

  return (
    <Pagina
      titulo={<span className="text-lg font-bold">{formatearMes(periodo.mes)}</span>}
      acciones={
        <>
          {/* Centrado sobre la tarjeta de contenido, como en DayFlow. */}
          <div className="absolute left-1/2 flex -translate-x-1/2 rounded-lg bg-elevado p-0.5">
            {VISTAS.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                aria-pressed={vista === opcion.id}
                onClick={() => {
                  setEditor(null);
                  ir({ vista: opcion.id, fecha: parametros.get('fecha') ?? undefined });
                }}
                className={`h-7 rounded-md px-3.5 font-medium ${
                  vista === opcion.id ? 'bg-resalte text-texto shadow-sm shadow-black/40' : 'text-apagado hover:text-texto'
                }`}
              >
                {opcion.texto}
              </button>
            ))}
          </div>
          <BotonIcono
            icono="anterior"
            etiqueta={`${periodo.etiqueta} anterior`}
            onClick={() => ir({ fecha: periodo.anterior })}
            className={NAVEGACION}
          />
          <button
            type="button"
            onClick={() => ir({})}
            className="h-8 rounded-md border border-borde-fuerte px-3 font-medium text-tenue hover:bg-resalte hover:text-texto"
          >
            Hoy
          </button>
          <BotonIcono
            icono="siguiente"
            etiqueta={`${periodo.etiqueta} siguiente`}
            disabled={ultimoPeriodo}
            onClick={() => ir({ fecha: periodo.siguiente })}
            className={NAVEGACION}
          />
        </>
      }
    >
      {clases.isError && <Aviso>{mensajeDeError(clases.error)}</Aviso>}
      {vista === 'mes' && (
        <VistaDelMes
          semanas={periodo.semanas}
          mes={periodo.mes}
          clases={items}
          hoy={hoy}
          alElegirDia={(dia) => ir({ vista: 'dia', fecha: dia })}
        />
      )}
      {vista !== 'mes' && (
        <VistaDeSemana
          fechas={fechas}
          clases={items}
          hoy={hoy}
          interacciones={{
            columnas,
            fantasma,
            idElegido: editor !== null && editor.modo !== 'crear' ? editor.clase.id : null,
            alApretarClase,
            alEstirarClase: (evento, clase) => empezar(evento, () => ({ modo: 'estirar', clase: enLaGrilla(clase) }), clase.id),
            alApretarHueco: (evento) =>
              empezar(evento, (apretado) => ({ modo: 'crear', dia: apretado.dia, minutosAlEmpezar: apretado.minutos }), null),
          }}
        />
      )}

      {editor !== null && editor.modo !== 'cancelada' && (
        <Flotante
          ancla={editor.ancla}
          ancho={340}
          etiqueta={editor.modo === 'crear' ? 'Nueva clase' : tituloDe(editor.clase)}
          alCerrar={() => setEditor(null)}
        >
          <EditorDeClase
            key={editor.modo === 'crear' ? `nueva-${editor.borrador.fecha}-${editor.borrador.horaInicio}` : editor.clase.id}
            titulo={editor.modo === 'crear' ? 'Nueva clase' : tituloDe(editor.clase)}
            nueva={editor.modo === 'crear'}
            fechas={fechas.filter((fecha) => fecha >= hoy)}
            inicial={
              editor.modo === 'crear'
                ? editor.borrador
                : {
                    fecha: editor.clase.fecha,
                    horaInicio: editor.clase.horaInicio,
                    horaFin: editor.clase.horaFin,
                    estilo: editor.clase.estilo,
                    nivel: editor.clase.nivel ?? '',
                    profesorId: editor.clase.profesor.id,
                  }
            }
            alGuardar={(borrador) => (editor.modo === 'crear' ? agregar(borrador) : guardar(editor.clase, borrador))}
            alQuitar={() => editor.modo === 'editar' && quitar(editor.clase)}
            alCerrar={() => setEditor(null)}
          />
        </Flotante>
      )}

      {editor?.modo === 'cancelada' && (
        <Flotante ancla={editor.ancla} ancho={260} etiqueta={`${tituloDe(editor.clase)}, cancelada`} alCerrar={() => setEditor(null)}>
          <p className="mb-3 text-tenue">
            {editor.clase.estilo} no se dicta el {diaEnTexto(editor.clase.fecha)} {Number(editor.clase.fecha.slice(8))}.
          </p>
          <Boton
            className="w-full justify-center"
            onClick={() => {
              const clase = editor.clase;
              setEditor(null);
              cambiarClase.mutate({ id: clase.id, datos: { estado: 'programada' } }, { onError: mostrarError });
            }}
          >
            Volver a dictarla
          </Boton>
        </Flotante>
      )}

      {aviso !== null && <AvisoDeCambio aviso={aviso} alCerrar={cerrarAviso} />}
    </Pagina>
  );
}
