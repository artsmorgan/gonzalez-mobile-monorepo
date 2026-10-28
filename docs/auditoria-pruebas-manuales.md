# Guion de pruebas manuales (auditoría 1.0.2 y cambios recientes)

Los issues piden que cada «Prueba manual» se documente en el PR con **pasos, resultado, equipo o emulador y versión del APK**. Este guion reúne todas en un solo lugar para
ejecutarlas en una sola sesión. Copia la tabla de resultados al PR de cada issue.

**Antes de empezar**
- Ambiente de **pruebas** (nunca producción). Datos creados desde MonitoreApp; no inventar ni sembrar datos.
- Dos usuarios de prueba **A** y **B** de distinto alcance (B no es supervisor de A) y un **administrador** (super admin). Un equipo Android físico reciente y, si hay, uno antiguo (Android ≤ 9).
- APK de prueba compilado con estos cambios. Anota la versión: ______ · Equipo: ______ · Fecha: ______
- Para volcar el almacenamiento (solo equipo de pruebas): `adb shell run-as <paquete> ls files` / `shared_prefs`.

Leyenda del resultado: ✅ cumple · ❌ falla (adjuntar captura/log) · ➖ no aplica.

## #169 Servidor: tokens de refresco y reportes

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Con el usuario **A** (no administrador) abrir «Ingresos de usuario» o repetir `POST /api/reportes` con la operación `previewUserLoginRefreshTokens` | 403 con `code: "permission_denied"`; **la sesión sigue abierta** | |
| 2 | Lo mismo con `purgeOldReports` | 403 | |
| 3 | Con el **administrador**, la misma operación | Datos **sin** campo `token` (solo `tokenRef`, los últimos 6 caracteres) | |
| 4 | Enviar `POST /api/reportes` con un cuerpo que incluya `shouldVerifyAccessToken: false` o un `token` ajeno | No cambia el resultado (los campos de seguridad no se pueden sobrescribir) | |
| 5 | **Despliegue (coordinar con el cliente y avisar a soporte):** `cd apps/server && npx tsx scripts/revokeRefreshTokens.ts` (simulacro, solo cuenta) y luego `... --confirm` | El simulacro no cambia nada; con `--confirm` los guardas deben iniciar sesión de nuevo cuando venza su token de acceso (hasta 1 día) | |
| 6 | Tras la revocación, refrescar la sesión de un guarda | Debe pedir inicio de sesión; un inicio de sesión nuevo funciona | |

## #170 Token de Planillas fuera de las colas · #176 Colas por usuario

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Modo avión. Como **A**: marcar una salida y guardar una ubicación de puesto. Cerrar sesión | Las acciones quedan pendientes | |
| 2 | Volcar `AsyncStorage` (equipo de pruebas) | **Ninguna** cola contiene `planillasToken` ni el valor del token | |
| 3 | Entrar como **B** (con conexión). Ver «pendientes» | B **no ve** lo de A; no se sincroniza nada de A | |
| 4 | Como **B**, hacer una acción sin conexión y volver a conectar | Solo se envía la de B | |
| 5 | Volver a entrar como **A** con conexión | Sus acciones siguen ahí y se sincronizan con **su** sesión; la autoría es la de A | |
| 6 | Actualizar desde una versión anterior con acciones pendientes | No se pierde ninguna; el token desaparece de las colas | |
| 7 | Entrar como **B** con la firma manual pendiente de **A** guardada | B no ve ni sube la firma de A; la de A sobrevive | |
| 8 | Ingresar (nueva entrada) con adjuntos pendientes de A en `Paths.document` | Los archivos de A **no** se borran | |
| 9 | **Caducidad:** dejar a A con una acción y un adjunto; en el equipo de pruebas, editar `queue_owner_last_seen_v1` de A a hace más de 14 días y sincronizar como B con conexión | Se eliminan las acciones de A **y** su adjunto; lo de B queda intacto | |
| 10 | Repetir 9 con A a hace **menos** de 14 días, y reconectar A | No se borra nada; A sincroniza | |

## #171 y #175 Importación de Excel

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Importar la plantilla oficial de mantenimiento de equipo con pocos registros | Importa igual que antes | |
| 2 | Importar un `.xlsx` de más de 5 MB | Se rechaza de inmediato con el mensaje del máximo, sin congelar la app | |
| 3 | Plantilla con una celda de más de 2.000 caracteres | La fila se reporta como error con su número | |
| 4 | Elegir un archivo y salir de la pantalla (o elegir otro) enseguida | No aparece ningún mensaje del primero | |
| 5 | Importar el **libro real anonimizado** de González | Mismo resultado que con la versión anterior de la app | |

