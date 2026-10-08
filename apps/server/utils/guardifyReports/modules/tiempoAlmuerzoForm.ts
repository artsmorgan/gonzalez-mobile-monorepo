import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";

/**
 * Tiempo de almuerzo / alimentación como formulario (`c_empleado_almuerzo`). No hay generador individual (solo el Excel consolidado), así que el
 * formato sale de las columnas del consolidado y de la pantalla `LunchTimeScreen`: empleado, inicio, fin, minutos, si fue manual y las pausas.
 *
 * La «firma del empleado» NO es una imagen: es la firma digital generada con la ubicación del dispositivo (un texto en base64 que lleva la sesión, el
 * empleado y las COORDENADAS). Nunca se entrega ese texto: solo se informa que existe (`firmasPresentes`) y el papel dice «(firmada)». Si algún día
 * la columna guardara una imagen real (data URL), con `firmas=1` se entrega.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

function firmaImagen(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s) ? s : null;
}

/** Hora `HH:mm` de lo que guarda la pausa (ISO con o sin zona, `YYYY-MM-DD HH:mm:ss`, `HH:mm`, o milisegundos). */
export function horaDe(v: unknown): string | null {
    if (v == null || v === "") return null;
    if (typeof v === "number") { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(11, 16); }
    const s = String(v).trim();
    const m = /(?:[T ])(\d{2}:\d{2})/.exec(s) ?? /^(\d{2}:\d{2})/.exec(s);
    return m ? m[1]! : null;
}

/** Las pausas son un JSON `[{ startTime, endTime, reason }]` (el generador también acepta `inicio/fin/razon`). */
export function parsePausas(raw: unknown): { inicio: string | null; fin: string | null; motivo: string | null }[] {
    if (!raw || !String(raw).trim()) return [];
    let p: unknown;
    try { p = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
    if (!Array.isArray(p)) return [];
    const out: { inicio: string | null; fin: string | null; motivo: string | null }[] = [];
    for (const x of p) {
        if (!x || typeof x !== "object") continue;
        const o = x as Record<string, unknown>;
        const inicio = horaDe(o.startTime ?? o.inicio ?? o.start), fin = horaDe(o.endTime ?? o.fin ?? o.end), motivo = txt(o.reason ?? o.razon);
        if (inicio || fin || motivo) out.push({ inicio, fin, motivo });
    }
    return out;
}

const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;
const hora = (v: unknown): string | null => fmtDt(v as any)?.slice(11, 16) ?? null;

/** `raw` es la fila de `c_empleado_almuerzo`; `empleado` el registro de `c_empleado` (para el código), si se pudo cargar. */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, empleado?: any): FormRecord {
    const creado = fmtDt(raw.inicio);
    const nombre = txt(raw.empleado_nombre) ?? (empleado ? txt(buildNombre(empleado)) : null);
    const codigo = txt(empleado?.codigo);
    const minutos = raw.minutos_almuerzo == null || !Number.isFinite(Number(raw.minutos_almuerzo)) ? null : Math.round(Number(raw.minutos_almuerzo) * 100) / 100;
    const hayFirma = !!txt(raw.firma_empleado);
    const imagen = firmaImagen(raw.firma_empleado);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            empleado: nombre ? (codigo ? `${codigo} - ${nombre}` : nombre) : codigo,
            cedula: txt(raw.cedula_empleado),
            fecha_inicio: dia(raw.inicio), hora_inicio: hora(raw.inicio),
            fecha_fin: dia(raw.fin), hora_fin: hora(raw.fin),
            minutos_almuerzo: minutos,
            es_manual: raw.es_manual ? "Sí" : "No",
        },
        listas: { pausas: parsePausas(raw.pausas) },
        firmas: hayFirma ? { firma_empleado: firmas ? imagen : null } : {},
        firmasPresentes: hayFirma ? ["firma_empleado"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const tiempoAlmuerzoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Solo activos, como el módulo de lista. Empleados y estructura en lote.
        const rows: any[] = await (db as any).c_empleado_almuerzo.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const loc = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const [empleados, ubic] = await Promise.all([
            findByIds<any>(db as any, "c_empleado", rows.map((r) => r.empleadoId), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
            ubicacionTextos(db as any, rows.map(loc)),
        ]);
        return rows.map((r) => armarRegistro(r, ubic(loc(r)), firmas, empleados.get(Number(r.empleadoId))));
    },
};
