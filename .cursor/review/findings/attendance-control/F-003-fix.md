# F-003 — Política híbrida documentada

## Decisión
Solo `delete_image` admite cola offline (adjunto ya persistido en servidor). Create/update permanecen online-only; coherente con F-001.

## Archivos
- `apps/mobile/screens/AttendanceControlScreen.tsx`

## Verificación
1. Offline delete imagen → encola `attendance_control_delete_image`.
2. Offline create → bloqueado en UI.
