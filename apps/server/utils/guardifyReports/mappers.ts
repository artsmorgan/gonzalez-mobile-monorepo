import { buildNombre } from "./names";
import type { OutRow } from "./listing";

/** Fecha/hora «de pared» tal como la guarda la base (sin zona): `YYYY-MM-DDTHH:mm:ss`. */
export function fmtDt(d: Date | string | null | undefined): string | null {
    if (d == null || d === "") return null;
    if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19);
    const s = String(d).trim();
    return s ? s.slice(0, 19).replace(" ", "T") : null;
}

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

export function mapLoginMarcaRow(r: any): OutRow {
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha_hora),
        cedula: txt(r.cedula_empleado),
        empleado: txt(r.nombre_empleado),
        puesto: txt(r.puesto_nombre),
        entrada_teorica: fmtDt(r.marca_entrada_teorica),
        entrada_real: fmtDt(r.marca_entrada_real),
        salida_teorica: fmtDt(r.marca_salida_teorica),
        salida_real: fmtDt(r.marca_salida_real),
        inicio_almuerzo: fmtDt(r.hora_inicio_almuerzo),
        fin_almuerzo: fmtDt(r.hora_fin_almuerzo),
    };
}

/**
 * Detalle de las pausas de un almuerzo para Guardify (columna `pausas_detalle`, tipo `pausas`): texto JSON de
 * `[{ inicio, fin, motivo }]` con las fechas «de pared» (`YYYY-MM-DDTHH:mm:ss`), como el resto de columnas de fecha.
 * Sin lista (el registro no la trae) → `null`; sin pausas → `"[]"`. Guardify da el formato visible; aquí no se interpreta nada.
 */
export function pausasDetalle(pausasList: unknown): string | null {
    if (!Array.isArray(pausasList)) return null;
    const out = pausasList
        .map((p: any) => ({ inicio: fmtDt(p?.startTime ?? p?.inicio), fin: fmtDt(p?.endTime ?? p?.fin), motivo: txt(p?.reason ?? p?.motivo) }))
        .filter((p) => p.inicio || p.fin || p.motivo);
    return JSON.stringify(out);
}

export function mapTiempoAlmuerzoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        inicio: fmtDt(r.inicio),
        fin: fmtDt(r.fin),
        empleado: txt(r.empleado_nombre),
        cedula: txt(r.cedula_empleado),
        minutos: r.minutos_almuerzo == null ? null : Math.round(Number(r.minutos_almuerzo) * 100) / 100,
        empresa: txt(r.empresa_nombre),
        cliente: txt(r.cliente_nombre),
        division: txt(r.division_nombre),
        contrato: txt(r.contrato_nombre),
        sucursal: txt(r.corpo_nombre),
        puesto: txt(r.puesto_nombre),
        pausas: Array.isArray(r.pausas_list) ? r.pausas_list.length : 0,
        pausas_detalle: pausasDetalle(r.pausas_list),
        manual: r.es_manual ? "Sí" : "No",
        // Nunca se expone `firma_empleado` (imagen de la firma).
    };
}

function countDevices(device: string | null | undefined): number {
    if (!device || String(device).trim() === "") return 0;
    try {
        const p = JSON.parse(String(device));
        if (Array.isArray(p)) return p.length;
    } catch {
        /* texto libre: cuenta como uno */
    }
    return 1;
}

/** Ingresos de usuario. Se omite a propósito `token` (el token de refresco es una credencial). */
export function mapIngresoUsuarioRow(r: any): OutRow {
    const e = r.c_empleado ?? null;
    return {
        id: Number(r.id),
        creado: fmtDt(r.createdAt),
        expira: fmtDt(r.expiresAt),
        empleado: e ? txt(buildNombre(e)) : null,
        cedula: txt(e?.cedula),
        id_sesion: txt(r.sessionId),
        dispositivos: countDevices(r.device),
        revocado: r.revoked ? "Sí" : "No",
    };
}
