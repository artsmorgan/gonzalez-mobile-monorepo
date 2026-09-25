# F-001 — Online-only por diseño (Lite)

## Decisión
Control de asistencia requiere marcas en tiempo real del servidor. Pantalla bloquea offline; no se encola create/update. Handlers en `App.tsx` se mantienen solo para cola legacy (`delete_image`).

## Archivos
- `apps/mobile/screens/AttendanceControlScreen.tsx` (comentario)

## Verificación
1. Sin red → mensaje "exclusivamente con internet".
2. No se generan nuevas entradas `attendance_control` en cola desde UI.
