# F-002 fix — Salida no falla tras éxito en Planillas

## Cambio
`marcar_salida` ya no retorna error si `check_unmarked_activities` falla después de registrar salida en Planillas; se registra warning y retorna éxito.

## Archivos
- `apps/server/app/api/attendance/[id]/route.ts`

## Verificación
1. Simular fallo en check_unmarked_activities tras salida Planillas OK.
2. API retorna `{ status: true }`.
3. Sync desencola la acción offline.