## #173 Almacenamiento seguro · #174 Causas de fallo · #172 Plazos

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Actualizar sobre una versión anterior con sesión iniciada | La sesión se conserva; no quedan tokens en `AsyncStorage` | |
| 2 | Iniciar y cerrar sesión normalmente | `secure_pending_deletes` no existe o está vacío | |
| 3 | Con un usuario sin permiso, abrir una vista restringida | Mensaje de permiso; **la sesión sigue abierta** | |
| 4 | Modo avión durante una operación y volver | No se cierra la sesión | |
| 5 | Operación lenta (red muy mala) | La pantalla no queda cargando para siempre: falla a los 20/30 s con mensaje | |
| 5b | **Idempotencia (#172):** con la migración `20261027120001_clave_idempotencia` aplicada, hacer que el servidor tarde más de 30 s en responder una marca de entrada | El teléfono reintenta una vez con la misma clave y **no** se crea una segunda marca; la acción pendiente no se pierde | |
| 5c | Repetir `PUT /api/attendance/{marca}` con la misma `Idempotency-Key` | Misma respuesta con `Idempotent-Replay: true`; la marca no cambia otra vez | |
| 6 | (Guardify en `on`) Revocar solo la sesión de un guarda | La app avisa «Un administrador cerró tu sesión» y vuelve al inicio | |

## #177 / #180 Android: permisos y copias de seguridad

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Instalar y revisar Ajustes → Permisos de la app | Solo los de la lista permitida (`apps/mobile/android-permissions.json`); sin superposición ni almacenamiento externo | |
| 2 | Cámara, micrófono, ubicación, notificaciones | Se piden **al usarlos**, no al arrancar; funcionan | |
| 3 | Actualizar la app descargando el APK | Funciona (pide «instalar apps desconocidas») | |
| 4 | Guardar y compartir un reporte descargado | Funciona sin almacenamiento compartido (probar en Android reciente y en ≤ 9) | |
| 5 | `adb backup` / `bmgr` y restauración en un equipo antiguo y uno reciente | No se recuperan tokens ni datos; la app pide iniciar sesión | |

## #178 Caché de la jerarquía

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Sincronizar la jerarquía con conexión y abrir una pantalla que la use | Carga | |
| 2 | Modo avión, forzar cierre y reabrir | La jerarquía carga sin conexión | |
| 3 | Con jerarquía grande, forzar el cierre durante «Actualizar jerarquía» y reabrir sin conexión | Carga la versión anterior; no queda vacía | |
| 4 | Simular una respuesta inválida del servidor (HTML) | Muestra el error y conserva la jerarquía anterior | |

## #179 APK por arquitectura y sondeo de versión

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | `cd apps/mobile/android && ./gradlew assembleLiteRelease` | Salen **tres** APK (`arm64-v8a`, `armeabi-v7a`, `x86_64`); anotar los tamaños: ______ | |
| 2 | Subirlos a `/app-versions` como `MonitoreApp-{version}-{abi}.apk` y publicar la versión en `mobile_versions_test.json` | Aparece como actualización disponible | |
| 3 | En un teléfono arm64, «Actualizar» | El servidor sirve `...-arm64-v8a.apk` (ver el registro) | |
| 4 | Borrar el archivo de esa arquitectura y repetir | Sirve el universal sin error | |
| 5 | App abierta con conexión durante 5 minutos | `GET /api/mobile-versions` ya no llega cada minuto (≈ cada 30 min) | |

## #181 Servidor: alcance por objeto (dos usuarios reales)

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Como **A**: `GET /api/check-permissions?id=<id de B>` | 403 `permission_denied` | |
| 2 | Como **A**: `GET /api/attendance/user/<id de B>` y `/next` | 403 | |
| 3 | Como **A**: `PUT /api/attendance/<marca de B>` (entrada/salida), `.../revert-leaving`, `.../absent-reason` | 403 | |
| 4 | Como **A** con su propia marca (y como reemplazo de otra) | Funciona | |
| 5 | Como **administrador** sobre la marca de B | Funciona | |
| 6 | Build de **producción**: `POST /api/attendance/<id>/dev-create-marca` y `GET /api/lunch-time/<id>/test-ending-time` | 404 | |
| 7 | Build de pruebas: botón «marca de prueba» | Crea la marca solo para la propia persona | |
| 8 | `POST /api/empleados` | 405 | |
| 9 | Aprobar un mutuo acuerdo con Planillas **caído o con token vencido** | Error; el mutuo **sigue pendiente** y se puede reintentar | |
| 10 | Carga masiva con todo ya existente | Responde 0 planes y 0 entregas sin llamar a Planillas | |
| 11 | Revisar `error_logs` tras provocar un error | Mensaje real del error y código HTTP, **sin** tokens ni contraseñas | |

## Cambios recientes (no pertenecen a un issue)

**Solicitud de permiso**

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Elegir fecha inicio posterior a la de fin | La de fin pasa a la fecha de inicio | |
| 2 | Elegir fecha fin anterior a la de inicio | La de inicio pasa a la fecha de fin | |
| 3 | Mismo día con horas distintas | La hora de fin nunca queda antes de la de inicio | |

**Tiempo de alimentación**

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Abrir con conexión | Se descargan los minutos del horario y el contador queda en ese valor | |
| 2 | Cambiar los minutos del horario en el servidor; con el contador **sin iniciar**, deslizar hacia abajo estando arriba del todo | El contador se actualiza | |
| 3 | Repetir 2 con el contador **corriendo**, **en pausa** o ya iniciado | No cambia nada | |
| 4 | Repetir 2 sin conexión | No cambia nada ni falla | |
| 5 | Pantalla de alimentación | **No** hay botón de editar (lápiz) ni de reiniciar | |
| 6 | Pulsar iniciar por primera vez | Pide confirmación (Cancelar / Iniciar); reanudar una pausa **no** vuelve a preguntar | |
| 7 | Probar con 5, 30, 90 minutos y 1 h 30 en un teléfono pequeño y en uno grande, y con el texto del sistema agrandado | El contador queda siempre en **una línea** | |

**Header**

| # | Paso | Esperado | Resultado |
|---|---|---|---|
| 1 | Iniciar sesión y entrar directo a Marcar ingreso/salida; tocar la flecha de regreso | Va a Home y la pila queda solo con Home | |
| 2 | Desde Home abrir una pantalla y tocar la flecha | Regresa a Home normalmente | |

## Resumen para el PR

Copiar por issue: versión del APK, equipo (marca/modelo/Android), ambiente, fecha, y la tabla de resultados de arriba con las capturas de los ❌.
