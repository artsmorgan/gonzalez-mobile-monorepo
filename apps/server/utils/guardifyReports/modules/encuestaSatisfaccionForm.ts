import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Encuesta de satisfacción del cliente (`c_encuesta_cliente`) como formulario. Dos formatos según la división: Seguridad y Aseo y limpieza
 * (cambia el título y la sección 3). Las preguntas se guardan en cada registro (`evaluaciones`: `{ form: [{ section_title, questions, observations }],
 * know_process }`) y pueden estar editadas, por eso se entregan como listas por sección (`seccion_1` … `seccion_5`, en el orden de la encuesta) y el
 * formato imprime las preguntas que traiga cada registro. La calificación sale con el texto de la escala (Muy Malo … Muy Bueno; en
 * «Apreciaciones globales» la otra escala), igual que las marcas «X» del Excel individual.
 *
 * No se entregan: la cédula, el correo ni el teléfono de la persona evaluada (datos personales del cliente, como en la lista), la firma del
 * responsable (digital, con sesión y ubicación) ni nada de los adjuntos. La firma del evaluado es la dibujada.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const esImagen = (s: string) => s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)/.test(s) || /^[A-Za-z0-9+/=\s]{400,}$/.test(s);
const imagenFirma = (v: unknown): string | null => {
    const s = txt(v);
    if (!s || !esImagen(s)) return null;
    return s.startsWith("data:image/") ? s : `data:image/png;base64,${s.replace(/\s+/g, "")}`;
};

/** Párrafo de compromiso e instrucción que el generador imprime antes de las preguntas. */
export const COMPROMISO =
    "Nuestra empresa está comprometida con una mejora permanente de nuestra calidad, por ello nos es importante conocer la opinión de nuestros clientes sobre la calidad de nuestros servicios. Su opinión nos permitirá mejorar y ofrecerle mejores servicios. Por ello, le agradecemos dedicar unos minutos para completar este cuestionario. Muchas gracias!! Marque con (X) la opción que represente su opinión.";

/** Escalas del generador: la normal y la de «Apreciaciones globales»; la última es «no aplica». */
export const ESCALA = ["Muy Malo", "Malo", "Regular", "Bueno", "Muy Bueno", "No sabe/No aplica"];
export const ESCALA_GLOBAL = ["Mucho menos de lo esperado", "Menos de lo esperado", "Tal como lo esperaba", "Más de lo esperado", "Mucho más de lo esperado", "No sabe/No aplica"];
/** Cuántas preguntas trae cada sección de la plantilla de cada formato (para ubicar las del formato anterior, que venían en una sola lista). */
const TAMANOS: Record<string, number[]> = { Seguridad: [6, 4, 3, 2, 1], "Aseo y limpieza": [6, 4, 5, 2, 1] };
const MAX_SECCIONES = 5;

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Igual que el generador: si la división dice «seguridad» es Seguridad y cualquier otra es Aseo y limpieza; sin división, se mira el título de la sección 3. */
export function varianteDe(division: unknown, titulos: string[] = []): string {
    const d = norm(division);
    if (d.includes("seguridad")) return "Seguridad";
    if (d.includes("aseo") || d.includes("limpieza")) return "Aseo y limpieza";
    const t = norm(titulos.join(" "));
    if (t.includes("seguridad")) return "Seguridad";
    return "Aseo y limpieza";
}

const aplica = (raw: unknown): boolean => {
    if (raw === undefined || raw === null) return true;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") { const s = raw.trim().toLowerCase(); if (s === "false" || s === "0") return false; if (s === "true" || s === "1") return true; }
    return Boolean(raw);
};
const conoce = (raw: unknown): boolean => (typeof raw === "string" ? ["true", "1", "sí", "si"].includes(raw.trim().toLowerCase()) : typeof raw === "number" ? raw !== 0 : Boolean(raw));

/** El JSON a veces está doblemente codificado. */
function parseJson(raw: unknown): unknown {
    let v: unknown = raw;
    for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return null; } }
    return v;
}

