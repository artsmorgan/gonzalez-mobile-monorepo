# APK de pruebas con Guardify encendido (solo compilar)

Esta guía es para quien compila el APK. **No hay que cambiar código ni variables**: todo está en la rama `servidor` y en el perfil de EAS `guardify-pruebas`.

## Compilar

Desde la rama `servidor` actualizada (`git pull`). **Esta versión agrega una dependencia nativa (`expo-task-manager`)**: ejecutar `npm ci` en la raíz antes de compilar si se compila en local (EAS lo hace solo).

```bash
cd apps/mobile
eas build --platform android --profile guardify-pruebas
```

Es la variante `lite` («MntrApp (Test)»): se instala junto a la app de producción sin pisarla. **No lo subas a `/app-versions` ni lo publiques en producción.**

El perfil (`apps/mobile/eas.json`) ya trae, para esta build y ninguna otra:

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_GUARDIFY_ENABLED` | `true` |
| `EXPO_PUBLIC_GUARDIFY_URL` | `https://guardifyconsole-production.up.railway.app` (Guardify de pruebas) |
| `EXPO_PUBLIC_GUARDIFY_APP_KEY` / `…_COMPANY_CODE` | `monitoreapp` / `corporacion-gonzalez` (el equipo se registra solo, sin escribir código) |
| `EXPO_PUBLIC_GUARDIFY_HEARTBEAT_SECONDS` | `60` (latido cada minuto; por defecto son 5 min) |
| `EXPO_PUBLIC_API_SERVER` | servidor de pruebas de MonitoreApp |

Los perfiles `preview*` y `production*` no cambian: siguen con Guardify **apagado**. Si el perfil `guardify-pruebas` no se usa, la app no habla con Guardify.

## Cómo funciona el acceso en pruebas (primero el equipo, luego la persona)

1. **Instalar o actualizar la app** → lo primero que aparece es la pantalla de Guardify, antes del inicio de sesión. El equipo se registra solo con el código de la empresa y queda **«Pendiente de aprobación»**. Ni siquiera se puede ver la pantalla de login.
2. **González revisa la solicitud en Guardify** (Apps → MonitoreApp → Dispositivos): **aprueba** (la app pasa sola al login en unos 15 s) o **rechaza** (la app muestra «Rechazado» con el motivo). También puede bloquear o retirar un equipo ya aprobado.
3. **Ya con el equipo aprobado, cualquier empleado entra.** La app lo autentica como siempre (cédula y contraseña de MonitoreApp) y Guardify lo da de alta solo con el rol **Operativo**. No hay que registrar a nadie antes. En Guardify → Usuarios de apps González ve quién entró y le cambia el rol o lo bloquea.
4. **El servidor de pruebas exige el equipo aprobado** (`GUARDIFY_DEVICE_ENFORCE=on`): un APK viejo, la versión web o cualquier equipo sin aprobar recibe `403 device_not_approved`. Es lo esperado.

Esto es **solo para el entorno de pruebas**: en Guardify la instalación de González tiene «admisión abierta» con rol por defecto. En producción no se usa.

## Qué incluye la build (ya estaba en el código)

