# Componente Escáner de Código QR

## Descripción

Este módulo proporciona un componente modal reutilizable para escanear códigos QR en la aplicación móvil. Está diseñado para ser fácil de usar y puede ser invocado desde cualquier parte de la aplicación.

## Componentes

### `QRScannerModal`

Componente modal que muestra la cámara y permite escanear códigos QR.

**Props:**

- `visible` (boolean): Controla si el modal está visible
- `onClose` (function): Callback cuando el modal se cierra
- `onScan` (function): Callback cuando se escanea un QR con éxito

### `useQRScanner` Hook

Hook personalizado que facilita el uso del escáner de QR mediante una función asíncrona que retorna una Promise.

**Retorna:**

- `scanQR`: Función asíncrona que abre el modal y retorna el valor del QR escaneado
- `QRScannerComponent`: Componente JSX del modal que debe ser renderizado

## Uso

### Ejemplo Básico

```tsx
import React from "react";
import { View, TouchableOpacity, Text, Alert } from "react-native";
import { useQRScanner } from "../hooks/useQRScanner";

export default function MyComponent() {
  const { scanQR, QRScannerComponent } = useQRScanner();

  const handleScanPress = async () => {
    try {
      const qrData = await scanQR();

      if (qrData) {
        Alert.alert("QR Escaneado", `Datos: ${qrData}`);
        // Aquí puedes procesar los datos del QR
      } else {
        Alert.alert("Cancelado", "Escaneo cancelado por el usuario");
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo escanear el código QR");
      console.error("Error scanning QR:", error);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleScanPress}>
        <Text>Escanear QR</Text>
      </TouchableOpacity>

      {/* IMPORTANTE: Debes renderizar el componente del escáner */}
      {QRScannerComponent}
    </View>
  );
}
```

### Ejemplo con Navegación

```tsx
import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useQRScanner } from "../hooks/useQRScanner";
import { useNavigation } from "@react-navigation/native";

export default function QRNavigationExample() {
  const { scanQR, QRScannerComponent } = useQRScanner();
  const navigation = useNavigation();

  const handleScanAndNavigate = async () => {
    const qrData = await scanQR();

    if (qrData) {
      // Navegar a otra pantalla con los datos del QR
      navigation.navigate("QRDetails", { qrData });
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleScanAndNavigate}>
        <Text>Escanear y Ver Detalles</Text>
      </TouchableOpacity>
      {QRScannerComponent}
    </View>
  );
}
```

### Ejemplo con Validación

```tsx
import React, { useState } from "react";
import { View, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useQRScanner } from "../hooks/useQRScanner";

export default function QRValidationExample() {
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [isValidating, setIsValidating] = useState(false);

  const validateQRCode = async (qrData: string) => {
    // Simulación de validación en servidor
    const response = await fetch("https://api.example.com/validate-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode: qrData }),
    });
    return response.json();
  };

  const handleScanWithValidation = async () => {
    const qrData = await scanQR();

    if (qrData) {
      setIsValidating(true);
      try {
        const result = await validateQRCode(qrData);

        if (result.valid) {
          Alert.alert("Éxito", "Código QR válido");
        } else {
          Alert.alert("Error", "Código QR inválido");
        }
      } catch (error) {
        Alert.alert("Error", "No se pudo validar el código QR");
      } finally {
        setIsValidating(false);
      }
    }
  };

  return (
    <View>
      {isValidating ? (
        <ActivityIndicator size="large" />
      ) : (
        <TouchableOpacity onPress={handleScanWithValidation}>
          <Text>Escanear y Validar QR</Text>
        </TouchableOpacity>
      )}
      {QRScannerComponent}
    </View>
  );
}
```

### Ejemplo con Múltiples Escaneos

```tsx
import React, { useState } from "react";
import { View, TouchableOpacity, Text, FlatList } from "react-native";
import { useQRScanner } from "../hooks/useQRScanner";

export default function MultiScanExample() {
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);

  const handleAddScan = async () => {
    const qrData = await scanQR();

    if (qrData) {
      setScannedCodes((prev) => [...prev, qrData]);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleAddScan}>
        <Text>Escanear Nuevo QR</Text>
      </TouchableOpacity>

      <FlatList
        data={scannedCodes}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => <Text>{item}</Text>}
      />

      {QRScannerComponent}
    </View>
  );
}
```

## Características

- ✅ **Fácil de usar**: Solo necesitas importar el hook y llamar a la función `scanQR()`
- ✅ **Basado en Promises**: Usa async/await para un código limpio
- ✅ **Reutilizable**: Puede ser usado en cualquier componente de la aplicación
- ✅ **Gestión de permisos**: Maneja automáticamente los permisos de cámara
- ✅ **UI intuitiva**: Interfaz visual con marco de escaneo y feedback visual
- ✅ **Cancelable**: El usuario puede cerrar el modal en cualquier momento

## Permisos Requeridos

La aplicación solicitará automáticamente permisos de cámara cuando el usuario intente escanear un QR por primera vez.

**Android (`app.json`):**

```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "La aplicación necesita acceso a la cámara para escanear códigos QR."
        }
      ]
    ]
  }
}
```

**iOS (`app.json`):**
Los permisos se manejan automáticamente con expo-camera.

## Notas Importantes

1. **Siempre renderiza el componente**: No olvides renderizar `{QRScannerComponent}` en tu componente, incluso si no es visible inicialmente.

2. **Manejo de cancelación**: La función `scanQR()` retorna `null` si el usuario cancela el escaneo.

3. **Un solo modal por pantalla**: Solo necesitas un `useQRScanner` por pantalla, incluso si tienes múltiples botones de escaneo.

4. **Compatibilidad**: Funciona en iOS y Android. No disponible para web.

## Solución de Problemas

### El modal no aparece

- Asegúrate de renderizar `{QRScannerComponent}` en tu componente
- Verifica que los permisos de cámara estén concedidos

### El escaneo no detecta el QR

- Asegúrate de que el QR esté bien iluminado
- Mantén el dispositivo estable
- El QR debe estar completamente dentro del marco de escaneo

### Error de permisos

- Ve a la configuración del dispositivo y habilita el permiso de cámara para la aplicación
- Reinicia la aplicación después de cambiar los permisos
