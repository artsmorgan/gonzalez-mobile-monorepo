# F-005 fix — Legacy cache solo tras migración exitosa

## Cambio
`removeItem('marca_cache'|'absent_reason_cache')` movido dentro del bloque try, tras `writeAttendanceActions` exitoso.

## Archivos
- `apps/mobile/App.tsx`

## Verificación
1. `marca_cache` corrupto → key legacy permanece tras error de migración.
