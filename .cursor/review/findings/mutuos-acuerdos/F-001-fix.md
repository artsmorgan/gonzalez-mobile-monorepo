# F-001 fix — Cola legacy mutuos_acuerdos_actions

**Archivo:** `apps/mobile/App.tsx` — `checkMutuosAcuerdosActionsCache`

Reemplazado el wipe incondicional por drenado de cola legacy:

- `create` → `createMutuoAcuerdo(requestData)`
- `accept` → `acceptMutuoAcuerdo`
- `sign_ejecutivo` / `reject_ejecutivo` → handlers correspondientes
- Tipos desconocidos: se conservan en cola (no se borran)
- Cache legacy solo se elimina tras vaciar la cola; se refresca desde servidor
