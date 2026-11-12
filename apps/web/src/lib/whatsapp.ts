// El teléfono del alumno se guarda como texto libre. WhatsApp pide el número entero, con código de país:
// los celulares argentinos son 54 + 9 + código de área + número (10 dígitos sin el 0 ni el 15).
// Un número que no se puede llevar a ese formato no tiene enlace.
export function enlaceDeWhatsapp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, '').replace(/^00/, '');
  if (digitos.startsWith('54')) {
    digitos = digitos.slice(2).replace(/^9/, '');
  } else {
    digitos = digitos.replace(/^0/, '');
  }
  // Con el 15 de los celulares locales hay 12 dígitos: el 15 va después del código de área (2, 3 o 4 dígitos).
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
