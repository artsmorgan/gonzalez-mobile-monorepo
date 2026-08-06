# F-002 fix — iOS bundleIdentifier distingue Lite

## Cambio
`app.config.js` asigna:
- Lite: `com.abrjpo98.MonitoreApp.lite`
- Full: `com.abrjpo98.MonitoreApp.full`

## Archivos
- `apps/mobile/app.config.js`

## Verificación
```bash
APP_VARIANT=lite npx expo config --type public | grep bundleIdentifier
```
Debe mostrar `.lite`.
