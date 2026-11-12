# Asistente y Gemini

## Tests

- Los tests nunca llaman a Google. `crearAppDeTest` pasa `modelo: null`.
- Para probar el ciclo de herramientas se usa `crearModeloFalso(guion)` de `apps/api/test/modelo-falso.ts`, que guarda cada pedido en `modelo.pedidos`.
- Gemini responde 400 si una llamada a función vuelve sin su `thoughtSignature`: el historial es opaco y nunca se rearma.
- La clave va en `GEMINI_API_KEY` de `apps/api/.env`.

## Cuota

`gemini-3.5-flash` gratis permite 20 pedidos por día y cada consulta al asistente usa de 2 a 4. Los 503 por saturación son frecuentes en los dos modelos. Antes de correr `asistente:probar`, probá una sola frase (`pnpm --filter @studio/api asistente:probar <n>`).

## Verlo en Chromium

- API con la base del e2e en otro puerto, `WEB_DIST=../web/dist` y `NODE_ENV=development`. Con `production` la cookie de sesión es `secure` y el login por http no anda.
- Las variables del entorno ganan sobre `--env-file`: `GEMINI_MODELO=...` en la línea de comando elige el modelo.
- Más sobre la base del e2e en `e2e.md`.

## Frontend

La conversación vive en `ProveedorDeConversacion`, montado dentro de `RequiereSesion` con la clave del usuario: navegar no la borra, recargar o cerrar sesión sí.
