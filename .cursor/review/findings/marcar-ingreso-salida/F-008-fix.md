# F-008 fix — horaAccion consistente en confirmAction

## Cambio
`validateBeforeMarkAction` retorna `horaAccionMs`; `confirmAction` usa ese valor en saveMarca y cola offline (no state stale).

## Archivos
- `apps/mobile/screens/MarcarIngresoSalidaScreen.tsx`

## Verificación
1. Validar y confirmar marca en el mismo flujo.
2. Timestamp enviado a API coincide con el usado en validación local.
