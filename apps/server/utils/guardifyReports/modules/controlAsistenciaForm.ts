import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Control de asistencia como formulario (`c_control_asistencia`): una hoja por control, igual que `buildControlAsistenciaExcelIndividual`.
 * El turno (Diurno / Mixto / Nocturno) es solo una casilla marcada: el formato es el mismo, no hay variantes.
 * Las firmas de los colaboradores y sustitutos van DENTRO de la tabla del papel (una por renglón): son columnas de firma de la definición. La celda trae la
 * imagen (data URL) solo con `firmas=true`; sin ella, o si lo guardado no es una imagen, dice «Firmada». Sin firma, null.
 * `firma_responsable` (firma digital con ubicación del QR) no es una imagen y el papel no la imprime: no se entrega.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Texto fijo que el generador imprime bajo el título. */
export const INSTRUCCION = 'Si el colaborador no se presenta complete el campo "Firma/Comentario" con el motivo: Ausente, Incapacitado CCSS, Incapacitado INS, PSG, PG, Vacaciones, Suspendido, Preaviso';

function firmaImagen(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
    if (s.startsWith("iVBOR")) return `data:image/png;base64,${s}`;
    if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
    return null;
}

/** Celda de firma de una tabla (contrato de Guardify): imagen solo si se pidió y es imagen de verdad; «Firmada» si existe; null si no hay. */
export function celdaFirma(raw: unknown, firmas: boolean): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const img = firmaImagen(s);
    return img && firmas ? img : "Firmada";
}

function parseColaboradores(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try { const p = JSON.parse(String(raw)); return Array.isArray(p) ? p : []; } catch { return []; }
}

/** Hora `HH:mm` de lo que guarda el móvil (ISO, `HH:mm` o `HH:mm:ss`), como `formatHourOnly` del generador. */
export function soloHora(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const hm = /^(\d{2}:\d{2})(:\d{2})?$/.exec(s);
    if (hm) return hm[1]!;
    const m = /T(\d{2}:\d{2})/.exec(s);
    if (m) return m[1]!;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** «Diurno», «Mixto», «Nocturno» (la base guarda D / M / N). */
export function turnoLabel(v: unknown): "Diurno" | "Mixto" | "Nocturno" | null {
    const s = String(v ?? "").trim().toUpperCase();
    if (s === "D" || s === "DIURNO") return "Diurno";
    if (s === "M" || s === "MIXTO") return "Mixto";
    if (s === "N" || s === "NOCTURNO") return "Nocturno";
    return null;
}

/** La línea del papel: «DIURNO ( X )   MIXTO (   )   NOCTURNO (   )». */
export const turnoMarcado = (t: string | null): string =>
    (["Diurno", "Mixto", "Nocturno"] as const).map((x) => `${x.toUpperCase()} ( ${t === x ? "X" : " "} )`).join("   ");

/**
 * `raw` es la fila de `c_control_asistencia` con sus firmas de empleado en `c_control_asistencia_empleado_firmas` (como la trae el módulo de lista).
 * Cada colaborador se casa con su firma como el generador: la del titular (o la de quien lo reemplaza) y la del sustituto.
 */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const creado = fmtDt(raw.created_at);
    const porEmpleado = new Map<number, string>();
    for (const f of Array.isArray(raw.c_control_asistencia_empleado_firmas) ? raw.c_control_asistencia_empleado_firmas : []) {
        // Se guarda cualquier firma no vacía: si no es una imagen, la celda dirá «Firmada» y la cadena no sale.
        if (String(f?.firma ?? "").trim()) porEmpleado.set(Number(f.empleado_id || 0), String(f.firma));
    }
    const filas = parseColaboradores(raw.colaboradores).map((c, i) => {
        const activa = porEmpleado.get(Number(c?.empleado_id || 0)) ?? porEmpleado.get(Number(c?.empleado_reemplaza_id || 0));
        const original = porEmpleado.get(Number(c?.empleado_original_id || 0));
        const sustituto = porEmpleado.get(Number(c?.empleado_reemplaza_id || 0));
        const nombreSustituto = txt(c?.nombre_reemplazo);
        const ausente = !!c?.ausente;
        // Titular: su propia firma (sin sustituto, la que casa el generador). Con sustituto solo cuenta si el titular original firmó él mismo
        // (la `activa` sería la del sustituto y se repetiría en la otra columna). Sustituto: la del reemplazo o, si no, la activa.
        const firmaTitular = original ?? (nombreSustituto ? undefined : activa);
        const firmaSust = nombreSustituto ? (sustituto ?? activa) : undefined;
        return {
            numero: i + 1,
            nombre: txt(c?.nombre_original) ?? txt(c?.nombre),
            cedula: txt(c?.cedula),
            firma_colaborador: celdaFirma(firmaTitular, firmas),
            comentario: nombreSustituto ? "Reemplazado" : ausente ? "Ausente" : null,
            entrada: soloHora(c?.hora_inicio),
            salida: soloHora(c?.hora_fin),
            sustituto: nombreSustituto,
            cedula_sustituto: txt(c?.cedula_reemplazo),
            firma_sustituto: celdaFirma(firmaSust, firmas),
            presente: ausente ? null : "Sí",
        };
    });
    const sign: Record<string, string> = {};
    const supervisor = firmaImagen(raw.firma_manual_supervisor);
    if (supervisor) sign.firma_supervisor = supervisor;
    const turno = turnoLabel(raw.turno);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            fecha: (fmtDt(raw.fecha) ?? "").slice(0, 10) || null,
            turno,
            turno_marcado: turnoMarcado(turno),
            instruccion: INSTRUCCION,
            total_presentes: `${Number(raw.total_presentes || 0)} / ${Number(raw.total_empleados_turno || 0)}`,
            nombre_supervisor: txt(raw.nombre_supervisor),
            comentarios: txt(raw.comentarios)?.slice(0, 2000) ?? null,
        },
        listas: { colaboradores: filas },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const controlAsistenciaForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Solo activos, como el módulo de lista; las firmas de los empleados vienen con la misma consulta (relación).
        const rows: any[] = await (db as any).c_control_asistencia.findMany({ where: { id: { in: ids }, isActive: true }, include: { c_control_asistencia_empleado_firmas: true } });
        if (!rows.length) return [];
        const loc = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(db as any, rows.map(loc));
        return rows.map((r) => armarRegistro(r, ubic(loc(r)), firmas));
    },
};
