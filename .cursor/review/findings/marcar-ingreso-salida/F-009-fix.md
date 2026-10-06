# F-009 fix — lastKnownPosition con accuracy y antigüedad

## Cambio
Fallback `getLastKnownPositionAsync` exige accuracy < 50m y edad ≤ 5 minutos.

## Archivos
- `apps/mobile/hooks/resolveDeviceCoordinates.ts`

## Verificación
1. Timeout de watch GPS en Android.
2. Posición antigua o imprecisa rechazada; se usa caché `last_location` o error.
