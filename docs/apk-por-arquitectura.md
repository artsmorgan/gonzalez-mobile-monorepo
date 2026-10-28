# APK por arquitectura (issue #179, H10)

El APK universal pesaba ~130 MB porque lleva las librerías nativas de todas las arquitecturas. Ahora se genera **un APK por arquitectura** y cada
equipo descarga solo el suyo. La configuración vive en `apps/mobile/plugins/androidAbiSplits.js` y la aplica el plugin
`withAndroidAbiSplits.js` en cada `expo prebuild` (registrado en `app.config.js`), así que **no se pierde al regenerar `android/`**. El
`build.gradle` y el `gradle.properties` commiteados son exactamente lo que genera un `prebuild` (se comprobó ejecutándolo). La prueba automática es
`apps/server/utils/apkPorAbi.test.ts`.

## Arquitecturas

| ABI | Quién la usa |
|---|---|
| `arm64-v8a` | Prácticamente todos los teléfonos y tabletas actuales |
| `armeabi-v7a` | Equipos de 32 bits más antiguos |
| `x86_64` | Emuladores de Android Studio |

Se retiró `x86` (32 bits): no existe en equipos reales. `reactNativeArchitectures` en `gradle.properties` es la misma lista, así que Gradle ya no
compila código nativo que luego se descartaría. Si se necesitara otra arquitectura hay que cambiarla en **tres** sitios, y la prueba falla si no
coinciden: `plugins/androidAbiSplits.js`, `hooks/apkAbi.ts` y `apps/server/utils/apkFiles.ts`.

## Compilar

```bash
cd apps/mobile/android
./gradlew assembleLiteRelease     # o assembleProdRelease
```

Salen en `app/build/outputs/apk/<sabor>/release/` con el nombre `app-<sabor>-<abi>-release.apk` (por ejemplo `app-lite-arm64-v8a-release.apk`).
Para generar un solo APK universal en desarrollo: `./gradlew assembleLiteDebug -Papk.splitPerAbi=false`.

## Subir al catálogo (`/app-versions`)

Cada versión se sube **renombrando** los archivos así (la versión es la de `mobile_versions_*.json`):

| Archivo generado | Se sube como |
|---|---|
| `app-lite-arm64-v8a-release.apk` | `MonitoreApp-{version}-arm64-v8a.apk` |
| `app-lite-armeabi-v7a-release.apk` | `MonitoreApp-{version}-armeabi-v7a.apk` |
| `app-lite-x86_64-release.apk` | `MonitoreApp-{version}-x86_64.apk` |
| *(opcional)* APK universal | `MonitoreApp-{version}.apk` |

`GET /api/mobile-versions/{version}?abi=<abi>` busca primero el archivo de esa arquitectura y, si no se subió, el universal; así las versiones
anteriores (que solo tienen universal) y los equipos con una arquitectura desconocida siguen funcionando. La versión se valida (solo letras, números,
`.`, `+`, `_`, `-`): ya no se arma un nombre de archivo con texto arbitrario de la URL.

## Qué cambió en la app

- `HomeScreen` pide `?abi=` con la primera arquitectura de `Device.supportedCpuArchitectures` que tenga APK (`hooks/apkAbi.ts`); si no reconoce
  ninguna, descarga el universal.
- **Sondeo de versión.** `checkMobileVersionAvailability` se ejecutaba en cada sincronización de cachés (cada 60 s con la app abierta y conexión).
  Ahora consulta `/api/mobile-versions` como máximo cada 30 minutos (`hooks/versionCheckThrottle.ts`, marca en `last_app_version_checked_at`);
  entre consultas se repite la última respuesta real, sin red, para que el botón de actualización no desaparezca. Una consulta fallida no cuenta
  como hecha, así que se reintenta en la siguiente sincronización.

## Prueba manual (pendiente, requiere compilar)

1. Compilar `assembleLiteRelease`; verificar que salen tres APK y que ninguno pasa de ~60–70 MB (anotar los tamaños reales).
2. Subir los tres con los nombres de la tabla a `/app-versions` en el ambiente de pruebas y publicar la versión en `mobile_versions_test.json`.
3. En un teléfono `arm64-v8a`, abrir «Actualizar» y comprobar en el registro del servidor que se sirvió `MonitoreApp-{version}-arm64-v8a.apk`.
4. Borrar el archivo de esa arquitectura y repetir: debe servir el universal (`MonitoreApp-{version}.apk`) sin error.
5. Con la app abierta y conexión, comprobar en el registro del servidor que `GET /api/mobile-versions` ya no llega cada minuto.
