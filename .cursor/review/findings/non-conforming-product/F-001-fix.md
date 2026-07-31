# F-001 fix — Adjuntos PNC en disco, no base64 en cola

## Cambio
Offline create/update encola `stored_file_name` bajo `Paths.document`. Sync en `App.tsx` hidrata a base64 con `buildNonConformingProductRequestDataForSync` y borra archivos tras éxito.

## Archivos
- `apps/mobile/hooks/nonConformingProductFilesSync.ts` (nuevo)
- `apps/mobile/screens/NonConformingProductScreen.tsx`
- `apps/mobile/App.tsx`
- `apps/mobile/hooks/collectPendingSyncLocalFileNames.ts`

## Verificación
1. Crear PNC offline con foto → `evaluations_actions` sin `file_base64` largo, solo `stored_file_name`.
2. Reconectar → sync crea registro y elimina archivos locales pendientes.
