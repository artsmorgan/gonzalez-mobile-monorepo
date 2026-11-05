import { eventBus } from './eventBus';

/**
 * Equipo no aprobado en Guardify (issue #146). El servidor corta una sesión con `403` y el mensaje
 * `device_not_approved|ESTADO|motivo` (ver `apps/server/utils/guardifyDevices.ts`); la app lo distingue de un 401/403 normal (token vencido),
 * NO cierra la sesión y muestra la pantalla de estado correspondiente.
 */

export const DEVICE_NOT_APPROVED_EVENT = 'deviceNotApproved';

export type DeviceBlock = { status: string; reason: string | null };

export function parseDeviceNotApprovedMessage(message: unknown): DeviceBlock | null {
  const m = /^device_not_approved\|([^|]*)\|([\s\S]*)$/.exec(String(message ?? ''));
  if (!m) return null;
  const reason = (m[2] ?? '').trim();
  return { status: (m[1] || 'BLOCKED').toUpperCase(), reason: reason || null };
}

export type DeviceStatusInfo = { title: string; body: string; canRetry: boolean };

/**
 * Texto provisional de cada estado: más adelante el texto y el contacto de soporte vendrán configurables desde Guardify.
 * Estados: PENDING, UNREGISTERED (sin registrar), REJECTED, BLOCKED / LOCKED, RETIRED.
 */
export function describeDeviceStatus(status: string, reason: string | null): DeviceStatusInfo {
  const motivo = reason ? `\n\nMotivo: ${reason}` : '';
  switch (String(status).toUpperCase()) {
    case 'PENDING':
      return { title: 'Esperando aprobación', body: 'Tu equipo está pendiente de aprobación por un administrador. Cuando lo aprueben podrás ingresar.', canRetry: true };
    case 'UNREGISTERED':
      return { title: 'Equipo no registrado', body: 'Este equipo todavía no está registrado. Abre la aplicación con conexión a internet para registrarlo y espera su aprobación.', canRetry: true };
    case 'REJECTED':
      return { title: 'Equipo rechazado', body: `Este equipo fue rechazado y no puede usar la aplicación.${motivo}`, canRetry: false };
    case 'RETIRED':
      return { title: 'Equipo retirado', body: `Este equipo fue retirado y no puede usar la aplicación.${motivo}`, canRetry: false };
    case 'UPDATE_REQUIRED':
      return { title: 'Actualiza la app', body: reason || 'Esta versión de la aplicación ya no se puede usar. Instala la versión más reciente para continuar.', canRetry: false };
    case 'LOCKED':
    case 'BLOCKED':
    default:
      return { title: 'Equipo bloqueado', body: `Un administrador bloqueó este equipo.${motivo}`, canRetry: false };
  }
}

let current: DeviceBlock | null = null;

export function getCurrentDeviceBlock(): DeviceBlock | null {
  return current;
}

export function reportDeviceNotApproved(block: DeviceBlock): void {
  current = block;
  eventBus.emit(DEVICE_NOT_APPROVED_EVENT, block);
}

export function clearDeviceBlock(): void {
  current = null;
  eventBus.emit(DEVICE_NOT_APPROVED_EVENT, null);
}

/**
 * Si la respuesta es un 403 `device_not_approved` avisa a la app y devuelve true (el que llama NO debe cerrar la sesión);
 * con cualquier otra respuesta devuelve false.
 */
export async function handleDeviceNotApprovedResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  try {
    const data = await response.clone().json();
    const block = parseDeviceNotApprovedMessage(data?.message);
    if (!block) return false;
    reportDeviceNotApproved(block);
    return true;
  } catch {
    return false;
  }
}
