# F-003 fix — Sesión legacy consolidada vía authTokenStorage

## Cambio
Login y refresh en `AuthContext` delegan persistencia a `persistLegacySession`, que escribe `SESSION_MODE=legacy` y las keys canónicas de `authTokenStorage`.

Camino canónico soft-release Lite: JWT legacy (access/refresh) + token auxiliar Planillas en `planillasTokenStorage`.

## Archivos
- `apps/mobile/contexts/AuthContext.tsx`

## Verificación
1. Tras login, `AsyncStorage.getItem('auth_session_mode')` === `'legacy'`.
2. Keys `access_token`, `refresh_token`, `token_created_at` presentes.
3. Token Planillas persiste aparte vía `persistStoredPlanillasToken`.
