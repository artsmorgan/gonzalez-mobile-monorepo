# F-003 fix — Perfiles EAS production-lite/full

## Cambio
Añadidos perfiles `production-lite` y `production-full` con `gradleCommand` explícito por flavor.
Perfiles `preview-*` actualizados con `assembleLiteRelease` / `assembleFullRelease`.

## Archivos
- `apps/mobile/eas.json`

## Verificación
```bash
eas build --profile preview-lite --platform android --local
```
Debe compilar variant `liteRelease`.
