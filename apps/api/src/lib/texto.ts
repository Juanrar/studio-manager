export const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export const normalizarNombre = (texto: string) => sinTildes(texto).replace(/\s+/g, ' ');
