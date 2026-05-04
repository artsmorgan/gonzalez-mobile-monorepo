/* eslint-disable @typescript-eslint/no-explicit-any */

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
    corpo_id: r.corpo_id,
    puesto_id: r.puesto_id,
    isActive: (r as any).isActive !== false,
    fecha: r.fecha,
    ejecutivo_cuenta: r.ejecutivo_cuenta,
    evaluacion: r.evaluacion,
    articulos_puesto: (r as any).articulos_puesto || null,
    firma_supervisor: r.firma_supervisor,
    firma_responsable: r.firma_responsable,
    created_by: r.created_by,
    created_at: r.created_at,
    cliente: r.e_estructura_cliente,
    corpo: r.e_estructura_sucursal,
    puesto: r.e_estructura_puesto,
    images,
  };
}
