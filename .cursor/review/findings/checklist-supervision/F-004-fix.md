# F-004 fix — Soft delete en servidor

## Cambio
`DELETE /api/checklist-supervision/[id]` ahora hace `UPDATE isActive: false` en lugar de borrado físico, alineado con filtro del cliente.

## Archivos
- `apps/server/app/api/checklist-supervision/[id]/route.ts`

## Verificación
1. Eliminar checklist online → registro no aparece en GET (filtro `isActive`).
2. Caché en otro dispositivo eventualmente coherente tras refresh.
