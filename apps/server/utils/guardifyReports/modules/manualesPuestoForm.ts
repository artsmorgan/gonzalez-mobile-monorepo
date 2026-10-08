import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Manual de trabajo como formulario (un solo formato). No hay generador individual: el papel sale del consolidado (hojas «Manuales», «Quices»,
 * «Puestos del manual», «Empleados del manual» y «Visualización»). Se entrega el manual, los puestos y empleados a los que llega, la ESTRUCTURA
 * del cuestionario y quién lo ha visto, firmado y aprobado.
 *
 * Decisiones de seguridad (las mismas que el módulo de lista): NO se entregan las respuestas de los empleados al cuestionario, NI las respuestas
 * correctas del cuestionario, NI las firmas manuales de los empleados (solo si firmaron) NI los anexos del manual (archivos).
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

const parseJson = (raw: unknown): any => {
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try { return JSON.parse(raw); } catch { return null; }
};

/** Mismos nombres que `getQuizTypeLabel` de la pantalla de manuales (y que el consolidado). */
export function tipoPregunta(typeKey: unknown): string | null {
    const k = String(typeKey ?? "").trim().toLowerCase();
    const mapa: Record<string, string> = { short: "Respuesta corta", paragraph: "Párrafo", multiple_choice: "Selección única", multiple_select: "Selección múltiple", list: "Lista" };
    return mapa[k] ?? txt(typeKey);
}

