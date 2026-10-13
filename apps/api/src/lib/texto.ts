export const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Para comparar nombres: sin tildes, en minúsculas y con los espacios internos colapsados en uno.
export const normalizarNombre = (texto: string) => sinTildes(texto).replace(/\s+/g, ' ');
