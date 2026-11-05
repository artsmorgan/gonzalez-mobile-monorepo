# Decisiones del cliente (20 de octubre de 2026) y qué cambian en el plan

Respuestas a las preguntas P1–P14 (dispositivos), N1–N10 (plan posreunión) y R1–R7 (reportes). Entre paréntesis, la pregunta.

## Dispositivos
| Decisión | Efecto en el plan |
|---|---|
| **P1** Cero código de empresa: el guarda no escribe nada. | La app de producción lleva el código incluido; se omite la pantalla de código (tarea A4 solo en variantes de prueba). |
| **P2** Aprueba quien tenga el permiso de aprobador en su rol (supervisor o admin); no importa la hora ni el día. | Sin turnos de aprobadores ni SLA. El aviso de pendientes llega a quienes tengan `dispositivos:aprobar` en su alcance. |
| **P3** Equipos de la empresa y personales: ambos. | Los dos se aprueban igual; `propiedad` empresa/personal queda como dato. |
| **P4** El número de equipos es irrelevante. | Sin dimensionamiento previo. |
| **P5** APK bajado **desde Guardify**: Guardify lista todos los APK publicados; la app se actualiza por «hook» con versión mínima (como hoy), pero se puede instalar un APK viejo. | **Tarea nueva en Guardify: catálogo de APK** (subir, listar, versión mínima por app, descarga). La versión mínima la exige el servidor; el APK viejo solo se evita con ese mínimo. |
| **P6** Los avisos van al correo que establezca el cliente. | Configurable por empresa; falta SMTP del worker. |
| **P7** Sin fecha de corte por ahora. | Fase «exigir» queda sin fecha. |
| **P8** Sin procedimiento de emergencia: el guarda espera la aprobación. | Nada que construir. |
| **P9** Mensaje y contacto de soporte: esperando confirmación. | Texto provisional. |
| **P10** Se aprueban **uno por uno**. | Se descarta el código de registro por sucursal para la migración; la aprobación en lote queda como mejora. |
| **P11** Sí: bloqueo y borrado remoto de datos de la app. | Comandos `LOGOUT_ALL` y `WIPE` del SDK, con registro de quién los ordena. |
| **P12** Solo Android por ahora. | — |
| **P13** Sin tope por ahora, pero puede variar por tipo de suscripción. | El cupo por instalación ya existe; luego se liga al plan. |
| **P14** Sí a la verificación de integridad (más adelante). | Fase de endurecimiento (Play Integrity). |

## Plan posreunión
| Decisión | Efecto en el plan |
|---|---|
| **N1** «Documentos entregados a personal». | El reporte de manuales pasa a llamarse **«Documentos entregados a personal»** (hecho); el de documentos a clientes queda como «Documentos entregados a clientes». |
| **N2** Las coordenadas se guardan por acción en el reporte, y debe existir en Apps → Guardify un **mapa de todos los teléfonos en vivo**. | Mapa de dispositivos en vivo (frente 6) y coordenadas como columna del reporte. |
| **N3** La huella de Guardify, tal como queda en el hash, es suficiente por ahora. | Firma = hash; sin certificado digital. |
| **N4** Cada versión de un documento se firma. | Requiere el **módulo de documentos y envío desde Guardify** (frente 4). |
| **N5** Cualquier tipo de archivo, sin restricción; el envío masivo lo hace quien tenga el permiso de publicar documentos en su rol. | Nuevo permiso `documentos:publicar`; sin límite de tipo (definir tope técnico de tamaño). |
| **N6** Sí: quitar los reportes de ejemplo. | **Hecho** en staging. |
| **N7** Configuración de hora en Ajustes con un selector (select2); por defecto GMT-6 (Costa Rica). | **Tarea nueva:** zona horaria configurable por empresa; hoy está fija en Costa Rica. |
| **N8** Formato de fecha «9 oct 2026». | **Hecho** (día sin cero a la izquierda). |
| **N9** Sello y protección en el PDF. | Frente 5: huella del documento y protección contra edición. |
| **N10** Enlaces para los adjuntos del Excel. | Enlaces con caducidad y registro de descargas. |

## Reportes
| Decisión | Efecto en el plan |
|---|---|
| **R1** Latitud y longitud: dato guardado por cada acción y visible en tiempo real en el mapa. | Se levanta la restricción de seguridad del módulo de Cambios de ubicación; ver issue #137. |
| **R2** El consecutivo del acta empieza en 0001. | Issue #138: columna `consecutivo` propia, desde 0001. |
| **R3** VIN: sí, en ambos (registro y revisión), campos opcionales. | Issue #139. |
| **R4** Estado y acción de artículos = último mantenimiento. | Issue #140. |
| **R5** No quitar «Tipo de capacitación» ni «Empleado» de Inducción y recorrido: dejarlos en el reporte. | **Tarea nueva** para MonitoreApp: agregar esas columnas. |
| **R6** Título de propiedad, RTV y marchamo: sí, como campos opcionales (texto). | **Tarea nueva** para MonitoreApp (hoy son Sí/No). |
| **R7** Puestos, llaveros y «entregadas por»: lista desplegable con búsqueda (select2). | **Tarea nueva** en Guardify: filtro de lista con búsqueda para valores múltiples. |

## Otras decisiones de hoy
- El PR #141 de Manuales se fusionó y está desplegado en el servidor de pruebas.
- Se automatizan las migraciones en cada despliegue de la consola (comando previo `bun run db:deploy` con el rol dueño del esquema en `DATABASE_URL`; la app sigue usando solo `GUARDIFY_DB_URL`).
