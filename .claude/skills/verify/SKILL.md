---
name: verify
description: Levanta la app con datos de ejemplo y captura pantallas con `pnpm mirar` para ver que un cambio funciona en la app real. Usalo antes de cerrar una tarea que toca `apps/web/` o una respuesta de la API que una pantalla muestra, y cuando haga falta ver la app funcionando.
---

# Verificar en la app real

Los tests no muestran si una pantalla se ve bien. `pnpm mirar` prepara la base `studio_manager_e2e`, compila el frontend, carga datos de ejemplo, levanta la API en el puerto 3101, entra con Chromium y guarda una captura por ruta en `e2e/capturas/`.

Necesita Docker con el contenedor `studio-manager-db` corriendo. Si `docker info` falla, esperá a que responda; si el contenedor está apagado, `docker start studio-manager-db`.

## Pasos

1. Elegí las rutas en [docs/mapa-de-pantallas.md](../../../docs/mapa-de-pantallas.md): las que muestran lo que cambió y las que tocan las mismas features. Anotá qué tiene que mostrar cada una según la feature y el mapa.
2. Corré `pnpm mirar <rutas>`. Desde Git Bash, con `MSYS_NO_PATHCONV=1` adelante, si no Git Bash convierte `/alumnos` en una ruta de Windows y el script se niega.
3. Leé el resumen. Sale con código 1 si una ruta tuvo errores de consola, errores de página o respuestas con estado 400 o más, y los nombra debajo de la ruta.
4. Abrí cada captura con `Read`. Si hay una captura `-abajo`, abrila también: es la misma pantalla con el scroll hasta el final.
5. Compará cada captura con lo que anotaste en el paso 1. Buscá datos que faltan, números que no cierran, textos cortados, columnas desalineadas, estados vacíos donde tendría que haber datos y botones que no corresponden al rol.
6. Si corregís algo, volvé al paso 2. Si solo cambió la API o los datos, `--sin-preparar` reusa la base y el `dist` y tarda unos 5 segundos; si cambió `apps/web/`, corré sin esa opción para recompilar.

## Opciones

```sh
pnpm mirar /alumnos /alumnos/:alumno "/liquidaciones?periodo=:periodo"
pnpm mirar /agenda /liquidaciones --rol recepcion
pnpm mirar /grilla --ancho 390
pnpm mirar /clases/:clase --sin-preparar
```

- `--rol admin|recepcion`: con qué usuario entra. Por defecto, admin.
- `--ancho <px>`: el ancho de la ventana, para pantallas angostas. Por defecto, 1280.
- `--sin-preparar`: no borra la base ni compila. Sirve después de una corrida completa.
- Las marcas `:alumno`, `:alumno-sin-pack`, `:profesor`, `:clase` y `:periodo` se cambian por los datos de ejemplo. El mapa dice qué es cada una.
- Una ruta con `?` o `&` va entre comillas.

## Cuándo parar

- Tres intentos fallidos sobre el mismo problema: pará y avisá qué viste, qué probaste y qué captura lo muestra.
- Si el puerto 3101 está ocupado, el script lo dice. Buscá el proceso con `netstat -ano`; cerralo solo si es de este proyecto.
- Al terminar, `netstat -ano` no tiene que mostrar nada escuchando en el 3101. El script cierra la API también cuando falla.

En el resumen de la tarea, escribí qué rutas miraste y qué viste en cada captura, y sumá `pnpm mirar` a la línea `Verificado:` del commit.
