# F-002 fix — Tokens JWT fuera de logs

## Cambio
Eliminados `console.log` que imprimían access/refresh tokens en el flujo de refresh de `AuthContext`.

## Archivos
- `apps/mobile/contexts/AuthContext.tsx`

## Verificación
1. Login + refresh forzado (token expirado).
2. Confirmar en consola que no aparecen valores de tokens JWT.