/** Código y nombre completo del empleado, como lo imprime el consolidado en vínculos y visualizaciones. */
const empleadoTxt = (e: any): string | null => (e ? txt([e.codigo, e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ")) : null);
/** «código - nombre completo» de quien creó el manual (así lo imprime el consolidado en «Creado por»). */
const empleadoGuion = (e: any): string | null => {
    if (!e) return null;
    const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    const cod = txt(e.codigo);
    return full ? (cod ? `${cod} - ${full}` : full) : cod;
};
const puestoTxt = (p: any): string | null => (p && txt(p.nombre) ? `${txt(p.codigo) ? `${txt(p.codigo)} - ` : ""}${txt(p.nombre)}` : null);

export type ManualRaw = {
    manual: any;
    /** Puestos vinculados ya con su texto («código - nombre»). */
    puestos: (string | null)[];
    /** Empleados vinculados ya con su texto. */
    empleados: (string | null)[];
    /** Una por visualización: { empleado (texto), firmado, approved } y los vinculados que aún no la ven: { empleado, visto: false }. */
    visualizaciones: { empleado: string | null; visto: boolean; firmado: boolean; approved: boolean | null }[];
    creadoPor: string | null;
    puestoPrincipal: string | null;
};

export function armarRegistro(raw: ManualRaw, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const m = raw.manual;
    const root = parseJson(m.quiz);
    const preguntas: any[] = Array.isArray(root) ? root : Array.isArray(root?.questions) ? root.questions : [];
    const hayQuiz = preguntas.length > 0;
    const minimo = typeof root?.minApprovalPercentage === "number" ? root.minApprovalPercentage : null;
    const puestos = [...new Set([raw.puestoPrincipal, ...raw.puestos].filter((x): x is string => !!x))];
    const estadoAprobado = (v: { visto: boolean; approved: boolean | null }) => (v.visto && v.approved === true ? "Aprobado" : v.visto && v.approved === false ? "Reprobado" : hayQuiz ? "Pendiente" : null);
    const firma = clasificarFirma(m.firma);
    return {
        id: Number(m.id), variante: null, creado: fmtDt(m.created_at), estructura: ubic,
        valores: { titulo: txt(m.title), descripcion: txt(m.description), clasificacion: txt(m.classification), creado_por: raw.creadoPor, porcentaje_minimo: minimo },
        listas: {
            puestos: puestos.map((p) => ({ puesto: p })),
            empleados: [...new Set(raw.empleados.filter((x): x is string => !!x))].map((e) => ({ empleado: e })),
            // Solo la estructura: sin la respuesta correcta (`answer` / `answers`).
            cuestionario: preguntas.filter((q) => q && typeof q === "object").map((q, i) => ({
                numero: String(i + 1), enunciado: txt(q.title ?? q.titulo), tipo: tipoPregunta(q.type),
                puntos: Number.isFinite(Number(q.points)) && String(q.points ?? "").trim() !== "" ? Number(q.points) : null,
                opciones: Array.isArray(q.options) && q.options.length ? q.options.map((o: unknown) => String(o)).join(" | ") : null,
            })),
            visualizacion: raw.visualizaciones.map((v) => ({ empleado: v.empleado, estado: !v.visto ? "No visto" : v.firmado ? "Firmado" : "Visto", aprobado: estadoAprobado(v) })),
        },
        firmas: firma ? { firma_responsable: firmas ? firma.imagen : null } : {},
        firmasPresentes: firma ? ["firma_responsable"] : [],
        hier: { empresa: m.empresa_id, cliente: m.cliente_id, division: m.division_id, contrato: m.contrato_id, corpo: m.corpo_id, puesto: m.puesto_id },
    };
}

const agrupar = (rows: any[], clave: string): Map<number, any[]> => {
    const out = new Map<number, any[]>();
    for (const r of [...rows].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))) {
        const k = Number(r[clave]);
        if (!out.has(k)) out.set(k, []);
        out.get(k)!.push(r);
    }
    return out;
};

export const manualesPuestoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const d = db as any;
        const manuales: any[] = await d.e_manual_puesto.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!manuales.length) return [];
        const mids = manuales.map((m) => Number(m.id));
        // Los vínculos y las visualizaciones por separado (con solo las columnas que se usan): la visualización trae respuestas y firmas pesadas.
        const [linkPuestos, linkEmpleados, visuales] = await Promise.all([
            d.e_puestos_manual_puesto.findMany({ where: { manual_puesto_id: { in: mids } } }) as Promise<any[]>,
            d.e_empleados_manual_puesto.findMany({ where: { manual_puesto_id: { in: mids } } }) as Promise<any[]>,
            d.e_empleado_visualizacion_manual_puesto.findMany({
                where: { manual_puesto_id: { in: mids } },
                select: { id: true, manual_puesto_id: true, empleado_id: true, nombre_empleado: true, approved: true, firma_empleado_manual: true },
            }) as Promise<any[]>,
        ]);
        const [ubic, empleados, puestos, divisiones] = await Promise.all([
            ubicacionTextos(d, manuales.map((m) => ({ empresa: m.empresa_id, cliente: m.cliente_id, division: m.division_id, contrato: m.contrato_id, corpo: m.corpo_id, puesto: m.puesto_id }))),
            findByIds<any>(d, "c_empleado", [...linkEmpleados.map((l) => l.empleado_id), ...visuales.map((v) => v.empleado_id), ...manuales.map((m) => m.created_by)], { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
            findByIds<any>(d, "e_estructura_puesto", linkPuestos.map((l) => l.puesto_id), { codigo: true, nombre: true }),
            divisionPorContrato(d, manuales.map((m) => m.contrato_id)),
        ]);
        const pPor = agrupar(linkPuestos, "manual_puesto_id"), ePor = agrupar(linkEmpleados, "manual_puesto_id"), vPor = agrupar(visuales, "manual_puesto_id");
        const porId = new Map(manuales.map((m) => [Number(m.id), m]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const m = porId.get(id)!;
            const u = ubic({ empresa: m.empresa_id, cliente: m.cliente_id, division: m.division_id, contrato: m.contrato_id, corpo: m.corpo_id, puesto: m.puesto_id });
            const vis = vPor.get(id) ?? [];
            const vistos = new Set(vis.map((v) => Number(v.empleado_id)));
            const creador = empleados.get(Number(m.created_by));
            return armarRegistro(
                {
                    manual: m,
                    puestos: (pPor.get(id) ?? []).map((l) => puestoTxt(puestos.get(Number(l.puesto_id)))),
                    empleados: (ePor.get(id) ?? []).map((l) => empleadoTxt(empleados.get(Number(l.empleado_id)))),
                    visualizaciones: [
                        ...vis.map((v) => ({ empleado: empleadoTxt(empleados.get(Number(v.empleado_id))) ?? txt(v.nombre_empleado), visto: true, firmado: !!txt(v.firma_empleado_manual), approved: v.approved ?? null })),
                        // Igual que el consolidado: cada empleado vinculado que aún no tiene visualización sale como «No visto».
                        ...(ePor.get(id) ?? []).filter((l) => !vistos.has(Number(l.empleado_id))).map((l) => ({ empleado: empleadoTxt(empleados.get(Number(l.empleado_id))), visto: false, firmado: false, approved: null })),
                    ],
                    creadoPor: empleadoGuion(creador),
                    puestoPrincipal: u.puesto,
                },
                { ...u, division: u.division ?? divisiones.get(Number(m.contrato_id)) ?? null },
                firmas,
            );
        });
    },
};
