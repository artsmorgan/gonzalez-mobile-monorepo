# @guardify/sdk

SDK de dispositivo de Guardify. Corre igual en React Native (Expo), Node y navegador: recibe `fetch`, almacenamiento y reloj por inyección, sin dependencias de plataforma.

Una app (MonitoreApp) **registra el equipo antes del login**, espera la aprobación de un administrador en Guardify, y después consulta si el usuario puede entrar. Guardify puede bloquear o retirar el equipo, cerrar sesiones y mandar órdenes a distancia.

## Instalación en la app

Esta carpeta (`vendor/guardify-sdk`) es una copia de la versión indicada en `VERSION`; Guardify la actualiza con `scripts/export-sdk.sh`. El código del cliente (`src/index.ts`) no tiene dependencias; el verificador del servidor (`src/server.ts`) usa `jose` (`npm i jose`). Versiones en `CHANGELOG.md`.

## Uso (app móvil)

```ts
import { GuardifyDevice, type Storage } from "./guardify-sdk/src";
import * as SecureStore from "expo-secure-store";

// Almacenamiento seguro: la credencial del equipo NO va en AsyncStorage.
const storage: Storage = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

export const guardify = new GuardifyDevice({
  baseUrl: "https://<guardify>",   // la URL de Guardify
  appKey: "monitoreapp",
  deviceUid,                        // UUID propio de la instalación (expo-crypto), guardado en SecureStore
  storage,
  platform: "ANDROID", model: Device.modelName ?? undefined, osVersion: Device.osVersion ?? undefined, appVersion: "1.4.0",
});

const state = await guardify.init();      // al arrancar la app
// state.kind: unregistered | pending | rejected | blocked | retired | signed_out | locked | operational
if (state.kind === "unregistered") await guardify.register(COMPANY_CODE); // el código va incluido en la app de producción
guardify.on((e) => { /* e.type: "state" | "command" | "wipe" | "force_update" */ });
guardify.connectStream();                  // órdenes a distancia en vivo (o pollCommands())

// Después del login con Planillas:
await guardify.login(cedula);              // POST /api/v1/access/verify (solo viaja la cédula)
await guardify.heartbeat({ battery: 80 }); // cada pocos minutos (batería; ubicación solo con consentimiento)

// Actualización:
const { latest, minAppVersion } = await guardify.latestApk("prod");
```

### Pantallas por estado
| Estado | Qué muestra la app |
|---|---|
| `pending` | «Esperando aprobación» (sondea con `refreshStatus()`) |
| `rejected` | El motivo (`state.reason`) |
| `blocked` | «Equipo bloqueado» |
| `retired` | Borra los datos locales |
| `locked` | Sin conexión / permiso de uso vencido |
| `signed_out` / `operational` | El login de siempre |

El texto y el contacto de soporte los define la empresa en Guardify y llegan en `policy.support` (`pending`, `rejected`, `blocked`, `phone`, `email`).

## Uso (servidor de la app)

```ts
import { createVerifier } from "./guardify-sdk/src/server";
const guardify = createVerifier({ baseUrl, appKey: "monitoreapp", clientId, clientSecret });
setInterval(() => guardify.refreshRevocations().catch(() => undefined), 30_000);

// En la verificación central de cada petición:
const claims = await guardify.verify(token);   // lanza "session_revoked" o "device_not_approved"
```

`refreshRevocations()` trae las sesiones revocadas y los equipos que dejaron de estar activos (un equipo que vuelve a `ACTIVE` se quita solo). Si Guardify no responde, conserva la última lista y no abre por defecto.

## Contratos de Guardify que usa
`POST /api/v1/devices/register` · `GET /api/v1/devices/self` · `POST /api/v1/devices/self/heartbeat` · `GET /api/v1/devices/self/commands` · `POST /api/v1/access/verify` · `GET /api/v1/apks/latest` · `GET /api/v1/revocations` (servidor, con credencial de aplicación).
