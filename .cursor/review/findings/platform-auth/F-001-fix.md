# F-001 fix — Criterio de conectividad unificado

## Cambio
`getValidAccessTokenOrLogout` ahora usa `resolveAppConnectivity()` en lugar de exigir `isInternetReachable === true`.

## Archivos
- `apps/mobile/hooks/getValidAccessTokenOrLogout.ts`

## Verificación
1. Con WiFi conectado y `isInternetReachable` null, `resolveAppConnectivity().ok` debe ser true.
2. Iniciar sync con colas pendientes: preflight ya no aborta por reach null transitorio.
