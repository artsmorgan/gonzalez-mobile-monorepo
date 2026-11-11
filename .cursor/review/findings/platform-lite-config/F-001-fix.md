# F-001 fix — Product flavors lite/full en Android

## Cambio
- `build.gradle`: flavors `lite` y `full` con `applicationId` y `namespace` distintos.
- Fuentes Kotlin movidas a `src/full/` y creadas en `src/lite/`.
- `google-services.json` por flavor en `src/lite/` y `src/full/`.
- `react.debuggableVariants` habilitado para ambos flavors.

## Archivos
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/android/app/src/lite/java/.../MainActivity.kt`
- `apps/mobile/android/app/src/lite/java/.../MainApplication.kt`
- `apps/mobile/android/app/src/full/java/.../` (movido desde main)
- `apps/mobile/android/app/src/lite/google-services.json`
- `apps/mobile/android/app/src/full/google-services.json`

## Verificación
```bash
cd apps/mobile/android && ./gradlew :app:assembleLiteRelease
```
APK debe tener package `com.abrjpo98.MonitoreApp.lite`.
