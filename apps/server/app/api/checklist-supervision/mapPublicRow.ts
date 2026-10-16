/* eslint-disable @typescript-eslint/no-explicit-any */
import { sanitizeArticulosPuestoForPersistence } from "../../../utils/sanitizeArticulosPuestoForPersistence";

function timeToHHmm(val: any): string | null {
  if (val == null) return null;
  const d = val instanceof Date ? val : typeof val === "string" ? new Date(val) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Fila pública alineada con GET lista / GET por id (sin joins crudos de Prisma). */
export function mapChecklistSupervisionPublicRow(r: any, baseUrl: string) {
  const images = Array.isArray((r as any).c_imagenes_checklist_supervision)
    ? (r as any).c_imagenes_checklist_supervision.map((img: any) => ({
        id: img.id,
        name: img.name,
        original_name: img.original_name,
        url: baseUrl
          ? `${baseUrl}/api/checklist-supervision/${r.id}/get-image/${encodeURIComponent(img.name)}`
          : "",
      }))
    : [];

  return {
    id: r.id,
    empresa_id: (r as any).empresa_id ?? 0,
    cliente_id: r.cliente_id,
    division_id: r.division_id,
    contrato_id: (r as any).contrato_id ?? 0,
    corpo_id: r.corpo_id ?? r.e_estructura_sucursal?.id ?? null,
    puesto_id: r.puesto_id,
    isActive: (r as any).isActive !== false,
    fecha: r.fecha,
    ejecutivo_cuenta: r.ejecutivo_cuenta,
    evaluacion: r.evaluacion,
    articulos_puesto: (r as any).articulos_puesto
      ? sanitizeArticulosPuestoForPersistence((r as any).articulos_puesto)
      : null,
    firma_supervisor: r.firma_supervisor,
    firma_responsable: r.firma_responsable,
    created_by: r.created_by,
    created_at: r.created_at,
    empleado_id: (r as any).empleado_id ?? null,
    empleado_nombre: (r as any).empleado_nombre ?? null,
    empleado_codigo: (r as any).empleado_codigo ?? null,
    hora_inicio: timeToHHmm((r as any).hora_inicio) ?? (r as any).hora_inicio ?? null,
    hora_fin: timeToHHmm((r as any).hora_fin) ?? (r as any).hora_fin ?? null,
    cliente: r.e_estructura_cliente,
    corpo: r.e_estructura_sucursal,
    puesto: r.e_estructura_puesto,
    images,
  };
}
