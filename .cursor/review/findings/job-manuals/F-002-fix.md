# F-002 fix — horaAccion no aborta cola

## Cambio
Sync job_manuals usa `Number.isFinite(Number(horaAccion)) && Number(horaAccion) > 0` con `continue` por acción, no `return` del loop completo.

## Archivos
- `apps/mobile/App.tsx`

## Verificación
1. Acción con horaAccion inválida se omite; resto de cola sigue procesándose.
