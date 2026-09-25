# Pantallas de alumnos y pagos

**Estado:** lista  
**Depende de:** frontend-base, alumnos, pagos  
**Listo cuando:** `pnpm test` pasa; recepción busca alumnos, los crea y edita, y desde la ficha de un alumno ve sus pagos, registra uno nuevo y anula uno mal cargado.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

**Spec:** [Arquitectura del frontend](../arquitectura%20frontend.md); API en [alumnos](alumnos.md) y [pagos](pagos.md).

## Pantallas

**`/alumnos`**
- Buscador que filtra mientras se escribe (espera 250 ms desde la última tecla).
- Tabla: apellido y nombre, DNI, teléfono, estado. Cada fila lleva a la ficha.
- Casilla "Mostrar dados de baja".
- Paginación de a 20, con el total.
- Botón "Nuevo alumno" que abre el formulario en un diálogo.

**`/alumnos/:id`** (ficha)
- Datos del alumno, botón "Editar" (mismo formulario) y "Dar de baja" / "Reactivar".
- Tabla de pagos: pack, fecha de compra, vencimiento, clases (restantes de total), monto, medio y estado (Vigente, Sin clases, Vencido, Anulado).
- Botón "Registrar pago": elige pack activo y medio.
- En cada pago no anulado, "Anular": pide el motivo.

## Decisiones

- **Los errores de la API se muestran donde corresponden:** los `detalles` de un 400 van al campo; un 422 (DNI repetido, pago con asistencias) va como aviso arriba del formulario.
- **El formulario usa `crearAlumnoSchema`** de `packages/shared`: los mismos mensajes que la API.
- **Estado de un pago en la ficha**, en este orden: Anulado, Vencido, Sin clases, Vigente. Un pago vencido con clases sin usar se muestra como Vencido: ya no se puede usar.
- **Después de guardar** se recargan las consultas afectadas (`alumnos`, `pagos`), no se edita la caché a mano.

## Tests

| Test | Por qué vale la pena: qué cambio lo rompe |
|---|---|
| Buscar "garcia" pide `/api/alumnos?q=garcia` y muestra el resultado | Si el buscador no manda `q` o no espera a que se deje de escribir, recepción no encuentra a nadie o se hace un pedido por tecla |
| Crear un alumno manda los datos y el nuevo aparece en la tabla | Si no se recarga el listado después de crear, recepción cree que no se guardó y lo carga dos veces |
| Un DNI repetido muestra el mensaje de la API en el formulario y no lo cierra | Si el error se traga, recepción pierde lo que escribió sin saber por qué |
| La ficha muestra cada pago con su estado, clases y monto en pesos | Si el estado se calcula mal (un anulado como vigente) o el monto se muestra sin formato |
| Registrar un pago manda pack y medio y recarga la lista | Si el formulario manda el pack como texto o no recarga, el pago no aparece |
| Anular un pago manda el motivo | Si se anula sin motivo, la API responde 400 y el botón parece no andar |

---

### Tarea 1: Listado y formulario de alumnos

**Archivos:**
- Crear: `apps/web/src/features/alumnos/api.ts`, `AlumnosPage.tsx`, `AlumnoForm.tsx`
- Crear: `apps/web/src/lib/formularios.ts` — pasar `detalles` de la API a los campos.
- Crear: `apps/web/src/lib/useDemorado.ts`
- Crear: `apps/web/test/datos.ts` — constructores de alumnos, packs y pagos para MSW.
- Test: `apps/web/src/features/alumnos/alumnos.test.tsx`

- [x] **Paso 1:** escribir los 3 primeros tests de la tabla.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): listado, búsqueda y alta de alumnos`.

### Tarea 2: Ficha del alumno con pagos

**Archivos:**
- Crear: `apps/web/src/features/alumnos/FichaAlumnoPage.tsx`
- Crear: `apps/web/src/features/pagos/api.ts`, `PagosDelAlumno.tsx`
- Crear: `apps/web/src/features/packs/api.ts`
- Test: `apps/web/src/features/alumnos/ficha.test.tsx`

- [x] **Paso 1:** escribir los 3 tests de la ficha.
- [x] **Paso 2:** correrlos y verificar que fallan.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** correr los tests y verificar que pasan.
- [x] **Paso 5:** commit `feat(web): ficha del alumno con pagos`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan.
