# F-004 — Contrato API documentado

## Decisión
`total_empleados_turno` enviado por el cliente se ignora; el servidor recalcula desde marcas (`buildColaboradoresFromMarcas`). Comportamiento intencional.

## Archivos
- `apps/server/app/api/attendance-control/route.ts` (comentario)

## Verificación
1. POST con total distinto → persistido el recalculado desde marcas.
