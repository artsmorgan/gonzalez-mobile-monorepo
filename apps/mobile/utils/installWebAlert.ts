import { Alert, Platform, type AlertButton } from 'react-native';
import { alertText, dismissAction, normalizeAlertButtons, type WebAlertButton } from './webAlertCore';

const ROOT_ID = 'web-alert-root';
let installed = false;

/** Dibuja la alerta como una capa del documento (no usa `window.alert`/`confirm`, que bloquean y no se pueden automatizar). */
function showWebAlert(title: string, message?: string, buttons?: WebAlertButton[]) {
  const actions = normalizeAlertButtons(buttons);
  const previous = document.getElementById(ROOT_ID);
  if (previous) previous.remove();

  const overlay = document.createElement('div');
  overlay.id = ROOT_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)', zIndex: '2147483647',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui, sans-serif',
  } as Partial<CSSStyleDeclaration>);

  const box = document.createElement('div');
  Object.assign(box.style, {
    background: '#fff', color: '#111', borderRadius: '14px', maxWidth: '420px', width: '100%', maxHeight: '80vh', overflow: 'auto',
    padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  } as Partial<CSSStyleDeclaration>);

  const heading = document.createElement('div');
  heading.textContent = title;
  Object.assign(heading.style, { fontWeight: '700', fontSize: '17px', marginBottom: message ? '8px' : '16px' } as Partial<CSSStyleDeclaration>);
  box.appendChild(heading);

  if (message) {
    const body = document.createElement('div');
    body.textContent = message;
    Object.assign(body.style, { fontSize: '14px', lineHeight: '1.4', whiteSpace: 'pre-wrap', marginBottom: '16px' } as Partial<CSSStyleDeclaration>);
    box.appendChild(body);
  }

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      dismissAction(actions)?.run();
    }
  };
  document.addEventListener('keydown', onKey);

  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexDirection: actions.length > 2 ? 'column' : 'row', gap: '8px', justifyContent: 'flex-end' } as Partial<CSSStyleDeclaration>);
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.setAttribute('data-alert-button', action.label);
    Object.assign(btn.style, {
      padding: '10px 16px', borderRadius: '10px', border: '1px solid #d0d5dd', fontSize: '14px', cursor: 'pointer', flex: actions.length > 2 ? '0 0 auto' : '1',
      background: action.style === 'destructive' ? '#ff3b30' : action.style === 'cancel' ? '#f2f4f7' : '#007aff',
      color: action.style === 'cancel' ? '#111' : '#fff', fontWeight: action.style === 'cancel' ? '500' : '600',
    } as Partial<CSSStyleDeclaration>);
    btn.addEventListener('click', () => {
      close();
      action.run();
    });
    row.appendChild(btn);
  }
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  (row.querySelector('button') as HTMLButtonElement | null)?.focus();
}

/**
 * Hace que `Alert.alert` funcione en la versión web (React Native Web no lo implementa y los mensajes y confirmaciones, como «Cerrar sesión»,
 * no aparecían). En el teléfono no hace nada. Se llama una sola vez al arrancar.
 */
export function installWebAlert(): void {
  if (installed || Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  Alert.alert =(title: string, message?: string, buttons?: AlertButton[]) => {
    showWebAlert(alertText(title, null) || 'Aviso', message ? alertText(null, message) : undefined, buttons as WebAlertButton[] | undefined);
  };
}
