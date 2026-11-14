# Los días del negocio en un solo módulo

**Estado:** lista  
**Depende de:** utilidades-de-dominio  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; la aritmética de días existe una sola vez, en `packages/shared/src/fechas.ts`; `apps/web/src/lib/formato.ts` solo tiene formato de texto; `America/Argentina/Buenos_Aires` aparece una sola vez en el código que no es de test ni de configuración.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md), [el índice de features](index.md), [docs/entorno/web.md](../entorno/web.md) y [docs/entorno/windows.md](../entorno/windows.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Para qué

Sale de la revisión de arquitectura del 2026-11-13. La cuenta con días del negocio está escrita tres veces:

- `apps/api/src/lib/fechas.ts`, con 21 tests.
- `apps/web/src/lib/formato.ts`, que repite `hoyEnEstudio`, `sumarDias`, `lunesDe` y el día de la semana (ahí `diaDeLaSemana`, en la API `diaSemanaIso`), y suma `horaEnEstudio` y `periodoAnterior`. No tiene tests propios.
- `packages/shared`, donde `fechaDiaSchema` y `lunesSchema` hacen su cuenta con `Date`.

Además, `GrillaPage.tsx` tiene su `primeroDelMes`, `DatosDelAlumno.tsx` calcula la edad con la fecha del navegador y la zona horaria está escrita dos veces en la web.

Un error de fin de mes o de zona horaria hoy se puede arreglar en un lado y quedar en los otros.

## Qué se decidió

Decisiones tomadas con el estudio el 2026-11-13. No se vuelven a discutir en la ejecución.

1. **A `packages/shared/src/fechas.ts` van** `FechaDia`, `Periodo`, `TZ_ESTUDIO_POR_DEFECTO`, `esFechaDia`, `hoyEnEstudio`, `horaEnEstudio`, `diaSemanaIso`, `sumarDias`, `sumarMeses`, `sumarUnMes`, `primerDiaDelMes`, `lunesDe`, `rangoDelPeriodo`, `periodoDe` y `edadEn`.
2. **El horizonte se queda en la API.** `finDelHorizonte` y `semanasDelHorizonte` son una regla del estudio que la web ya recibe calculada.
3. **La API sigue importando de `apps/api/src/lib/fechas.ts`**, que reexporta lo de `shared`. No cambia ningún import de la API, y sigue valiendo la regla de `CLAUDE.md` de que las fechas pasan por ese archivo.
4. **La web importa directo de `@studio/shared`.** `formato.ts` queda solo con formato de texto y no reexporta fechas.
5. **Un solo nombre para el día de la semana:** `diaSemanaIso`. `diaDeLaSemana` desaparece.
6. **La zona horaria queda una vez**, como valor por defecto del parámetro `tz` de `hoyEnEstudio` y `horaEnEstudio`. La API sigue pasando `TZ_ESTUDIO`; la web usa el valor por defecto.
7. **Vitest en `packages/shared`.** Los tests de `fechas.test.ts` que no son del horizonte se mudan ahí. No necesitan Docker.
8. **La edad pasa a `shared`** como `edadEn(nacimiento, hoy)`, una cuenta entre dos días. `DatosDelAlumno` le pasa el día del estudio. Es el único cambio de comportamiento: hoy usa la fecha del navegador, y solo se nota con la computadora en otra zona horaria.
9. **`fechaDiaSchema` y `lunesSchema` usan `esFechaDia` y `diaSemanaIso`.** Los mensajes de error no cambian.
10. **Queda afuera** unificar las dos fuentes de "hoy" de la web. El listado y el resumen del alumno usan el `hoy` que manda la API; la grilla y la tarjeta del asistente usan el reloj del navegador.

## Cómo queda

- `packages/shared/src/fechas.ts`: el módulo, exportado desde `index.ts`.
- `packages/shared/src/test/fechas.test.ts`: sus tests.
- `apps/api/src/lib/fechas.ts`: `export * from` lo de `shared`, más `finDelHorizonte` y `semanasDelHorizonte`.
- `apps/api/src/config.ts`: el valor por defecto de `TZ_ESTUDIO` es la constante de `shared`.
- `apps/web/src/lib/formato.ts`: sin `hoyEnEstudio`, `horaEnEstudio`, `sumarDias`, `diaDeLaSemana`, `lunesDe` ni `periodoAnterior`. `formatearInstante` usa `hoyEnEstudio` de `shared`.
- En la web, el período anterior es `periodoDe(sumarMeses(fecha, -1))` y el primer día de otro mes es `sumarMeses(primerDiaDelMes(fecha), n)`. No hacen falta funciones nuevas para eso.

Archivos de la web que usan funciones de fecha: `agenda/AgendaPage.tsx`, `asistente/grillaDeLaPropuesta.ts`, `asistente/TarjetaDeAltaDeProfesor.tsx`, `grilla/EditorDeClase.tsx`, `grilla/GrillaPage.tsx`, `grilla/VistaDelMes.tsx`, `grilla/VistaDeSemana.tsx`, `liquidaciones/LiquidacionesPage.tsx` y `alumnos/DatosDelAlumno.tsx`.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| Los 17 tests de `hoyEnEstudio`, `diaSemanaIso`, `sumarDias`, `sumarUnMes`, `sumarMeses`, `primerDiaDelMes`, `esFechaDia` y `lunesDe` | Unitario, mudados a `shared` sin cambiar sus aserciones | Los mismos que hoy |
| `horaEnEstudio` devuelve `HH:MM` de 24 horas en la zona del estudio: las 02:30 UTC son las 23:30, y la medianoche es `00:00`, no `24:00` | Unitario, nuevo | Usar la hora del sistema o un ciclo de horas que escribe `24:00` |
| `sumarMeses(fecha, -1)` cruza el año hacia atrás y recorta al último día: del 31 de marzo al 28 de febrero, de enero a diciembre del año anterior | Unitario, nuevo | Romper los meses negativos, de los que ahora depende el período anterior de la web |
| `edadEn`: el día antes del cumpleaños da un año menos, el día del cumpleaños da el año nuevo, y quien nació un 29 de febrero cumple el 1 de marzo en un año no bisiesto | Unitario, nuevo | Comparar solo el año, o tomar el día del navegador |
| `fechaDiaSchema` rechaza el 30 de febrero con "La fecha no existe", rechaza un formato inválido con "La fecha tiene que tener el formato AAAA-MM-DD" seguido de "La fecha no existe", y `lunesSchema` (a través de `crearHorarioSchema`) rechaza un martes con "Tiene que ser el lunes de una semana" | Unitario, nuevo | Cambiar el mensaje o dejar de validar al pasar a las funciones compartidas |
| `/grilla?fecha=2026-02-30` muestra la semana de hoy | Web, en `grilla.test.tsx`. Sumado en la revisión final | Pasar a las cuentas con días una fecha de la dirección sin validarla: las funciones compartidas la rechazan con un error y la pantalla se rompe |

Los 4 tests del horizonte se quedan en `apps/api/src/lib/test/fechas.test.ts`.

Correcciones al plan hechas en la tarea 1 (2026-11-13):

- El plan decía 20 tests en la API y 16 para mudar. Eran 21 y 17: `sumarUnMes` tiene 4 tests. La API pasa de 251 a 234 tests y `shared` queda con 29 (17 mudados y 12 nuevos).
- `apps/api/src/lib/fechas.ts` reexporta con nombre, no con `export *`. `@studio/shared` tiene una sola entrada, y `export *` de ella sumaría todos los esquemas a `lib/fechas.ts`.
- Con un formato inválido, `fechaDiaSchema` da dos mensajes, el del formato y "La fecha no existe": en Zod 3 el `refine` corre aunque el `regex` haya fallado. Ya era así antes del cambio y el test lo deja escrito.
- Dos diferencias en casos de borde al pasar a las funciones compartidas. `fechaDiaSchema` ahora rechaza los años 0000 a 0099 (`Date.UTC` los toma como 1900 a 1999 y `esFechaDia` compara el año; la cuenta vieja no lo comparaba). `lunesSchema` suma su mensaje a "La fecha no existe" en toda fecha inexistente; antes no lo sumaba cuando el desborde de `Date` caía en lunes (`2026-02-30` se leía como el lunes 2 de marzo).

La web no suma tests: las pantallas que usan estas funciones ya tienen los suyos, y tienen que seguir pasando sin cambios.

---

### Tarea 1: El módulo de días en `packages/shared`, con sus tests

**Archivos:**
- Crear: `packages/shared/src/fechas.ts`, `packages/shared/src/test/fechas.test.ts`, `packages/shared/vitest.config.ts`
- Modificar: `packages/shared/package.json`, `packages/shared/src/index.ts`, `packages/shared/src/comun.ts`, `packages/shared/src/horarios.ts`, `apps/api/src/lib/fechas.ts`, `apps/api/src/lib/test/fechas.test.ts`, `apps/api/src/config.ts`

- [x] **Paso 1:** agregar Vitest a `packages/shared` (misma versión que la API) y cambiar su script `test` por `vitest run`.
- [x] **Paso 2:** escribir en `packages/shared/src/test/fechas.test.ts` los tests nuevos de la tabla (`horaEnEstudio`, `sumarMeses` hacia atrás, `edadEn`, los dos esquemas).
- [x] **Paso 3:** correrlos y verificar que fallan porque `fechas.ts` no existe en `shared`.
- [x] **Paso 4:** crear `packages/shared/src/fechas.ts` moviendo el código de la API, sumar `horaEnEstudio` y `edadEn`, y exportarlo desde `index.ts`. `fechaDiaSchema` y `lunesSchema` pasan a usarlo.
- [x] **Paso 5:** mover los 17 tests que no son del horizonte de la API a `shared`. `apps/api/src/lib/fechas.ts` reexporta lo de `shared` y conserva el horizonte. `config.ts` usa la constante.
- [x] **Paso 6:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 7:** commit `refactor(fechas): los días del negocio pasan a packages/shared`.

### Tarea 2: La web usa el módulo compartido

**Archivos:**
- Modificar: `apps/web/src/lib/formato.ts` y los nueve archivos de la web listados en "Cómo queda"

- [x] **Paso 1:** cambiar los imports de los nueve archivos a `@studio/shared`, con `diaSemanaIso` en lugar de `diaDeLaSemana`.
- [x] **Paso 2:** reemplazar `periodoAnterior` y `primeroDelMes` por `periodoDe`, `sumarMeses` y `primerDiaDelMes`.
- [x] **Paso 3:** `DatosDelAlumno` usa `edadEn(nacimiento, hoyEnEstudio())` y pierde su `edadDe`.
- [x] **Paso 4:** borrar de `formato.ts` las funciones de fecha y la zona horaria. `formatearInstante` usa `hoyEnEstudio` de `shared`.
- [x] **Paso 5:** correr `pnpm test` y `pnpm typecheck`, y verificar que pasan sin cambiar ningún test de la web.
- [x] **Paso 6:** actualizar `docs/entorno/web.md` si nombra alguna de las funciones que se mudaron.
- [x] **Paso 7:** commit `refactor(web): las fechas salen de formato.ts y usan el módulo compartido`.

Notas de la tarea 2 (2026-11-14):

- El grep no encontró más usos que los nueve archivos del plan. Ningún test ni ayudante de `apps/web/test/` importaba estas funciones, así que no se tocó ningún test.
- `docs/entorno/web.md` no nombra ninguna función mudada ni `lib/formato.ts`: no cambió. Sí cambió `docs/arquitectura frontend.md`, que decía que las fechas viven en `formato.ts`.
- Las funciones de `shared` lanzan un error con una fecha inexistente (`2026-02-30`); las de `formato.ts` la desbordaban al mes siguiente. Solo se nota en `/grilla` con una `fecha` inexistente escrita a mano en la dirección; en `/agenda` el día sale de la respuesta de la API.
- En `formato.ts` queda `haceCuanto`, que resta dos días con `Date.parse`. No es de las funciones de esta feature y no se tocó.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan en todo el repositorio: shared 29, API 234, web 199.
- [x] Buscar `Buenos_Aires` en `apps/*/src` y `packages/*/src`, sin los tests: aparece solo en `packages/shared/src/fechas.ts`.
- [x] Buscar `getUTCDay`, `Date.UTC` y `new Date(` en `apps/web/src` y `packages/shared/src`, sin los tests: lo que queda es formato de texto (`formato.ts`), el reloj (`useAhora.ts`) o `packages/shared/src/fechas.ts`.
- [x] `pnpm e2e` pasa: 1.
