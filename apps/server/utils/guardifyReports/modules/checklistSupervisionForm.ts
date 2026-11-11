import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Checklist de supervisión como formulario (`c_checklist_supervision`). No hay generador individual: el formato sale de la pantalla móvil
 * (ChecklistSupervisionScreen) y de la hoja «Detalles» del consolidado. El formato cambia según la DIVISIÓN del contrato:
 * «Seguridad» o «Aseo y limpieza» (variantes).
 *
 * `evaluacion` es un JSON dinámico: secciones → subsecciones (cada punto evaluado) → inputs (select, checkbox, date, text, textarea, photo).
 * Cada sección conocida (por su `id` de plantilla) viaja como una lista con ese `id` (guiones → `_`) y filas `{ punto, resultado, fecha,
 * observacion, cual, aporta }`; lo que el usuario agregó en una sección propia va a la lista `otros` con su nombre de sección.
 * NUNCA se entregan las fotos (inputs `photo`, ni los de texto con «foto» en el título, ni valores que sean imágenes) ni `firma_responsable`
 * (cadena QR, no un dibujo). La firma del supervisor sí es un dibujo y va como firma.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const parseArr = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};
const isImage = (v: string) => v.startsWith("data:image/") || /^[A-Za-z0-9+/=\s]{200,}$/.test(v);

