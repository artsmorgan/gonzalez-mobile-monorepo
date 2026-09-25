import { useState, useCallback, useRef } from 'react';
import React from 'react';
import QRScannerModal from '../components/QRScannerModal';

interface UseQRScannerReturn {
  scanQR: () => Promise<string | null>;
  QRScannerComponent: React.ReactNode;
}

/**
 * Hook personalizado para escanear códigos QR
 * 
 * @returns Un objeto con:
 *   - scanQR: Función que abre el modal de escaneo y retorna una Promise con el valor del QR
 *   - QRScannerComponent: Componente JSX del modal que debe ser renderizado en el componente padre
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { scanQR, QRScannerComponent } = useQRScanner();
 * 
 *   const handleScanPress = async () => {
 *     try {
 *       const qrData = await scanQR();
 *       if (qrData) {
 *         console.log('QR escaneado:', qrData);
 *       }
 *     } catch (error) {
 *       console.error('Error al escanear:', error);
 *     }
 *   };
 * 
 *   return (
 *     <View>
 *       <Button title="Escanear QR" onPress={handleScanPress} />
 *       {QRScannerComponent}
 *     </View>
 *   );
 * }
 * ```
 */
export function useQRScanner(): UseQRScannerReturn {
  const [isVisible, setIsVisible] = useState(false);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  /**
   * Función que abre el modal de escaneo y retorna una Promise con el valor del QR
   * @returns Promise que resuelve con el string del QR escaneado, o null si se cancela
   */
  const scanQR = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setIsVisible(true);
    });
  }, []);

  const handleScan = useCallback((data: string) => {
    
    // Close modal and resolve with the scanned data
    setIsVisible(false);
    if (resolveRef.current) {
      resolveRef.current(data);
      resolveRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    // Close modal and resolve with null (cancelled)
    setIsVisible(false);
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
  }, []);

  const QRScannerComponent = (
    <QRScannerModal
      visible={isVisible}
      onClose={handleClose}
      onScan={handleScan}
    />
  );

  return {
    scanQR,
    QRScannerComponent,
  };
}

