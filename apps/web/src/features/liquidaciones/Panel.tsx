import type { ReactNode } from 'react';

export function Panel({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-md border border-borde p-4">
      <h2 id={id} className="mb-3 text-base font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
