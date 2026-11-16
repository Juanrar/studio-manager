export function enlaceDeWhatsapp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, '').replace(/^00/, '');
  if (digitos.startsWith('54')) {
    digitos = digitos.slice(2).replace(/^9/, '');
  } else {
    digitos = digitos.replace(/^0/, '');
  }
  if (digitos.length === 12) {
    for (const area of [2, 3, 4]) {
      if (digitos.slice(area, area + 2) === '15') {
        digitos = digitos.slice(0, area) + digitos.slice(area + 2);
        break;
      }
    }
  }
  return digitos.length === 10 ? `https://wa.me/549${digitos}` : null;
}
