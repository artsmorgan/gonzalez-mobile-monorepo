import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";

/**
 * Evaluación de personal (`c_evaluacion_empleado`) como formulario. No hay generador individual: el formato sale de la pantalla móvil
 * (`StaffEvaluationsScreen`) y del bloque «Detalles» del consolidado. Tres formatos según `tipo`:
 *  - «Seguridad» y «Aseo & limpieza»: una sola sección «Evaluación principal» con 10 preguntas calificadas de 1 a 10 (puntaje mínimo 70).
 *  - «Otros»: plantilla por competencias; cada pregunta se califica con la lista de la pantalla (0 «No aplica» … 4 «Supera estándar») y
 *    «Retroalimentación» y «Comentarios» son respuestas de texto.
 * Las preguntas se entregan como las guardó el registro (`evaluacion`: `[{ title, minimum_score, questions: [{ title, answear }] }]`), por
 * lista: `evaluacion` (Seguridad y Aseo) u `objetivos`, `competencias_genericas`, `competencias_especificas`, `competencias_gerenciales`
 * y `formacion` (Otros). Las imágenes de las preguntas nunca se entregan.
 *
 * Firmas: la del evaluador y la del funcionario por QR son digitales (base64 de `sesión:empleado:latitud:longitud:ms`): ese texto no sale
 * (lleva sesión y ubicación), solo se dice que existen y cuándo se firmó. La firma manual del funcionario sí es una imagen.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esImagen = (s: string) => s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)/.test(s) || /^[A-Za-z0-9+/=\s]{400,}$/.test(s);
const texto = (v: unknown): string | null => { const s = txt(v); return s && !esImagen(s) ? s : null; };
const imagenFirma = (v: unknown): string | null => {
    const s = txt(v);
    if (!s || !esImagen(s)) return null;
    return s.startsWith("data:image/") ? s : `data:image/png;base64,${s.replace(/\s+/g, "")}`;
};
/** «código - nombre» (solo el nombre si no hay código). */
const conCodigo = (codigo: unknown, nombre: unknown): string | null => {
    const c = txt(codigo), n = txt(nombre);
    if (!c) return n;
    if (!n || n === c || n.startsWith(`${c} - `)) return c;
    return `${c} - ${n}`;
};

/** Firma digital de la app: solo el empleado y la hora (hora de Costa Rica, UTC-6 sin cambio de horario). */
export function firmaDigital(raw: unknown): { empleadoId: number; cuando: string | null } | null {
    const s = String(raw ?? "").trim();
    if (!s || esImagen(s)) return null;
    let partes: string[];
    try { partes = Buffer.from(s, "base64").toString("utf8").split(":"); } catch { return null; }
    if (partes.length !== 5) return null;
    const empleadoId = Number(partes[1]);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) return null;
    const ms = Number(partes[4]);
    return { empleadoId, cuando: Number.isFinite(ms) && ms > 0 ? new Date(ms - 6 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : null };
}

/** El tipo se guarda libre («Seguridad», «Aseo & limpieza», «Otros», a veces con otra mayúscula o con «y»). */
export function varianteDe(tipo: unknown): string | null {
    const t = norm(tipo);
    if (t.startsWith("seg")) return "Seguridad";
    if (t.startsWith("aseo")) return "Aseo & limpieza";
    if (t.startsWith("otro")) return "Otros";
    return txt(tipo);
}

/** Calificación de las preguntas de «Otros» (lista de la pantalla). */
const NIVELES_OTROS = ["No aplica", "No cumple", "Requiere mejorar", "Cumple", "Supera estándar"];

type Pregunta = { title?: unknown; answear?: unknown };
type Sec = { title?: unknown; minimum_score?: unknown; questions?: Pregunta[] };
/** `[{ title, questions }]` o `{ questions }` (a veces doblemente codificado). */
function leerSecciones(raw: unknown): Sec[] {
    let v: any = raw;
    for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return []; } }
    if (v && !Array.isArray(v) && Array.isArray(v.questions)) return [{ title: "Preguntas", questions: v.questions }];
    return Array.isArray(v) ? v.filter((s) => s && typeof s === "object") : [];
}

/** Lista del registro a la que va cada sección de «Otros» (por el título, con el orden de la plantilla como respaldo). */
const LISTAS_OTROS = ["objetivos", "competencias_genericas", "competencias_especificas", "competencias_gerenciales", "formacion", "retroalimentacion", "comentarios"];
function listaDeSeccion(titulo: unknown, indice: number): string | null {
    const t = norm(titulo);
    if (t.startsWith("objetivos")) return "objetivos";
    if (t.startsWith("competencias genericas")) return "competencias_genericas";
    if (t.startsWith("competencias especificas")) return "competencias_especificas";
    if (t.startsWith("competencias gerenciales")) return "competencias_gerenciales";
    if (t.startsWith("formacion")) return "formacion";
    if (t.startsWith("retroalimentacion")) return "retroalimentacion";
    if (t.startsWith("comentarios")) return "comentarios";
    return LISTAS_OTROS[indice] ?? null;
}

