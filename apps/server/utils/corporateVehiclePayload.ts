export function isTipoBicicleta(tipo: unknown): boolean {
  return String(tipo ?? "").trim() === "Bicicleta";
}

export function optionalVehicleString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function optionalVehicleInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function optionalVehicleBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

/** Largos de las columnas de texto opcionales de `c_vehiculos_corporativos` (VIN y datos de documentos). */
export const VEHICLE_VIN_MAX = 40;
export const VEHICLE_DOC_NUM_MAX = 100;

/** Texto opcional recortado y limitado al largo de la columna (vacío → null): un dato largo no debe romper el guardado. */
export function optionalVehicleText(v: unknown, max: number): string | null {
  const s = optionalVehicleString(v);
  return s == null ? null : s.slice(0, max);
}

export function normalizeMarca(marca: unknown): string {
  return String(marca ?? "").trim();
}

export type CorporateVehicleOptionalFields = {
  placa: string | null;
  kilometraje: number | null;
  prox_cambio_aceite: number | null;
  modelo: string | null;
  anno: number | null;
  descripcion: string | null;
  titulo_propiedad: boolean | null;
  rtv: boolean | null;
  marchamo: boolean | null;
  /** VIN o chasis (issue #139). */
  vin: string | null;
  /** Número o dato de cada documento, como texto opcional (issue #143); el Sí/No sigue en los booleanos. */
  titulo_propiedad_num: string | null;
  rtv_num: string | null;
  marchamo_num: string | null;
};

/** Datos mínimos para crear vehículo desde bitácora (POST/PUT register_vehicle). */
export function canRegisterCorporateVehicleFromBitacora(register_vehicle: Record<string, unknown>): boolean {
  const tipoVeh = register_vehicle.tipo ?? (register_vehicle as { tipo?: unknown }).tipo;
  if (!String(tipoVeh ?? "").trim()) return false;
  if (!normalizeMarca(register_vehicle.marca)) return false;
  if (isTipoBicicleta(tipoVeh)) return true;
  const placaOk = optionalVehicleString(register_vehicle.placa) != null;
  const autoriaOk = optionalVehicleString(register_vehicle.tipo_autoria) != null;
  return placaOk && autoriaOk;
}

export function buildCorporateVehicleCreateFromBitacora(
  register_vehicle: Record<string, unknown>,
  extras: {
    empresa_id: number;
    cliente_id: number;
    sucursal_id: number;
    firma_responsable: string;
    created_by: number;
    created_at: string;
  },
): Record<string, unknown> {
  const tipoVeh = String(register_vehicle.tipo ?? "").trim();
  const optional = buildCorporateVehicleOptionalFields({
    tipo: tipoVeh,
    placa: register_vehicle.placa,
    kilometraje: register_vehicle.kilometraje,
    prox_cambio_aceite: register_vehicle.prox_cambio_aceite,
    modelo: register_vehicle.modelo,
    anno: register_vehicle.anno,
    descripcion: register_vehicle.descripcion,
    titulo_propiedad: register_vehicle.titulo_propiedad,
    rtv: register_vehicle.rtv,
    marchamo: register_vehicle.marchamo,
    vin: register_vehicle.vin,
    titulo_propiedad_num: register_vehicle.titulo_propiedad_num,
    rtv_num: register_vehicle.rtv_num,
    marchamo_num: register_vehicle.marchamo_num,
  });
  return {
    empresa_id: extras.empresa_id,
    cliente_id: extras.cliente_id,
    sucursal_id: extras.sucursal_id,
    ...optional,
    tipo: tipoVeh,
    tipo_autoria: optionalVehicleString(register_vehicle.tipo_autoria) ?? "",
    estado: "Activo",
    marca: normalizeMarca(register_vehicle.marca),
    descripcion: optional.descripcion ?? "-",
    firma_responsable: extras.firma_responsable,
    created_by: extras.created_by,
    created_at: extras.created_at,
  };
}

export function buildCorporateVehicleOptionalFields(body: {
  tipo: unknown;
  placa?: unknown;
  kilometraje?: unknown;
  prox_cambio_aceite?: unknown;
  modelo?: unknown;
  anno?: unknown;
  descripcion?: unknown;
  titulo_propiedad?: unknown;
  rtv?: unknown;
  marchamo?: unknown;
  vin?: unknown;
  titulo_propiedad_num?: unknown;
  rtv_num?: unknown;
  marchamo_num?: unknown;
}): CorporateVehicleOptionalFields {
  const esBicicleta = isTipoBicicleta(body.tipo);
  if (esBicicleta) {
    return {
      placa: null,
      kilometraje: null,
      prox_cambio_aceite: null,
      modelo: null,
      anno: null,
      descripcion: optionalVehicleString(body.descripcion),
      titulo_propiedad: null,
      rtv: null,
      marchamo: null,
      vin: null,
      titulo_propiedad_num: null,
      rtv_num: null,
      marchamo_num: null,
    };
  }
  return {
    placa: optionalVehicleString(body.placa),
    kilometraje: optionalVehicleInt(body.kilometraje),
    prox_cambio_aceite: optionalVehicleInt(body.prox_cambio_aceite),
    modelo: optionalVehicleString(body.modelo),
    anno: optionalVehicleInt(body.anno),
    descripcion: optionalVehicleString(body.descripcion),
    titulo_propiedad: optionalVehicleBool(body.titulo_propiedad),
    rtv: optionalVehicleBool(body.rtv),
    marchamo: optionalVehicleBool(body.marchamo),
    vin: optionalVehicleText(body.vin, VEHICLE_VIN_MAX),
    titulo_propiedad_num: optionalVehicleText(body.titulo_propiedad_num, VEHICLE_DOC_NUM_MAX),
    rtv_num: optionalVehicleText(body.rtv_num, VEHICLE_DOC_NUM_MAX),
    marchamo_num: optionalVehicleText(body.marchamo_num, VEHICLE_DOC_NUM_MAX),
  };
}