type Seccion = { titulo: string; preguntas: { pregunta: string; valor: number; aplica: boolean }[]; observaciones: string | null };
/** Secciones y «¿conoce el procedimiento de quejas?» (`null` en el formato anterior, que no lo guardaba). */
export function leerEvaluaciones(raw: unknown, variante: string): { secciones: Seccion[]; conoce: boolean | null } {
    const d: any = parseJson(raw);
    if (d && !Array.isArray(d) && Array.isArray(d.form)) {
        const secciones = d.form.filter((s: any) => s && typeof s === "object").map((s: any): Seccion => ({
            titulo: String(s.section_title ?? "").trim(),
            observaciones: txt(s.observations),
            preguntas: (Array.isArray(s.questions) ? s.questions : []).filter((q: any) => q && typeof q === "object").map((q: any) => {
                const ap = aplica(q.apply);
                let v = Number(q.value);
                if (!Number.isFinite(v)) v = ap ? 5 : 0; // como el generador: sin valor, una pregunta que aplica cuenta 5
                v = Math.min(5, Math.max(0, Math.round(v)));
                return { pregunta: String(q.question ?? "").trim(), aplica: ap, valor: !ap ? 0 : v < 1 ? 1 : v };
            }),
        }));
        return { secciones, conoce: conoce(d.know_process) };
    }
    if (Array.isArray(d) && d.length && d.every((x: any) => x && typeof x === "object" && "question" in x)) {
        // Formato anterior: una lista plana que se reparte en las secciones de la plantilla, como hace la pantalla.
        const planas = d.map((x: any) => { const n = parseInt(String(x.result ?? x.value), 10); return { pregunta: String(x.question ?? "").trim(), aplica: true, valor: n >= 1 && n <= 5 ? n : 5 }; });
        const secciones: Seccion[] = [];
        let i = 0;
        for (const n of TAMANOS[variante] ?? TAMANOS.Seguridad!) { secciones.push({ titulo: "", preguntas: planas.slice(i, i + n), observaciones: null }); i += n; }
        return { secciones, conoce: null };
    }
    return { secciones: [], conoce: null };
}

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const creado = fmtDt(raw.created_at);
    const previa = leerEvaluaciones(raw.evaluaciones, "Seguridad");
    const variante = varianteDe(ubic.division, [previa.secciones[2]?.titulo ?? ""]);
    // El formato anterior (lista plana) se reparte según la plantilla de la variante; el nuevo ya trae sus secciones.
    const { secciones, conoce: sabe } = previa.conoce === null ? leerEvaluaciones(raw.evaluaciones, variante) : previa;
    const valores: FormRecord["valores"] = {
        compromiso: COMPROMISO,
        nombre_completo: txt(raw.nombre_evaluado),
        empresa_institucion: txt(raw.empresa_evaluado) ?? ubic.cliente,
        fecha: fmtDt(raw.fecha)?.slice(0, 10) ?? null,
        conoce_procedimiento_quejas: sabe === null ? null : sabe ? "Sí" : "No",
        observaciones: txt(raw.observaciones),
    };
    const listas: FormRecord["listas"] = {};
    for (let i = 0; i < MAX_SECCIONES; i++) {
        const s = secciones[i];
        valores[`seccion_${i + 1}_observaciones`] = s?.observaciones ?? null;
        const escala = String(s?.titulo ?? "").toUpperCase().includes("APRECIACIONES GLOBALES") || (i === 4 && !s?.titulo) ? ESCALA_GLOBAL : ESCALA;
        listas[`seccion_${i + 1}`] = (s?.preguntas ?? []).map((q) => ({ item: q.pregunta, valor: q.aplica && q.valor >= 1 ? escala[q.valor - 1]! : escala[5]!, observacion: null }));
    }
    const firma = imagenFirma(raw.firma_evaluado);
    return {
        id: Number(raw.id), variante, creado, estructura: ubic, valores, listas,
        firmas: firma ? { firma_evaluado: firmas ? firma : null } : {},
        firmasPresentes: firma ? ["firma_evaluado"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const encuestaSatisfaccionForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_encuesta_cliente.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ub = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(db as any, rows.map(ub));
        return rows.map((r) => armarRegistro(r, ubic(ub(r)), firmas));
    },
};
