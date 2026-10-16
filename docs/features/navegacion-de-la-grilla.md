# Navegación de la grilla

**Estado:** lista  
**Depende de:** grilla-semanal  
**Listo cuando:** `pnpm test` y `pnpm typecheck` pasan; en `/grilla`, entre las flechas se lee el período que se ve y el botón para volver aparece solo fuera del presente, con el texto de la vista.

> **Para el agente:** leé primero [CLAUDE.md](../../CLAUDE.md) y [el índice de features](index.md). Trabajá una tarea por vez y marcá cada checkbox recién cuando su verificación pasa.

## Qué cambia

En la [grilla semanal](grilla-semanal.md), la barra tenía "‹ Hoy ›" a la derecha en las tres vistas. El estudio pidió que el botón cambie con la vista y eligió el diseño entre cuatro prototipos en la app real. Los prototipos quedaron en la rama `prototipo/boton-hoy` (commit `a12aa07`), fuera de main. Se eligió la variante C:

- **Entre las flechas va el período que se ve**, en un bloque con borde: "Martes 10" en Día, "9 – 15 mar" en Semana ("30 mar – 5 abr" si cruza de mes) y "Marzo" en Mes.
- **En el presente**, a la izquierda de las flechas dice "Hoy", "Esta semana" o "Este mes" en gris, con un punto azul. No es un botón: tocarlo no haría nada.
- **Fuera del presente**, en ese lugar aparece un botón azul con el ícono de historial: "Volver a hoy", "Volver a esta semana" o "Volver a este mes". Lleva al período de hoy sin cambiar de vista.
- **Ventanas angostas:** "Día / Semana / Mes" está centrado sobre la tarjeta, y debajo de 1280 px de ancho el botón "Volver a esta semana" lo pisa. Debajo de `xl`, el botón muestra solo el ícono (el nombre sigue en `aria-label` y `title`) y la marca del presente se esconde.

"El presente" es el período que contiene a hoy: `periodoDe(vista, hoy).desde === periodo.desde`. En la vista Mes compara el lunes de la primera semana, que es distinto para cada mes.

## Tests

| Test | Tipo | Qué cambio lo rompe |
|---|---|---|
| El botón que vuelve al presente dice "Hoy", "Esta semana" o "Este mes" según la vista, y "Este mes" vuelve al mes de hoy | Web (tarea 1; la tarea 2 lo reemplaza) | Dejar el texto fijo o que el botón pierda la vista al volver |
| En la semana de hoy se lee "Esta semana" sin botón y "9 – 15 mar"; en la siguiente aparece "Volver a esta semana" y lleva a la de hoy sin parámetros en la dirección | Web (cambia el de las flechas en `grilla.test.tsx`) | Mostrar el botón en el presente, o que volver deje `fecha` en la dirección |
| Una semana que cruza de mes dice "30 mar – 5 abr"; en Mes se lee "Marzo" con "Este mes" sin botón, "Abril" con "Volver a este mes", y volver deja `?vista=mes`; en Día se lee "Martes 10" con "Hoy" | Web (reemplaza el de la tarea 1 en `grilla-vistas.test.tsx`) | Formatear el rango sin el mes de cada punta, comparar el mes por el rango con las semanas de relleno, o que volver cambie de vista |

jsdom no calcula el diseño: que la barra no se pise a 1024 px se mira en Chromium con un script de capturas fuera del repo, como dice CLAUDE.md.

---

### Tarea 1: El texto del botón cambia con la vista

**Archivos:**
- Modificar: `apps/web/src/features/grilla/GrillaPage.tsx`
- Test: `apps/web/src/features/grilla/grilla.test.tsx`, `apps/web/src/features/grilla/grilla-vistas.test.tsx`

- [x] **Paso 1:** sumar el test de los tres textos del botón y cambiar "Hoy" por "Esta semana" en el test de las flechas.
- [x] **Paso 2:** correrlos y verificar que fallan porque no encuentran el botón con el texto nuevo.
- [x] **Paso 3:** agregar `actual` a `periodoDe` y usarlo en el botón.
- [x] **Paso 4:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** commit `feat(grilla): el botón "Hoy" dice "Esta semana" o "Este mes" según la vista` (`96a17a2`).

### Tarea 2: El período entre las flechas y "Volver" solo fuera del presente

**Archivos:**
- Modificar: `apps/web/src/features/grilla/GrillaPage.tsx`
- Test: `apps/web/src/features/grilla/grilla.test.tsx`, `apps/web/src/features/grilla/grilla-vistas.test.tsx`

- [x] **Paso 1:** cambiar el test de las flechas de `grilla.test.tsx` y reemplazar el de la tarea 1 en `grilla-vistas.test.tsx`, como dice la tabla de tests.
- [x] **Paso 2:** correrlos y verificar que fallan porque no hay período entre las flechas ni botón "Volver".
- [x] **Paso 3:** agregar `rango` a `periodoDe`, calcular si se está en el presente y armar la barra.
- [x] **Paso 4:** correr los tests de la web y `pnpm typecheck`, y verificar que pasan.
- [x] **Paso 5:** mirar en Chromium, a 1280 y a 1024 px, la semana de hoy y una semana siguiente: "Volver a esta semana" no pisa "Día / Semana / Mes".
- [x] **Paso 6:** commit `feat(grilla): el período entre las flechas y "Volver" fuera del presente`.

## Verificación final

- [x] `pnpm test` y `pnpm typecheck` pasan: web 149, API 28 archivos sin cambios.
