import resolveDeviceCoordinates, {
  type DeviceCoordsResult,
  DEVICE_COORDS_LABELS_MARCA_INGRESO,
} from './resolveDeviceCoordinates';

export type MarcaIngresoCoordsResult = DeviceCoordsResult;

/**
 * Coordenadas para marcar ingreso (reexporta resolveDeviceCoordinates con mensajes de marca).
 */
export default async function resolveMarcaIngresoCoordinates(options?: {
  silent?: boolean;
}): Promise<MarcaIngresoCoordsResult> {
  return resolveDeviceCoordinates({
    silent: options?.silent,
    labels: DEVICE_COORDS_LABELS_MARCA_INGRESO,
  });
}
