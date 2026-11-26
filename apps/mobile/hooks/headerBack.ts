/**
 * Flecha de regreso del header. Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Si la persona entra y la app la lleva directo a otra pantalla (p. ej. Marcar ingreso/salida), la pila no tiene a Home debajo y `goBack()` no
 * hace nada. En ese caso se reinicia la pila dejando solo Home.
 */
export const HOME_RESET_ACTION = { index: 0, routes: [{ name: 'Home' }] };

/** `true` cuando no hay una pantalla a la que regresar y hay que ir a Home. */
export function shouldResetToHome(canGoBack: boolean): boolean {
  return !canGoBack;
}
