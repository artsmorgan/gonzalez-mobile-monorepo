# F-002 fix — Tipo unificado `agenda_minuta`

## Cambio
Helpers normalizan `physical_minute_agenda` → `agenda_minuta` en caché/cola al leer y al iniciar sync de evaluaciones. Encolado nuevo siempre usa `agenda_minuta`.

## Archivos
- `apps/mobile/hooks/agendaMinutaCacheHelpers.ts`
- `apps/mobile/screens/PhysicalMinuteAgendaScreen.tsx`
- `apps/mobile/App.tsx`

## Verificación
1. Cola legacy con `physical_minute_agenda` se migra a `agenda_minuta` en primer sync.
