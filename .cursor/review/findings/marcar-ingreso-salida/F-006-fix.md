# F-006 fix — fin_marca turnos nocturnos alineado con cliente

## Cambio
Servidor calcula `fin_marca` como fecha+1 + `hora_fin` (sin mutar `marcaDia.fecha` in-place).

## Archivos
- `apps/server/app/api/attendance/user/[id]/route.ts`

## Verificación
1. Turno 22:00–06:00 sin horas_duracion.
2. Comparar `fin_marca` servidor vs `computeMarcaShiftBounds` cliente → deben coincidir.
