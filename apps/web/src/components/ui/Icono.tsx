// Trazos de Tabler Icons (MIT, https://tabler.io/icons), copiados para no importar el paquete entero.
const TRAZOS = {
  agenda: [
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
    'M16 3l0 4',
    'M8 3l0 4',
    'M4 11l16 0',
    'M8 15h2v2h-2z',
  ],
  alumnos: [
    'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M21 21v-2a4 4 0 0 0 -3 -3.85',
  ],
  packs: [
    'M15 5l0 2',
    'M15 11l0 2',
    'M15 17l0 2',
    'M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2',
  ],
  profesores: ['M22 9l-10 -4l-10 4l10 4l10 -4v6', 'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4'],
  clases: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 12l3 2', 'M12 7v5'],
  usuarios: [
    'M6 21v-2a4 4 0 0 1 4 -4h2',
    'M22 16c0 4 -2.5 6 -3.5 6s-3.5 -2 -3.5 -6c1 0 2.5 -.5 3.5 -1.5c1 1 2.5 1.5 3.5 1.5z',
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
  ],
  liquidaciones: [
    'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2',
    'M14 8h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5m2 0v1.5m0 -9v1.5',
  ],
  salir: [
    'M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2',
    'M9 12h12l-3 -3',
    'M18 15l3 -3',
  ],
  cerrar: ['M18 6l-12 12', 'M6 6l12 12'],
  anterior: ['M15 6l-6 6l6 6'],
  siguiente: ['M9 6l6 6l-6 6'],
} as const;

export type NombreIcono = keyof typeof TRAZOS;

// Decorativo: el texto o el aria-label del control que lo contiene es lo que se lee.
export function Icono({ nombre, className = 'size-4' }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-none ${className}`}
    >
      {TRAZOS[nombre].map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  );
}
