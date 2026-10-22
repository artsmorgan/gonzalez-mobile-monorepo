# Plan de pruebas de `test-soft-001` sin depender de Guardify

Cubre los cambios de los issues #137–#163 que se pueden comprobar **sin las credenciales de Guardify**. Lo que sí depende de Guardify real (registro y aprobación del equipo, órdenes, catálogo de APK) está al final, en «Pendiente de Guardify».

Marca cada casilla al probarla y anota lo que falle (pantalla, pasos, mensaje).

## 0. Preparación (una sola vez)

- [ ] **Base de datos.** Correr `verificar_columnas_antes_de_migrar.sql` (dynamic-api): sus resultados deben estar vacíos. Luego `npm run db:migrate` y comprobar que están las 6 migraciones: `20261020120001`, `20261020120002`, `20261021120001`, `20261021130001`, `20261021140001`, `20261022120001`.
- [ ] **Servidor** (`apps/server/.env`): `GUARDIFY_DEVICE_ENFORCE=observe` (o sin variable), sin `GUARDIFY_URL`; `EVIDENCE_SIGNING_KEY` definida; para la sección 2, `GUARDIFY_REPORTS_API_KEY` con una llave aleatoria de 24+ caracteres que generas tú (no depende de Guardify).
- [ ] **App** (`apps/mobile/.env`, una variable por línea): `EXPO_PUBLIC_API_SERVER`, `EXPO_PUBLIC_MOBILE_ACCESS_TOKEN`, `APP_VARIANT=lite`. **Sin** `EXPO_PUBLIC_GUARDIFY_ENABLED` (Guardify está bloqueado por defecto): la app se comporta como antes aunque haya URL. Para el simulacro (sección 4) hay que encenderlo.
- [ ] **APK nuevo** de la variante `lite` (módulos nativos nuevos: `expo-secure-store`, `expo-battery`). Probar primero **actualizando sobre el APK anterior** (sección 3.1) y después con una instalación limpia.
- [ ] Servicio dinámico en `:3001`, servidor en `:3000`, túnel hacia el servidor.

## 1. Pruebas automáticas (5 minutos)

- [ ] `cd apps/server && npx tsx --test $(find utils app -name "*.test.ts")`: esperado 31 fallos que ya existían (no son de estos cambios) y ninguno nuevo.
- [ ] `npx tsc --noEmit -p .` en el servidor: 0 errores. En el móvil: 333 líneas de errores previas, sin ninguna nueva.

## 2. Servidor y reportes con `curl` (sin app)

Con `Authorization: Bearer <GUARDIFY_REPORTS_API_KEY>` y `x-guardify-user: tu@correo`:

