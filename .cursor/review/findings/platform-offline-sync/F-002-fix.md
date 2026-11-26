# F-002 fix — Alerta al usuario en error de sync

## Cambio
Cuando `actionsSyncError` está definido tras el bloque de sync, se muestra `Alert.alert('Error de sincronización', ...)` al cerrar el overlay o si no hubo overlay.

## Archivos
- `apps/mobile/App.tsx` (~L889-916)

## Verificación
1. Provocar error en sync con colas pendientes.
2. Usuario debe ver alerta con mensaje de error, no solo log en consola.
