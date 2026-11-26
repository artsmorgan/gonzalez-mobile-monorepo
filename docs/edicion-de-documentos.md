# Edición de documentos (pantalla «Documentos»)

Permite corregir un documento ya subido desde `JobManualsScreen`: datos comunes, archivos y quiz. **Todo este flujo requiere conexión a internet**: no hay acciones en cola ni sincronización.

**Dónde está:** en cada documento de la lista, el botón largo **«Editar»** va debajo de «Act. puestos» y «Act. empleados» (mismo permiso). Abre una **ventana flotante** con el diseño de los demás formularios de «Documentos» (fondo oscuro translúcido, tarjeta blanca de bordes redondeados, campos y botones Cancelar en rojo / Aceptar en verde); el quiz se edita dentro de la misma ventana.

## Quién puede editar
Cualquier rol **distinto de OPERATIVO** (la misma regla de los botones «Act. puestos» y «Act. empleados»). Además, el documento debe existir ya en el servidor (un documento creado sin conexión y aún sin sincronizar no se puede editar).

**El servidor lo comprueba** (no solo la interfaz): el rol sale de la marca con la que trabaja la persona (su plaza y su contrato, igual que en el inicio de sesión), la marca tiene que ser suya (titular o reemplazo) o de un administrador, y todo lo dudoso se niega (`403 permission_denied`). Código: `apps/server/utils/documentos/permisosEdicion.ts`.

> Las rutas de vincular puestos y empleados (`POST /api/job-manuals/{id}/puestos` y `/empleados`) hoy solo verifican el token, no el rol; el cierre de ese hueco queda pendiente (usarían la misma función).

## Qué se puede cambiar
| Campo | Efecto |
|---|---|
| Título, descripción, clasificación | Se corrigen en el propio registro. **No** obliga a firmar de nuevo |
| Archivos nuevos | Se suben al pulsar «Aceptar» y pertenecen a la versión vigente (o a la nueva, si se publica una). **No** obliga a firmar de nuevo |
| Quiz | Editor de preguntas (tipo, opciones, respuesta correcta, puntaje, aprobación mínima). **Exige nueva versión** (ver abajo) |
| Firma del responsable | No se pide al editar |
| Puestos y empleados vinculados | No se editan aquí: tienen sus propias funciones |

## Ver los archivos en el formulario
Los archivos del documento se ven y se usan dentro del propio formulario de edición, igual que en el visor de documentos:
- **Imágenes:** se ven en el formulario y se amplían al tocarlas.
- **Audios y videos:** se reproducen (reproductor de audio y de video del visor).
- **Documentos y demás archivos:** botón **Descargar** (guarda el archivo en el dispositivo; requiere conexión).
- Los **archivos nuevos** que se acaban de elegir, antes de subirlos, también se pueden ver y reproducir.

Las URLs son las mismas del visor (con el token). Los reproductores y el visor de imágenes salieron de `JobManualsScreen.tsx` a `components/ManualFilePreview.tsx` para compartirlos; el visor de documentos los sigue usando igual.

## Borrar archivos
Cada archivo del documento tiene un ícono de borrado. Al pulsarlo se pide confirmación y el archivo se **borra en ese mismo instante** (`DELETE /api/job-manuals/{id}/files/{fileId}?marca_id=…`): se quita su fila y su archivo del almacén, sin esperar a «Aceptar». No cambia la versión ni obliga a firmar de nuevo. El archivo tiene que ser de ese documento (un id suelto no alcanza archivos de otros).

## ¿Nueva versión?
El formulario pregunta **«¿Los cambios suponen una nueva versión del documento?»**, por defecto **No**.

- **Sí:** la versión sube (`publicarNuevaVersion`): la versión vigente pasa al histórico `e_manual_puesto_version` (con su quiz), las firmas y notas de la versión anterior se conservan con su versión, y **todos los usuarios vinculados deben volver a visualizar el documento y firmarlo**. Reciben una **notificación**: los usuarios de los puestos vinculados (el principal y los vinculados) y los empleados que tienen el documento. Quien edita ve una **advertencia al elegir «Sí»** (puede cancelar y queda en «No») y otra al confirmar.
- **Modificar el quiz fuerza «Sí»** (camino A): las respuestas de cada persona están ligadas a la versión del documento, y el quiz de cada versión se conserva en `e_manual_puesto_version`. Cambiar el quiz de una versión ya respondida dejaría las respuestas apuntando a otro quiz. El formulario marca «Sí», lo bloquea y lo explica; el servidor lo exige también (`400 quiz_requires_new_version`, antes de subir archivos). **No se necesita ninguna migración**: es la misma mecánica de versiones que ya existía. La notificación del cambio de quiz es la de la nueva versión (menciona que incluye cambios en el quiz).
- Un quiz igual al actual (aunque esté escrito en otro orden) no cuenta como cambio.
- Publicar una nueva versión sin otros cambios también es válido (todos vuelven a firmar).

## Bitácora
Cada edición queda en `c_cambios_apps_modules` (`e_manual_puesto`, con quién y cuándo): título, descripción, clasificación, quiz (resumen de preguntas), archivos agregados, archivo eliminado y **el cambio de versión (N → N+1)**. El quiz anterior completo se consulta en `e_manual_puesto_version`.

