# Mapa de pantallas

Cada ruta de `apps/web/src/rutas.tsx`, quién la ve, qué tiene que mostrar con los datos de ejemplo de `pnpm mirar` y qué features la tocan. El skill `verify` lo usa para elegir qué rutas mirar.

## Datos de ejemplo

`e2e/datos-de-ejemplo.ts` los carga por la API en la base `studio_manager_e2e`, con el reloj real. "Hoy" es el día de la corrida en Buenos Aires.

- Usuarios: el admin `e2e@estudio.test` y la recepción `recepcion@estudio.test`.
- Packs del seed: Clase suelta $1.500, Pack x4 $5.200, Pack x8 $9.600 y Pack x16 $17.600.
- Profesora Lucía Fernández, 50%.
- Dos horarios de Lucía: Hip-Hop (nivel Inicial) el día de la semana de hoy de 19:00 a 20:30, y Contemporáneo el día siguiente de 18:00 a 19:30.
- Alumnos: Martina García con Pack x8 en efectivo; Sofía López con Pack x4 por transferencia; Joaquín Pérez, que pagó una clase suelta con Mercado Pago al anotarse; Tomás Díaz, sin pack.
- Martina, Sofía y Joaquín están anotados en el Hip-Hop de hoy.

Con esos datos, el mes de hoy suma $16.300 de ingresos y $2.000 de sueldo para Lucía (600 + 650 + 750).

## Marcas en las rutas

`pnpm mirar` cambia estas marcas por los valores de los datos de ejemplo y los imprime al principio del resumen:

| Marca | Valor |
|---|---|
| `:alumno` | Martina García |
| `:alumno-sin-pack` | Tomás Díaz |
| `:profesor` | Lucía Fernández |
| `:clase` | El Hip-Hop de hoy |
| `:periodo` | El mes de hoy, `AAAA-MM` |

Una ruta con `?` o `&` va entre comillas: `pnpm mirar "/liquidaciones?periodo=:periodo"`.

## Rutas

| Ruta | Rol | Qué tiene que mostrar | Features |
|---|---|---|---|
| `/login` | sin sesión | El formulario de entrada. Con sesión, redirige a `/agenda`: `pnpm mirar` siempre entra antes, así que esta ruta no sirve para mirar el login. | frontend-base, rediseno-de-la-interfaz |
| `/agenda` | recepción | El día de hoy con la línea "Ahora" y el Hip-Hop de 19:00 a 20:30 de Lucía Fernández. `?fecha=AAAA-MM-DD` mira otro día. | frontend-agenda, agenda-en-lista |
| `/clases/:clase` | recepción | "Asistencia · Hip-Hop", la fecha de hoy, el buscador para anotar y la tabla de asistentes: García (Pack x8), López (Pack x4) y Pérez (Clase suelta). | frontend-agenda, asistencias, asistencia-desde-la-grilla |
| `/grilla` | recepción | La semana de hoy con Hip-Hop hoy a las 19:00 y Contemporáneo mañana a las 18:00. Las clases quedan abajo: mirá la captura `-abajo`. | grilla-semanal, navegacion-de-la-grilla, grilla-para-recepcion, asistencia-desde-la-grilla |
| `/alumnos` | recepción | Cuatro alumnos: Díaz "Sin pack"; García "Vigente", Pack x8, 7 de 8; López "Vigente", Pack x4, 3 de 4; Pérez "Sin clases", Clase suelta, 0 de 1. Al pie, "4 alumnos · 2 con el pack vigente". | frontend-alumnos, estado-del-pack-en-alumnos, baja-automatica |
| `/alumnos/:alumno` | recepción | La ficha de Martina García en una ventana sobre el listado: Vigente, Pack x8, 7 de 8, total pagado $9.600 y la clase de Hip-Hop de hoy en "Mes a mes". | ficha-del-alumno, resumen-del-alumno, clases-anotadas-en-la-actividad, pagos |
| `/alumnos/:alumno-sin-pack` | recepción | La ficha de Tomás Díaz sin pack ni clases. | ficha-del-alumno, resumen-del-alumno |
| `/asistente` | recepción | La bienvenida "Hola, <nombre>" con la caja de mensaje y las sugerencias. Sin `GEMINI_API_KEY` no responde: `pnpm mirar` no sirve para mirar una conversación. | asistente, rediseno-del-asistente, alta-de-profesor-desde-el-asistente |
| `/packs` | admin | Los cuatro packs del seed con su precio. | packs, frontend-administracion |
| `/profesores` | admin | Lucía Fernández con 50% y 2 clases por semana. | profesores, frontend-administracion |
| `/profesores/:profesor` | admin | La ficha de Lucía: Activo, 50% por alumno, 2 clases por semana, y la semana con Hip-Hop y Contemporáneo. | ficha-del-profesor |
| `/horarios` | admin | "Horario de clases" agrupado por día: Hip-Hop (Inicial) de 19:00 a 20:30 y Contemporáneo de 18:00 a 19:30, los dos de Lucía y activos. | horarios-y-sus-clases, frontend-administracion, renombrar-horario-y-clase |
| `/usuarios` | admin | Admin E2E (Administración) y Recepción Ejemplo (Recepción), los dos activos. | autenticacion, frontend-administracion |
| `/liquidaciones` | admin | Sin `periodo` abre el mes anterior, que con los datos de ejemplo está en $0. Para ver datos: `"/liquidaciones?periodo=:periodo"`. Ingresos $16.300 (efectivo $9.600, transferencia $5.200, Mercado Pago $1.500), sueldos $2.000, 3 asistencias y Lucía en el ranking. | frontend-liquidaciones, tablero-de-liquidaciones, solapas-de-liquidaciones, liquidaciones |
| `/liquidaciones?periodo=:periodo&solapa=liquidar` | admin | "0 de 1 profesores pagados", "Falta pagar $2.000" y Lucía "Sin cerrar" con $2.000. | solapas-de-liquidaciones, liquidaciones |
| `/liquidaciones?periodo=:periodo&solapa=estadisticas&profesor=:profesor` | admin | Las estadísticas de Lucía en el mes. | solapas-de-liquidaciones |
| `/liquidaciones/:profesor` | admin | Redirige a `/liquidaciones?periodo=<mes anterior>&solapa=estadisticas&profesor=<id>`. Es la dirección vieja de la ficha de liquidación. | solapas-de-liquidaciones |

Con `--rol recepcion`, el menú muestra solo Agenda, Grilla, Alumnos y Asistente, y una ruta de admin no redirige: muestra "No tenés permiso para ver esta pantalla." sin título.

Cuando una feature agrega o cambia una ruta, actualiza su fila acá.