/** Firma guardada como data URL o base64 suelto (igual que el generador); lo demás no es una imagen. */
export function firmaImagen(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{100,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
}

/** `HH:mm` desde un texto de hora o un Date de hora «de pared» (1970-01-01THH:mm), igual que el módulo de lista. */
export function hhmm(v: unknown): string | null {
    if (v == null || String(v).trim() === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(11, 16);
    const m = /(\d{2}):(\d{2})/.exec(String(v));
    return m ? `${m[1]}:${m[2]}` : null;
}

export const SEGURIDAD = "Seguridad";
export const ASEO = "Aseo y limpieza";
/** Secciones de la plantilla de cada formato, por `id`. `licencias` está en los dos: la app la agrega también al checklist de aseo. */
const SECCIONES_SEGURIDAD = ["carnes", "licencias", "uniforme-seguridad", "bitacora", "marcas", "perimetro", "vehiculos", "capacitacion-iso", "papeleria", "funcion"];
const SECCIONES_ASEO = ["limpieza-general", "cuarto-aseo", "servicios-sanitarios", "uniforme-presentacion", "calificacion-general"];
const CONOCIDAS = new Set([...SECCIONES_SEGURIDAD, ...SECCIONES_ASEO]);
/** Título de la sección (normalizado) → id, para registros cuya sección no trae el id de la plantilla. «Cuarto de aseo» se repite en dos secciones: no sirve. */
const POR_TITULO: Record<string, string> = {
    carnes: "carnes", licencias: "licencias", uniforme: "uniforme-seguridad", bitacora: "bitacora", marcas: "marcas", perimetro: "perimetro", vehiculos: "vehiculos",
    "politica integrada": "capacitacion-iso", papeleria: "papeleria", funcion: "funcion",
    "limpieza general del area": "limpieza-general", "uniforme y presentacion": "uniforme-presentacion", "estado de los equipos": "calificacion-general",
};
const listaDe = (id: string) => id.replace(/[^A-Za-z0-9]+/g, "_");

/** Seguridad o Aseo y limpieza: por el nombre de la división (como la app) y, si no basta, por las secciones que trae el registro. */
export function varianteDe(division: unknown, seccionIds: string[]): string | null {
    const d = norm(division);
    if (/\b(aseo|limpieza)\b/.test(d)) return ASEO;
    if (/\bseguridad\b/.test(d)) return SEGURIDAD;
    if (seccionIds.some((s) => SECCIONES_ASEO.includes(s))) return ASEO;
    if (seccionIds.some((s) => SECCIONES_SEGURIDAD.includes(s) && s !== "licencias")) return SEGURIDAD;
    return null;
}

const esFoto = (inp: any) => String(inp?.type ?? "").toLowerCase() === "photo" || (String(inp?.type ?? "").toLowerCase() === "text" && /foto/i.test(String(inp?.title ?? "")));
const SI = new Set(["true", "1", "si", "sí", "yes", "y"]);

/** Un punto evaluado (subsección) → fila plana. Sin fotos. */
export function filaDe(sub: any) {
    const inputs: any[] = (Array.isArray(sub?.inputs) ? sub.inputs : []).filter((i: any) => i && typeof i === "object" && !esFoto(i));
    const val = (i: any): string | null => { const s = txt(i?.value); return s && !isImage(s) ? s : null; };
    const tipo = (i: any) => String(i.type ?? "").toLowerCase();
    const select = inputs.find((i) => tipo(i) === "select");
    const check = inputs.find((i) => tipo(i) === "checkbox");
    const fecha = inputs.find((i) => tipo(i) === "date");
    const textos = inputs.filter((i) => tipo(i) === "text" || tipo(i) === "textarea");
    const cual = textos.find((i) => /cu[aá]l/i.test(String(i.title ?? "")));
    const aporta = textos.find((i) => /aporta/i.test(String(i.title ?? "")));
    const libres = textos.filter((i) => i !== cual && i !== aporta);
    const titulo = (i: any) => txt(i.title);
    const obs = libres.filter((i) => /observaci/i.test(titulo(i) ?? ""));
    const resto = libres.filter((i) => !obs.includes(i));
    // El resultado es el select; si no hay, la casilla (SI/NO); si no, el primer texto sin título propio (p. ej. el número de serie del arma).
    let resultado: string | null = select ? val(select) : check ? (SI.has(String(check.value ?? "").trim().toLowerCase()) ? "SI" : "NO") : null;
    const extras: string[] = [];
    for (const i of resto) {
        const v = val(i);
        if (!v) continue;
        const t = titulo(i);
        if (resultado === null && (!t || norm(t) === "respuesta")) resultado = v;
        else extras.push(t && norm(t) !== "respuesta" ? `${t}: ${v}` : v);
    }
    const f = fecha ? val(fecha) : null;
    const observacion = [...obs.map(val), ...extras, txt(sub?.detalle)].filter(Boolean).join(" · ") || null;
    return {
        punto: txt(sub?.title), resultado, fecha: f && /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : f, observacion,
        cual: cual ? val(cual) : null, aporta: aporta ? val(aporta) : null,
    };
}

/** `evaluacion` → listas por sección conocida y `otros` (secciones agregadas por el usuario). */
export function listasDeEvaluacion(raw: unknown): { listas: FormRecord["listas"]; seccionIds: string[] } {
    const listas: FormRecord["listas"] = {};
    const seccionIds: string[] = [];
    const otros: Record<string, string | number | null>[] = [];
    for (const sec of parseArr(raw)) {
        if (!sec || typeof sec !== "object") continue;
        const id0 = txt(sec.id)?.toLowerCase() ?? "";
        const id = CONOCIDAS.has(id0) ? id0 : POR_TITULO[norm(sec.title)] ?? null;
        const subs = (Array.isArray(sec.subsections) ? sec.subsections : []).filter((s: any) => s && typeof s === "object");
        if (id) {
            seccionIds.push(id);
            (listas[listaDe(id)] ??= []).push(...subs.map(filaDe));
        } else {
            for (const s of subs) { const f = filaDe(s); otros.push({ seccion: txt(sec.title), punto: f.punto, resultado: f.resultado, observacion: f.observacion }); }
        }
    }
    listas.otros = otros;
    return { listas, seccionIds };
}

/** `extra`: nombre del ejecutivo de cuenta (la columna guarda un id o un texto). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, extra: { ejecutivo?: string | null } = {}, hier?: Hierarchy): FormRecord {
    const fecha = fmtDt(raw.fecha);
    const { listas, seccionIds } = listasDeEvaluacion(raw.evaluacion);
    const empleado = [txt(raw.empleado_codigo), txt(raw.empleado_nombre)].filter(Boolean).join(" - ");
    listas.articulos = parseArr(raw.articulos_puesto).filter((a) => a && typeof a === "object").map((a) => ({
        nombre: txt(a.nombre), tipo: txt(a.tipo), cantidad_requerida: cantidad(a.cantidad_requerida), cantidad_real: cantidad(a.cantidad_real), estado: txt(a.estado), observaciones: txt(a.observaciones),
    }));
    const valores: FormRecord["valores"] = {
        empleado: empleado || null,
        ejecutivo: txt(extra.ejecutivo),
        fecha: fecha ? fecha.slice(0, 10) : null,
        hora_inicio: hhmm(raw.hora_inicio),
        hora_fin: hhmm(raw.hora_fin),
    };
    const img = firmaImagen(raw.firma_supervisor);
    return {
        id: Number(raw.id), variante: varianteDe(ubic.division, seccionIds), creado: fmtDt(raw.created_at), estructura: ubic, valores, listas,
        firmas: img ? { firma_supervisor: firmas ? img : null } : {},
        firmasPresentes: img ? ["firma_supervisor"] : [],
        // Igual que el módulo de lista: el alcance usa los ids de la propia fila.
        hier: hier ?? { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}
/** Cantidad como número (0 es un dato válido); vacío → null. */
function cantidad(v: unknown): number | string | null {
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : txt(v);
}

export const checklistSupervisionForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_checklist_supervision.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        // Para mostrar la ubicación completa, las filas con empresa o contrato en 0 (antiguas) la heredan de su puesto; el alcance usa la fila tal cual (como la lista).
        const incompletas = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.contrato_id) > 0));
        const ejecutivoIds = rows.map((r) => Number(String(r.ejecutivo_cuenta ?? "").trim())).filter((n) => Number.isFinite(n) && n > 0);
        const [desdePuesto, ejecutivos] = await Promise.all([
            loadPuestoHierarchy(db as any, incompletas.map((r) => Number(r.puesto_id))),
            findByIds<{ nombre: string | null }>(db as any, "n_ejecutivo_cuenta", ejecutivoIds, { nombre: true }),
        ]);
        const pos = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
        const ubicIds = rows.map((r) => { const h = desdePuesto.get(Number(r.puesto_id)); return { empresa: pos(r.empresa_id) ?? h?.empresa, cliente: pos(r.cliente_id) ?? h?.cliente, division: pos(r.division_id) ?? h?.division, contrato: pos(r.contrato_id) ?? h?.contrato, corpo: pos(r.corpo_id) ?? h?.corpo, puesto: pos(r.puesto_id) }; });
        const ubic = await ubicacionTextos(db as any, ubicIds);
        return rows.map((r, i) => {
            // La app deja «-» cuando no hay ejecutivo.
            const raw = txt(r.ejecutivo_cuenta) === "-" ? null : txt(r.ejecutivo_cuenta);
            const n = Number(raw);
            const ejecutivo = Number.isFinite(n) && n > 0 ? txt(ejecutivos.get(n)?.nombre) ?? raw : raw;
            return armarRegistro(r, ubic(ubicIds[i]!), firmas, { ejecutivo });
        });
    },
};
