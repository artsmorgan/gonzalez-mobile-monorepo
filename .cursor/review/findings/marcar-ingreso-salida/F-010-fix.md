# F-010 fix — Mutex en cola attendance_actions

## Cambio
Serialización con `withAttendanceActionsLock` en append, remove, write y attachPlanillasToken.

## Archivos
- `apps/mobile/hooks/attendanceActionsStorage.ts`

## Verificación
1. Sync concurrente + append offline → ninguna acción perdida en stress manual.
