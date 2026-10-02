# F-004 fix — Validar auto-cierre de turno anterior

## Cambio
Entrada aborta si `marcar_salida` del turno anterior falla, con mensaje explícito.

## Archivos
- `apps/server/app/api/attendance/[id]/route.ts`

## Verificación
1. Turno anterior abierto + fallo simulado en auto-cierre.
2. Nueva entrada rechazada con mensaje "No se pudo cerrar el turno anterior".
