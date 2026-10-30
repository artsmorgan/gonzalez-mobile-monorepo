# F-003 fix — God object App.tsx (deuda aceptada soft-release)

## Decisión
Extracción del motor de sync a hooks por dominio queda **fuera de scope** para soft-release Lite, según el propio `suggested_fix` del finding.

## Mitigaciones aplicadas
- F-001: sync secuencial reduce regresiones cruzadas entre colas.
- F-002: feedback visible al usuario en errores.
- Validación global `validate-module.ps1` + revisión adversarial por módulo.

## Archivos
Sin extracción en esta iteración. Deuda documentada para post-release.

## Verificación
N/A — aceptado para soft-001. Trackear extracción como tarea post-release.
