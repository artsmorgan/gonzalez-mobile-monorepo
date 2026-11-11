/**
 * «Mis puestos» (módulo Ubicación del puesto): interpreta la respuesta de `GET /api/puestos/mis-puestos`. Módulo puro para probarlo en Node.
 */
export type MiPuesto = {
  id: number;
  codigo: string | null;
  nombre: string;
  sucursal: { id: number; nombre: string } | null;
  ubicacion: { lat: number | null; lng: number | null };
  proxima_fecha: string | null;
};

/** Puestos de la respuesta del servidor; descarta lo que no tenga id y conserva el orden recibido. */
export function parseMisPuestos(body: unknown): MiPuesto[] {
  const raw = (body as { puestos?: unknown } | null | undefined)?.puestos;
  if (!Array.isArray(raw)) return [];
  const out: MiPuesto[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const p = item as Record<string, unknown> | null;
    const id = Number(p?.id);
    if (!p || !Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const suc = p.sucursal as { id?: unknown; nombre?: unknown } | null | undefined;
    const ubi = p.ubicacion as { lat?: unknown; lng?: unknown } | null | undefined;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    out.push({
      id,
      codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : null,
      nombre: String(p.nombre ?? '').trim() || `Puesto #${id}`,
      sucursal: suc && Number.isFinite(Number(suc.id)) ? { id: Number(suc.id), nombre: String(suc.nombre ?? '').trim() } : null,
      ubicacion: { lat: num(ubi?.lat), lng: num(ubi?.lng) },
      proxima_fecha: typeof p.proxima_fecha === 'string' && p.proxima_fecha ? p.proxima_fecha : null,
    });
  }
  return out;
}

/** «CÓDIGO · Nombre» (o solo el nombre). */
export function misPuestoTitulo(p: Pick<MiPuesto, 'codigo' | 'nombre'>): string {
  return p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre;
}
