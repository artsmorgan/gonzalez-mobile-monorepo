import resolveDeviceCoordinates, {
  type DeviceCoordsResult,
  DEVICE_COORDS_LABELS_PUESTO_UBICACION,
} from './resolveDeviceCoordinates';

export type PuestoUbicacionCoordsResult = DeviceCoordsResult;

/**
 * Coordenadas para actualizar ubicación del puesto (mismo flujo de reintentos que marca ingreso).
 */
export default async function resolvePuestoUbicacionCoordinates(options?: {
  silent?: boolean;
}): Promise<PuestoUbicacionCoordsResult> {
  return resolveDeviceCoordinates({
    silent: options?.silent,
    labels: DEVICE_COORDS_LABELS_PUESTO_UBICACION,
  });
}
