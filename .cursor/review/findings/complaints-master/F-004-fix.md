# F-004 — Patrón positivo (informational)

## Decisión
`diskHydrationComplete` en `complaintsMasterFilesSync` evita sync parcial; patrón replicado en PNC vía `nonConformingProductFilesSync`.

## Archivos
- `apps/mobile/hooks/complaintsMasterFilesSync.ts` (referencia)
- `apps/mobile/hooks/nonConformingProductFilesSync.ts` (réplica)

## Verificación
N/A — finding positivo cerrado.