export type EvaluacionFormExtra = { empleados?: Map<number, { codigo?: string | null; nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }>; division?: string | null };

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, x: EvaluacionFormExtra = {}): FormRecord {
    const creado = fmtDt(raw.created_at);
    const variante = varianteDe(raw.tipo);
    const otros = variante === "Otros";
    const secciones = leerSecciones(raw.evaluacion);
    const listas: FormRecord["listas"] = {};
    const valores: FormRecord["valores"] = {};
    const calificar = (a: unknown): string | null => {
        const s = txt(a);
        if (s === null) return null;
        if (!otros) return s; // estrellas 1 a 10: se imprime el número
        const n = Number(s);
        return Number.isInteger(n) && n >= 0 && n < NIVELES_OTROS.length ? NIVELES_OTROS[n]! : s;
    };
    secciones.forEach((sec, i) => {
        const preguntas = (Array.isArray(sec.questions) ? sec.questions : []).filter((q) => q && typeof q === "object");
        if (!otros) {
            (listas.evaluacion ??= []).push(...preguntas.map((q) => ({ item: texto(q.title), valor: calificar(q.answear), observacion: null })));
            valores.puntaje_minimo ??= Number.isFinite(Number(sec.minimum_score)) && sec.minimum_score !== null && sec.minimum_score !== "" ? Number(sec.minimum_score) : null;
            return;
        }
        const lista = listaDeSeccion(sec.title, i);
        if (lista === "retroalimentacion") preguntas.forEach((q, j) => { valores[`retroalimentacion_${j + 1}`] = texto(q.answear); });
        else if (lista === "comentarios") preguntas.forEach((q, j) => { valores[`comentarios_${j + 1}`] = texto(q.answear); });
        else if (lista) (listas[lista] ??= []).push(...preguntas.map((q) => ({ item: texto(q.title), valor: calificar(q.answear), observacion: null })));
    });
    const persona = (id: unknown) => { const e = x.empleados?.get(Number(id)); return e ? { codigo: e.codigo, nombre: buildNombre(e) } : null; };
    const colaborador = persona(raw.empleado_id), evaluador = persona(raw.evaluador_id);
    const comentarios = txt(raw.comentarios);
    Object.assign(valores, {
        nombre_colaborador: conCodigo(colaborador?.codigo, raw.nombre_empleado),
        cedula_colaborador: txt(raw.cedula_empleado),
        fecha_ingreso: dia(raw.fecha_ingreso),
        fecha_evaluacion: dia(raw.fecha_evaluacion),
        comentarios_generales: comentarios === "-" ? null : comentarios, // la pantalla guarda «-» cuando no se escribió nada
        nombre_evaluador: conCodigo(evaluador?.codigo, raw.nombre_evaluador),
    });

    const imagenes: Record<string, string> = {};
    const manual = imagenFirma(raw.firma_empleado_manual);
    if (manual) imagenes.firma_empleado_manual = manual;
    const firmasMap: Record<string, string | null> = Object.fromEntries(Object.entries(imagenes).map(([k, v]) => [k, firmas ? v : null]));
    const presentes = Object.keys(imagenes);
    const texto_firma = (d: { empleadoId: number; cuando: string | null }) => {
        const e = x.empleados?.get(d.empleadoId);
        const quien = e ? buildNombre(e) : "";
        return `Firmada digitalmente${quien ? ` por ${quien}` : ""}${d.cuando ? ` el ${d.cuando}` : ""}`;
    };
    for (const [clave, campo] of [["firma_evaluador", "firma_evaluador_digital"], ["firma_empleado", "firma_empleado_digital"]] as const) {
        const d = firmaDigital(raw[clave]);
        if (!d) { valores[campo] = null; continue; }
        valores[campo] = texto_firma(d);
        firmasMap[clave] = null; // digital: no hay imagen que dibujar
        presentes.push(clave);
    }
    return {
        id: Number(raw.id), variante, creado,
        estructura: { ...ubic, division: ubic.division ?? txt(x.division) },
        valores, listas, firmas: firmasMap, firmasPresentes: presentes,
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const evaluacionPersonalForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_evaluacion_empleado.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ub = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(db as any, rows.map(ub));
        // Código y nombre del colaborador y del evaluador (y de quien firmó) en una sola consulta.
        const empleados = await findByIds<any>(db as any, "c_empleado", rows.flatMap((r) => [r.empleado_id, r.evaluador_id, firmaDigital(r.firma_evaluador)?.empleadoId, firmaDigital(r.firma_empleado)?.empleadoId]), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        // La división del contrato solo se busca para las evaluaciones que no guardaron la suya.
        const divisiones = await divisionPorContrato(db as any, rows.filter((r) => !ubic(ub(r)).division).map((r) => r.contrato_id));
        return rows.map((r) => armarRegistro(r, ubic(ub(r)), firmas, { empleados, division: divisiones.get(Number(r.contrato_id)) ?? null }));
    },
};
