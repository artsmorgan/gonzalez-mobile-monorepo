# F-001 fix — Sync secuencial sin Promise.all parcial

## Cambio
Reemplazado `Promise.all` de ~18 `check*ActionsCache` por bucle secuencial `for...await`, evitando sync parcial sin rollback cuando una cola falla a mitad.

Colas con dependencias (asistencia, incidentes, llaves) ya eran secuenciales; el resto ahora también.

## Archivos
- `apps/mobile/App.tsx` (~L854-876)

## Verificación
1. Simular fallo en una cola (ej. API 500 en un módulo).
2. Confirmar que colas anteriores completaron y el error se reporta vía alerta (F-002).