- [ ] `GET /api/guardify/reports/cambios_ubicacion_puesto` devuelve `latitud` y `longitud` numéricas; con `f.latitud.ge=9` y `f.latitud.le=10` filtra; `sort=latitud` ordena (#137).
- [ ] `acta_entrega_productos`: `consecutivo` con formato `0001`, filtro `f.consecutivo.contains=0001` (#138).
- [ ] `registro_vehiculos_corporativos` y `revision_vehiculos`: `vin`, `titulo_propiedad_num`, `rtv_num`, `marchamo_num` (#139, #143).
- [ ] `articulos_puesto`: `estado` y `accion` del último mantenimiento; sin consultas por fila (#140).
- [ ] `registro_induccion_recorrido`: `tipo_capacitacion` y `empleado` con `contains`, búsqueda y orden (#142).
- [ ] Las 5 columnas de evidencia (`dispositivo`, `latitud`, `longitud`, `firma`, `cedula`) en un módulo con registros nuevos; vacías en registros anteriores (#153).
- [ ] Documentos: `POST /api/guardify/documents` (multipart), `…/preview`, `…/dispatches` con `standing: true` y `…/dispatches/{id}/end` responden según `docs/guardify/protocolo-documentos.md` (#157, #163). Probar `audience` = `units`, `app_users` y `company`.
- [ ] Sin la llave (o con una incorrecta) la API responde 401/503.

## 3. App en el teléfono

### 3.1 Almacenamiento seguro y sesión (#144)
- [ ] Con el APK anterior, iniciar sesión. Instalar el APK nuevo **encima**: la sesión sigue abierta, sin volver a pedir contraseña.
- [ ] Cerrar sesión e iniciar de nuevo: funciona. Reiniciar la app: sigue la sesión.
- [ ] Instalación limpia: iniciar sesión, matar la app, abrir: sigue la sesión.

### 3.2 Evidencia, dispositivo y ubicación (#146, #152, #153)
Consulta de verificación en la base del servicio dinámico:
`SELECT tabla, registro_id, accion, dispositivo_id, latitud, longitud, ubicacion_origen, capturado_en, cedula FROM c_evidencia_registro ORDER BY id DESC LIMIT 20;`
- [ ] Crear un registro de cualquier módulo con conexión y GPS: aparece una fila con `dispositivo_id` (UUID del equipo), coordenadas y `ubicacion_origen` = `firma` o `cabecera`.
- [ ] **Sin conexión (modo avión):** crear un registro, esperar 5 minutos, reconectar. La fila debe traer la hora y la ubicación del momento de crear, no las de la sincronización. Repetir con un módulo cuya cola use `requestData` (p. ej. almuerzo manual) y otro con `payload` (p. ej. inducción y recorrido).
- [ ] Permiso de ubicación negado: el registro se guarda y la fila queda con `ubicacion_origen = denegada`.
- [ ] App en segundo plano más de 10 minutos y luego una acción inmediata: la fila trae coordenadas (lectura nueva de GPS).
- [ ] Editar un registro creado sin conexión: la edición lleva la hora de la edición, no la de la creación.
- [ ] El historial de cambios y las cachés del módulo no muestran basura (`__evidencia`).

### 3.3 Reportes y campos nuevos
- [ ] **Acta de entrega (#138):** crear actas con conexión y sin conexión; los consecutivos son correlativos por empresa y no se repiten. El documento del acta muestra «N.º 000X».
- [ ] **Vehículos (#139, #143):** registrar y editar con VIN, título, RTV y marchamo (todos opcionales); también en la revisión. Se guardan y se vuelven a ver.
- [ ] **Inducción y recorrido (#142):** selector Presencial/Virtual opcional (tocar de nuevo lo quita); se ve en la lista y al editar; crear sin conexión y sincronizar conserva el valor; el Excel trae la columna.
- [ ] **Artículos del puesto (#140):** el reporte muestra estado y acción del último mantenimiento.

### 3.4 Documentos (#154–#157, #163)
- [ ] Crear un documento para un puesto. Un empleado de ese puesto que marca ingreso lo ve pendiente, con fecha de entrega.
- [ ] Un empleado **nuevo** en el puesto lo recibe al marcar su primer ingreso sin que nadie lo reenvíe.
- [ ] Publicar una versión 2 (`nueva_version`): la versión 1 y sus firmas se conservan; el empleado debe firmar de nuevo; el reporte muestra el estatus por versión.
- [ ] Quiz: la nota queda guardada y no cambia si se edita el quiz después.
- [ ] Sacar a un empleado del puesto: su historial (visto, firma, nota, versión) sigue en el reporte.
- [ ] Marcar ingreso sigue siendo rápido (anota el tiempo con varios documentos asignados).

### 3.5 Almuerzo y turnos (#158, #159, #160)
- [ ] **Almuerzo manual:** registrar inicio 12:00 y fin 12:45 → se guardan esas horas, el reporte muestra 45 minutos (no 7 horas). Probar también sin conexión.
- [ ] **Script de corrección:** `npx tsx scripts/corregirAlmuerzosManuales.ts --antes-de=<hora CR>` en modo simulacro: revisar la lista; solo entonces `--apply`. Repetirlo no debe restar dos veces.
- [ ] **Turno sin cerrar (#159):** con el nomenclador `horas_eliminar_marca_tras_salida` en 1 hora, no cerrar la salida y esperar a que pase la hora tras el fin del turno: la marca desaparece del almacenamiento y no se ofrece almuerzo ni otras acciones de ese turno. Volver el nomenclador a 4.
- [ ] **Cambio de guardia (#160):** con dos marcas traslapadas del mismo empleado (la propia y la de reemplazo), la app elige la de reemplazo; la entrada no cierra como «salida anticipada» una marca traslapada.
- [ ] Marcar ingreso y salida normales siguen funcionando (regresión).

### 3.6 Servidor en modo observación y versión mínima (#149, #150, #148 parcial)
- [ ] Con `GUARDIFY_DEVICE_ENFORCE=observe`: usar la app normalmente. La consola del servidor muestra líneas `guardify_device` por peticiones sin equipo de Guardify, y ninguna respuesta cambia.
- [ ] Con `GUARDIFY_DEVICE_ENFORCE=on` **y** `GUARDIFY_MIN_APP_VERSION=9.9.9` (no necesita Guardify): cualquier petición responde `403 device_not_approved|UPDATE_REQUIRED|…` y la app muestra «Actualiza la app» sin cerrar la sesión. Volver a `observe` y quitar la mínima para seguir probando.
- [ ] **Ojo con `on` sin Guardify en la app:** una petición cuyo token no trae equipo de Guardify se rechaza con `UNREGISTERED` (aunque no haya lista cargada). Con la app sin la integración, `on` bloquearía todo. Por eso, sin la integración de la app, probar solo `off` y `observe`; `on` se prueba con el simulacro (sección 4), registrando el equipo y volviendo a iniciar sesión.

## 4. Equipos y órdenes con el Guardify simulado

Con `apps/server/scripts/mockGuardify.ts` se prueba nuestro lado de #145 a #150 sin credenciales reales: registro y aprobación, bloqueo en caliente, sesión y renovación, órdenes (`LOGOUT_ALL`, `LOGOUT_USER`, `PING`, `FORCE_UPDATE`, `WIPE`), borrado con trabajo pendiente, aviso de ubicación y catálogo de APK. Cómo levantarlo, cómo apuntar el servidor y la app, y los 11 escenarios paso a paso están en [mock-guardify.md](mock-guardify.md).

- [ ] Escenarios 1 a 11 de `mock-guardify.md` (marcar cada uno ahí al probarlo).

## 5. Pendiente de Guardify real (no probar aún)

- Registro del equipo, pantallas pendiente/rechazado/bloqueado y aprobación desde la consola (#145).
- Bloqueo en caliente de un equipo y lista de revocaciones real (#146, #149, #150 con Guardify).
- Latidos, órdenes (`LOGOUT_ALL`, `LOGOUT_USER`, `FORCE_UPDATE`, `PING`, `WIPE`) y aviso de ubicación con mapa (#147).
- Catálogo de APK y versión mínima del catálogo (#148).
- Reportes, formularios y documentos **desde la consola de Guardify** y la pantalla de verificación de firma.

Para probar la parte de equipos **sin** Guardify real se usa el simulacro de la sección 4.
