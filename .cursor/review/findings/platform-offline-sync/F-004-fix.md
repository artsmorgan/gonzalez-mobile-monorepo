# F-004 fix — Preflight token con mensaje diferenciado

## Cambio
Tras alinear conectividad (F-001 platform-auth), el cancel de sync distingue:
- Sesión inválida/expirada (online tras preflight)
- Conexión perdida durante preflight

## Archivos
- `apps/mobile/App.tsx` (~L812-820)

## Verificación
1. Con colas pendientes y sesión expirada → log "sesión inválida o expirada".
2. Con red intermitente → log "conexión perdida durante preflight".
