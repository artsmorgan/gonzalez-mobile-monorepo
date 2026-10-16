# F-003 fix — Desencolar respuestas idempotentes

## Cambio
- Servidor añade `already_synced: true` en "Ya has marcado la salida".
- `isAttendanceSyncResponseApplied()` en `attendanceActionsStorage`.
- `checkAttendanceActionsCache` usa helper para desencolar.

## Archivos
- `apps/server/app/api/attendance/[id]/route.ts`
- `apps/mobile/hooks/attendanceActionsStorage.ts`
- `apps/mobile/App.tsx`

## Verificación
1. Cola con salida ya aplicada en servidor.
2. Sync → acción removida de `attendance_actions`.