## Versión visible
La lista de documentos muestra **siempre** «Versión N» (también la v1), en la fila de datos de cada documento.

## Rutas
| Ruta | Qué hace |
|---|---|
| `PUT /api/job-manuals/{id}/edit` | Edita datos, quiz y archivos nuevos; `nueva_version: true` publica versión. Cuerpo: `marca_id` (obligatorio), `title`, `description`, `classification` (`null` = sin clasificar), `quiz` (texto JSON; `null` = quitar), `newFiles` (JSON de `{type, extension, original_name, file_base64}`), `nueva_version`. Solo viaja lo que cambió |
| `DELETE /api/job-manuals/{id}/files/{fileId}?marca_id=…` | Borra el archivo al instante |

Respuestas de error tipadas: `invalid_request` (400), `permission_denied` (403), `not_found` (404), `quiz_requires_new_version` (400) y `storage_unavailable` (502, el almacenamiento de archivos rechazó la subida: no se guardó ningún cambio). El `PUT /api/job-manuals/{id}` anterior queda como estaba.

## Si fallan la subida o el borrado de archivos
Los archivos viven en el almacenamiento compatible con S3 de la **API dinámica** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL`, `AWS_BUCKET_NAME` en su `.env`). Si ese almacenamiento rechaza las credenciales (`SignatureDoesNotMatch`, `UnknownError`, HTTP 403):
- **Editar con archivos nuevos** responde `502 storage_unavailable` y **no escribe nada** del documento; el detalle real queda en `error_logs`.
- **Borrar un archivo** quita su fila (el documento ya no lo muestra) pero el archivo queda en el almacenamiento; la respuesta trae `almacen_limpio: false` y se registra el error para limpiarlo luego.
- Editar solo datos o quiz, sin archivos, funciona igual.

Se comprueba con una llamada de solo lectura (`HeadBucket` / `ListObjectsV2`) usando la misma configuración. Cualquier subida del sistema (p. ej. crear un documento con un archivo) falla igual mientras las credenciales no sean válidas: hay que regenerarlas en el proveedor, actualizarlas en el `.env` de la API dinámica y reiniciarla.

## Código
- Servidor: `utils/documentos/edicion.ts` (validación, reglas y aplicación), `permisosEdicion.ts`, `rolDeMarca.ts`; rutas en `app/api/job-manuals/[id]/edit` y `…/files/[fileId]`.
- App: `hooks/jobManualEdit.ts` y `hooks/jobManualQuiz.ts` (lógica pura), `components/JobManualEditModal.tsx` y `JobManualQuizEditor.tsx`, y los cambios de `JobManualsScreen.tsx` (botón «Editar», versión en la lista).
- Pruebas: `utils/documentos/edicion.test.ts`, `edicionRutas.test.ts` y `edicionApp.test.ts` (esta última compara la decisión «¿cambió el quiz?» del teléfono con la del servidor).

## Prueba manual (ambiente de pruebas; datos creados desde MonitoreApp)
Con un usuario **SUPERVISOR o ADMINISTRATIVO** y con un **OPERATIVO**:

| # | Paso | Esperado |
|---|---|---|
| 1 | Abrir «Documentos» | Cada documento muestra «Versión N» (también los de v1) |
| 2 | Como OPERATIVO, mirar un documento | **No** hay botón «Editar». Como SUPERVISOR, «Editar» es el botón largo debajo de «Act. puestos» y «Act. empleados» |
| 3 | Como SUPERVISOR, tocar «Editar» **sin conexión** | Avisa que requiere conexión y no abre el formulario |
| 4 | Con conexión, abrir «Editar» | Ventana flotante con título, descripción, clasificación, archivos, quiz y «¿Nueva versión?» en **No** |
| 5 | Cambiar solo el título y aceptar | Se guarda; la versión no cambia; nadie recibe notificación; en «Cambios» aparece el cambio |
| 6 | Agregar un archivo y aceptar | El archivo aparece en el documento; la versión no cambia; no hay que volver a firmar |
| 6b | Abrir «Editar» en un documento con imagen, audio, video y un PDF | La imagen se ve (y se amplía al tocarla), el audio y el video se reproducen y el PDF se descarga con «Descargar»; un archivo recién elegido también se ve o se reproduce antes de aceptar |
| 7 | Tocar el ícono de borrado de un archivo | Pide confirmación; al confirmar desaparece **al instante** (sin «Aceptar») |
| 8 | Elegir «Sí» en nueva versión | Aparece la advertencia (volver a ver y firmar, notificación); «Cancelar» deja «No» |
| 9 | Con «Sí», aceptar | La versión sube; los usuarios vinculados reciben la notificación y deben volver a firmar; las firmas anteriores siguen en su versión |
| 10 | Modificar el quiz sin tocar «¿Nueva versión?» | «Sí» queda marcado y bloqueado con la explicación; al aceptar se publica la versión nueva |
| 11 | Consultar el quiz original | Está en `e_manual_puesto_version` (versión anterior) |
| 12 | Con una llamada directa de un OPERATIVO a `PUT …/edit` o `DELETE …/files/…` | `403 permission_denied` |
