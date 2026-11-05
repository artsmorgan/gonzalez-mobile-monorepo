/**
 * Lógica pura de `Alert.alert` para la versión web (React Native Web no implementa `Alert.alert`: no muestra nada y nunca llama a los botones).
 * Sin React Native ni DOM, para poder probarla en Node.
 */
export type WebAlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type WebAlertAction = {
  label: string;
  style: 'default' | 'cancel' | 'destructive';
  run: () => void;
};

/** Sin botones, `Alert.alert` muestra un «OK». */
export function normalizeAlertButtons(buttons?: WebAlertButton[] | null): WebAlertAction[] {
  const lista = Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  return lista.map((b) => ({
    label: String(b?.text ?? 'OK'),
    style: b?.style === 'cancel' || b?.style === 'destructive' ? b.style : 'default',
    run: () => {
      try {
        b?.onPress?.();
      } catch (e) {
        // Un fallo en el manejador de un botón no debe dejar la alerta abierta ni romper la pantalla.
        console.error('Error en el botón de la alerta:', e);
      }
    },
  }));
}

/** Texto visible: título y mensaje, sin líneas vacías sobrantes. */
export function alertText(title?: string | null, message?: string | null): string {
  return [title, message].filter((p) => typeof p === 'string' && p.trim() !== '').join('\n\n');
}

/** Al cerrar la alerta sin elegir (clic fuera o Escape) se ejecuta el botón «cancelar» si existe; si no, solo se cierra. */
export function dismissAction(actions: WebAlertAction[]): WebAlertAction | null {
  return actions.find((a) => a.style === 'cancel') ?? null;
}
