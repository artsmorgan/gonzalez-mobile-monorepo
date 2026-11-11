# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Configuración del Servidor API

### Desarrollo Local (Por Defecto)

Por defecto, la aplicación usa la URL de ngrok para desarrollo local:
- **API_SERVER**: `https://598ab127822b.ngrok-free.app`

No se requiere configuración adicional. Simplemente ejecuta:
```bash
npm start
# o
expo start
```

### Desarrollo Local con Servidor Personalizado

Si estás ejecutando el servidor localmente (ej: `http://localhost:3000`):

**Opción 1: Crear archivo `.env.local`**
```bash
# En apps/mobile/.env.local
EXPO_PUBLIC_API_SERVER=http://localhost:3000
```

Luego reinicia Expo:
```bash
expo start --clear
```

**Opción 2: Variable de entorno en terminal**
```bash
export EXPO_PUBLIC_API_SERVER=http://localhost:3000
expo start
```

O en una sola línea:
```bash
EXPO_PUBLIC_API_SERVER=http://localhost:3000 expo start
```

### Producción en Railway

Para conectar con el backend en producción:

1. Ve a **Railway Dashboard** → Tu Proyecto Mobile (`APP-gonzalez-mobile-monorepo`)
2. Haz clic en la pestaña **Variables**
3. Haz clic en **+ New Variable**
4. Agrega:
   - **Nombre**: `EXPO_PUBLIC_API_SERVER`
   - **Valor**: `https://api-gonzalez-mobile-monorepo-production.up.railway.app`
   - **Alcance**: Selecciona el ambiente (Production/Preview)
5. Haz clic en **Add**

Railway automáticamente:
- Detectará la nueva variable
- Iniciará un nuevo build
- Inyectará la URL del API en la aplicación durante el build

### Orden de Prioridad

La aplicación usa el API_SERVER en el siguiente orden:

1. `EXPO_PUBLIC_API_SERVER` (variable de entorno - Railway o local)
2. `API_SERVER` (variable de entorno alternativa)
3. Por defecto: `https://598ab127822b.ngrok-free.app` (desarrollo local)

### Uso en el Código

El código de la aplicación ya está configurado para usar la variable:

```typescript
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
// Usará automáticamente la variable de Railway si está configurada
```

### Verificar la URL del API

Puedes verificar qué URL está siendo usada:

```typescript
import Constants from 'expo-constants';

console.log('API Server:', Constants.expoConfig?.extra?.API_SERVER);
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
