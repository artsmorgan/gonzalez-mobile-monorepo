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
  };
}
