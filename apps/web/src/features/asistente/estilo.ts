import type { CSSProperties } from 'react';

export const ACENTO_CLARO = 'color-mix(in oklab, var(--color-acento) 45%, white)';
export const DEGRADE: CSSProperties = { background: `linear-gradient(135deg, var(--color-acento), ${ACENTO_CLARO})` };
