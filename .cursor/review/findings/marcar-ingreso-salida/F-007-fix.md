# F-007 fix — Ausencia atribuida al reemplazo correcto

## Cambio
`absent-reason` resuelve `empleado_id` desde JWT; prioriza `empleadoReemplaza_id` si coincide con sesión.

## Archivos
- `apps/server/app/api/attendance/[id]/absent-reason/route.ts`

## Verificación
1. Reemplazo autenticado envía motivo de ausencia.
2. Registro usa ID del reemplazo, no del fijo.
