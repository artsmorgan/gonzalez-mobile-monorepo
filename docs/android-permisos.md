# Permisos y copias de seguridad de Android (issues #177 y #180)

La política vive en `apps/mobile/plugins/androidSecurityPolicy.js` y la aplica el plugin `withAndroidSecurityPolicy.js` en cada `expo prebuild`
(registrado en `app.config.js`), así que **no se pierde al regenerar `android/`**. El manifiesto y los XML que están commiteados son exactamente lo
que genera un `prebuild` (se comprobó ejecutándolo). La prueba automática es `apps/server/utils/androidSecurityPolicy.test.ts`.

## Permisos

La lista **permitida** (con la función y el momento en que se pide) es `apps/mobile/android-permissions.json`. Un permiso nuevo en el
manifiesto sin entrada ahí hace fallar la prueba: hay que justificarlo antes.

| Permiso | Función de la app | Cuándo se pide |
|---|---|---|
| `INTERNET` | Toda la app (API del servidor) | Instalación |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Marcas de ingreso/salida, evidencia de cada acción, ubicación del puesto | Al usar la función (en tiempo de ejecución) |
| `CAMERA` | Escáner QR y fotos de los módulos | Al abrir la cámara |
| `RECORD_AUDIO` | Notas de voz | Al grabar |
| `MODIFY_AUDIO_SETTINGS` | Lo exige `expo-audio` para el modo de audio de las notas de voz | Instalación (permiso normal) |
| `POST_NOTIFICATIONS` | Notificaciones push (Android 13+) | Al registrar las notificaciones |
| `RECEIVE_BOOT_COMPLETED` | `expo-notifications` reprograma las notificaciones tras reiniciar | Instalación (permiso normal) |
| `VIBRATE` | Notificaciones y respuesta háptica | Instalación (permiso normal) |
| `REQUEST_INSTALL_PACKAGES` | Actualización descargando el APK | El sistema pide «instalar apps desconocidas» al actualizar. **Retirar si se deja de distribuir por descarga.** |

### Permisos retirados

Se agregan con `tools:node="remove"`, que además limpia los que aportan las librerías al fusionar manifiestos.

| Permiso | Por qué se retiró |
|---|---|
| `SYSTEM_ALERT_WINDOW` | Superposición sobre otras apps. Solo lo usa el menú de desarrollo, y el manifiesto de **debug** lo declara por su cuenta: el release no lo necesita y el modo debug no se ve afectado. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | La app guarda sus archivos en su almacenamiento propio (`Paths.document`) y descarga con el selector de carpetas del sistema (SAF); no lee ni escribe almacenamiento compartido. Los declara `expo-file-system` por defecto. |

**Prueba manual pendiente (del issue):** con un equipo de Android reciente comprobar cámara, micrófono, ubicación y la actualización por APK, y
guardar/compartir un reporte descargado. Si algo dependiera del almacenamiento compartido en Android ≤ 9, se vuelve a agregar solo para ese caso con
`android:maxSdkVersion="28"`.

## Copias de seguridad

Decisión: **ningún dato de la app viaja en copias de seguridad ni en la transferencia entre equipos.** Lo que guarda la app es sensible (sesión en
SecureStore/SharedPreferences, colas sin conexión, jerarquía, ubicaciones, vehículos, visitas y firmas en `AsyncStorage`/archivos) o se regenera al
iniciar sesión.

- `res/xml/backup_rules.xml` (Android 11 e inferior, `android:fullBackupContent`) y `res/xml/data_extraction_rules.xml` (Android 12+,
  `android:dataExtractionRules`, para la copia en la nube y la transferencia entre equipos) excluyen los dominios `root`, `file`, `database`,
  `sharedpref` y `external`.
- `android:allowBackup` sigue en `true` para que el sistema aplique estas reglas; si más adelante se decide respaldar algo, se agrega un
  `<include>` explícito y se cifra con una clave del Keystore.

**Prueba manual pendiente (del informe):** `adb backup` / `bmgr` y restauración en un equipo antiguo y uno reciente: no se recuperan tokens ni datos
excluidos y la app pide iniciar sesión.
