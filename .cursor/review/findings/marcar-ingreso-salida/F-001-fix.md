# F-001 fix — Preservar attendance_actions en cleanAsyncStorage

## Cambio
`ATTENDANCE_ACTIONS_KEY` añadido a excepciones de `cleanAsyncStorage` para no borrar cola offline al marcar entrada online.

## Archivos
- `apps/mobile/screens/MarcarIngresoSalidaScreen.tsx`

## Verificación
1. Salida offline pendiente en cola.
2. Marcar entrada online.
3. `AsyncStorage.getItem('attendance_actions')` sigue con la salida pendiente.