- **Registro del equipo** al abrir la app: queda «Pendiente» hasta que alguien lo apruebe en la consola de Guardify (Apps → MonitoreApp → Dispositivos).
- **Habilitar / deshabilitar / retirar / bloquear** desde la consola: la app muestra la pantalla de estado correspondiente y deja de funcionar; retirar un equipo borra sus datos locales (primero sincroniza lo pendiente).
- **Cortar acceso**: cierre de sesión remoto y revocación de sesiones; el servidor consulta a Guardify la lista de revocaciones.
- **Sesión del empleado en Guardify** («login del dispositivo»): al entrar a la app se abre su sesión con la cédula; en pruebas Guardify admite a cualquier empleado con el rol Operativo. Si González lo bloquea, la app muestra «Acceso no autorizado» y cierra la sesión.
- **Actualización obligatoria** desde el catálogo de APK de Guardify (versión mínima).
- **Ubicación en vivo en el mapa de Guardify** (como un viaje): aviso de consentimiento una sola vez; con «Aceptar», la app manda su posición cada pocos segundos (hoy 5 s; lo define González en Guardify, no la build) y el mapa de la consola se mueve solo, con recorrido y velocidad. Solo mientras la **sesión del empleado está abierta**. En Android la app arranca un **servicio en primer plano de ubicación** (notificación fija «Compartiendo la ubicación…») cuando se abre con el rastreo activo: sigue con la pantalla bloqueada o la app en segundo plano. **No pide «Permitir todo el tiempo»**: basta el permiso normal de ubicación («Mientras se usa la app»). Si Android no deja arrancar el servicio, el rastreo corre solo con la app abierta. Los permisos del servicio están declarados solo en la variante `lite` (`android/app/src/lite/AndroidManifest.xml`).
  - **Límites conocidos:** (1) en segundo plano Android entrega las lecturas por lotes, puede haber retraso de hasta ~1 min; con la app abierta es en tiempo real. (2) Android no permite arrancar el servicio desde segundo plano: si el teléfono se reinicia o la app se actualiza, el rastreo se apaga y vuelve la próxima vez que se abra la app. (3) Bloquear o retirar el **equipo** corta el rastreo en el siguiente envío; «cortar acceso» a una **persona** con la app en segundo plano surte efecto al volver a abrirla. (4) En algunos teléfonos (Xiaomi, Huawei, Samsung con ahorro de batería) hay que quitar la optimización de batería a la app o Android la detiene.

## Probar (lo mínimo)

1. Instalar el APK en un teléfono: aparece la pantalla «Pendiente de aprobación» (no hay login todavía).
2. En Guardify el equipo aparece como «Pendiente»; pedirle a González/Aletz que lo apruebe → la app pasa sola al login. Iniciar sesión con **cualquier empleado**: entra con el rol Operativo.
3. Aceptar el aviso de ubicación (y el permiso «Mientras se usa la app») → en la consola (Dispositivos → Mapa en vivo) el equipo aparece como «En vivo» y se mueve cada ~5 s. Bloquear la pantalla y caminar: aparece la notificación fija y el punto sigue moviéndose (con posible retraso de hasta ~1 min por lote).
4. Desde Guardify bloquear el equipo → la app muestra «bloqueado» en cuanto consulta su estado (órdenes cada 10 s, latido cada 60 s); habilitarlo → vuelve a funcionar (estando bloqueada, la app vuelve a preguntar cada 60 s).
5. Cerrar sesión de la persona desde Guardify → la app cierra sesión.

## Qué NO tocar

- No cambiar `app.config.js`, `eas.json` ni el código de `hooks/guardify*` para esta build.
- No cambiar `GUARDIFY_DEVICE_ENFORCE` en el servidor de pruebas: ya está en `on` y es lo que obliga a que el equipo esté aprobado. No ponerlo en producción.
- No usar este perfil para producción: en producción Guardify sigue apagado.

## Servidor de pruebas (ya configurado)

`GUARDIFY_URL`, `GUARDIFY_APP_CLIENT_ID/SECRET` y `GUARDIFY_REPORTS_API_KEY` están puestas; `GUARDIFY_DEVICE_ENFORCE=on` (desde el 2026-11-04). Se comprobó que la lista de revocaciones de Guardify responde con esas credenciales.

## Interruptores del servidor (producción)

Con las variables sin definir, el servidor se comporta como antes de Guardify:

| Variable | Sin definir | Efecto |
|---|---|---|
| `GUARDIFY_REPORTS_API_KEY` | rutas `/api/guardify/*` responden 503 | Con llave: reportes, documentos y acciones para Guardify |
| `GUARDIFY_DEVICE_ENFORCE` | `off` | `observe` solo registra; `on` exige equipo aprobado |
| `GUARDIFY_EVIDENCE` | **encendida** (como hoy) | `off` deja de registrar evidencia en `c_evidencia_registro` |
| `GUARDIFY_DOCS_DELIVERY` | **encendida** (como hoy) | `off` deja de crear vínculos de entrega de documentos al marcar ingreso |

En la app, Guardify solo se enciende con el perfil de EAS `guardify-pruebas` (`EXPO_PUBLIC_GUARDIFY_ENABLED=true`); en cualquier otro perfil no se ejecuta.
