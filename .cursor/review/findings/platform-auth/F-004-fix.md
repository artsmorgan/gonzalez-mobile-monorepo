# F-004 fix — Import no usado eliminado

## Cambio
Removido import de `expo-router` en `AuthContext.tsx`.

## Archivos
- `apps/mobile/contexts/AuthContext.tsx`

## Verificación
`npm run lint` en apps/mobile sin warning de import no usado en AuthContext.
