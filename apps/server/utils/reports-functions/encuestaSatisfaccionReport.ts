/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type EncuestaSatisfaccionModuleFilters = ActaEntregaModuleFilters & {
    responsableIds?: number[] | null;
};

export type EncuestaSatisfaccionOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeEncuestaSatisfaccionFilters(raw: unknown): EncuestaSatisfaccionModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const rids = toValidIds(o.responsableIds);
    if (!rids.length) return { ...base };
    return { ...base, responsableIds: rids };
}

export function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureForExcel(dataUriOrBase64: string | null | undefined): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/\s+/g, "") };
}

export function hasEncuestaSatisfaccionListModuleFiltersContent(f: EncuestaSatisfaccionModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.responsableIds?.length) return true;
    return false;
}

export function filtersMatchEncuestaSatisfaccionListQuery(
    parsedRowFilters: any,
    listModuleFilters?: EncuestaSatisfaccionModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeEncuestaSatisfaccionFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.responsableIds ?? undefined, saved.responsableIds ?? undefined)) return false;
    return true;
}

function likertLabel5(v: number, globalSection: boolean): string {
    if (!globalSection) {
        switch (v) {
            case 1:
                return "Muy malo";
            case 2:
                return "Malo";
            case 3:
                return "Regular";
            case 4:
                return "Bueno";
            case 5:
                return "Muy bueno";
            default:
                return "No aplica";
        }
    }
    switch (v) {
        case 1:
            return "Mucho menos de lo esperado";
        case 2:
            return "Menos de lo esperado";
        case 3:
            return "Tal como lo esperaba";
        case 4:
            return "Más de lo esperado";
        case 5:
            return "Mucho más de lo esperado";
        default:
            return "No sabe/No aplica";
    }
}

function isGlobalSectionTitle(title: string): boolean {
    return String(title || "").toUpperCase().includes("APRECIACIONES GLOBALES");
}

/** Alineado con SatisfactionSurveysScreen: apply ausente = true (pregunta aplica). */
function coerceQuestionApply(raw: unknown): boolean {
    if (raw === undefined || raw === null) return true;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (s === "false" || s === "0") return false;
        if (s === "true" || s === "1") return true;
    }
    return Boolean(raw);
}

function coerceKnowProcess(raw: unknown): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "sí" || s === "si") return true;
        if (s === "false" || s === "0") return false;
    }
    return false;
}

export type ParsedEncuestaEvaluaciones =
    | { kind: "form"; form: Record<string, unknown>[]; know_process: boolean }
    | { kind: "legacy"; items: Record<string, unknown>[] }
    | { kind: "raw"; text: string };

/** JSON en DB: `{ form: [...], know_process }` o legado `[{ question, value|result }]`. Soporta doble codificación. */
export function parseEncuestaEvaluacionesJson(raw: string | null | undefined): ParsedEncuestaEvaluaciones {
    if (!raw || !String(raw).trim()) return { kind: "raw", text: "" };
    let parsed: unknown;
    try {
        parsed = JSON.parse(String(raw));
    } catch {
        return { kind: "raw", text: String(raw) };
    }
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return { kind: "raw", text: String(parsed) };
        }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (first && typeof first === "object" && "question" in first && !("section_title" in first)) {
            return { kind: "legacy", items: parsed as Record<string, unknown>[] };
        }
        return { kind: "raw", text: JSON.stringify(parsed) };
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as Record<string, unknown>).form)) {
        const o = parsed as Record<string, unknown>;
        return {
            kind: "form",
            form: o.form as Record<string, unknown>[],
            know_process: coerceKnowProcess(o.know_process),
        };
    }
    return { kind: "raw", text: typeof parsed === "string" ? parsed : JSON.stringify(parsed) };
}

function formatEvaluacionesForDetailCell(raw: string | null | undefined): string {
    if (!raw || !String(raw).trim()) return "";
    const decoded = parseEncuestaEvaluacionesJson(raw);
    const lines: string[] = [];
    if (decoded.kind === "legacy") {
        for (const item of decoded.items) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            const q = String(row.question ?? "").trim();
            const v = row.result ?? row.value ?? "";
            lines.push(q ? `${q}: ${String(v)}` : String(v));
        }
        return lines.join("\n");
    }
    if (decoded.kind === "form") {
        for (const sec of decoded.form) {
            if (!sec || typeof sec !== "object") continue;
            const secObj = sec as Record<string, unknown>;
            const title = String(secObj.section_title ?? "").trim();
            const globalSec = isGlobalSectionTitle(title);
            if (title) lines.push(`=== ${title} ===`);
            const questions = Array.isArray(secObj.questions) ? secObj.questions : [];
            for (const q of questions) {
                if (!q || typeof q !== "object") continue;
                const qRow = q as Record<string, unknown>;
                const qt = String(qRow.question ?? "").trim();
                const apply = coerceQuestionApply(qRow.apply);
                const val = apply && Number.isFinite(Number(qRow.value)) ? Number(qRow.value) : 0;
                const label = likertLabel5(val, globalSec);
                lines.push(`${qt}: ${apply ? label : "No aplica"}`);
            }
            const secObs = String(secObj.observations ?? "").trim();
            if (secObs) lines.push(`Observaciones sección: ${secObs}`);
            lines.push("");
        }
        lines.push(`¿Conoce el procedimiento de atención de quejas?: ${decoded.know_process ? "Sí" : "No"}`);
        return lines.join("\n").trim();
    }
    return decoded.text;
}

function titleForDivisionNombre(divisionNombre: string): string {
    const n = String(divisionNombre || "").toLowerCase();
    if (n.includes("seguridad")) {
        return "ENCUESTA DE LA EVALUACIÓN DE LA SATISFACCIÓN DEL CLIENTE SEGURIDAD";
    }
    return "ENCUESTA DE LA EVALUACIÓN DE LA SATISFACCIÓN DEL CLIENTE ASEO Y LIMPIEZA";
}

async function resolveLogoPathByEmpresaId(empresaId: number): Promise<string | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const p = path.resolve(process.cwd(), "app", "logo-images", logoName);
    try {
        await fs.access(p);
        return p;
    } catch {
        return null;
    }
}

/** Lee ancho/alto del IHDR de un PNG (sin dependencias extra). */
async function readPngPixelSize(logoPath: string): Promise<{ w: number; h: number } | null> {
    try {
        const buf = await fs.readFile(logoPath);
        if (buf.length < 24) return null;
        if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 16384 || h > 16384) return null;
        return { w, h };
    } catch {
        return null;
    }
}

/** Escala el logo para caber en el rectángulo manteniendo proporción (no deformar). */
function fitImagePreservingAspect(natW: number, natH: number, boxW: number, boxH: number): { w: number; h: number } {
    if (natW <= 0 || natH <= 0 || boxW <= 1 || boxH <= 1) return { w: 48, h: 24 };
    const scale = Math.min(boxW / natW, boxH / natH, 1);
    return { w: Math.max(1, Math.round(natW * scale)), h: Math.max(1, Math.round(natH * scale)) };
}

/** Aproxima píxeles del área A:B según anchos de columna (unidades Excel) y alto de fila en puntos. */
function approxLogoBoxPixels(colAWidth: number, colBWidth: number, rowHeightPt: number): { w: number; h: number } {
    const sumChars = colAWidth + colBWidth;
    const widthPx = Math.floor(sumChars * 6.5 + 6);
    const heightPx = Math.floor(rowHeightPt * (96 / 72) - 12);
    return { w: Math.max(48, widthPx), h: Math.max(28, heightPx) };
}

export async function queryEncuestaSatisfaccionRows(
    prisma: PrismaClient,
    filters: EncuestaSatisfaccionModuleFilters,
    orderKey: EncuestaSatisfaccionOrderKey,
) {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.responsableIds?.length) where.responsable_id = { in: filters.responsableIds };

    const rows = await prisma.c_encuesta_cliente.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds, responsableIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
        ids(rows.map((x: any) => x.responsable_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos, responsables] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } })
            : [],
        puestoIds.length
            ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        responsableIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: responsableIds } },
                  select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
              })
            : [],
    ]);
    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));
    const responsableById = new Map(responsables.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const resp = responsableById.get(Number(r.responsable_id));
        const respNombre = resp
            ? [resp.nombre, resp.primer_apellido, resp.segundo_apellido].filter(Boolean).join(" ").trim() || String(resp.codigo)
            : String(r.responsable_id);
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            responsable_nombre: respNombre,
            fecha_txt: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            created_at_txt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
            firma_evaluado_data_uri: normalizeSignatureDataUri(r.firma_evaluado),
            evaluaciones_resumen: formatEvaluacionesForDetailCell(r.evaluaciones),
        };
    });

    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "empresa_id":
                return a.empresa_nombre.localeCompare(b.empresa_nombre, "es");
            case "cliente_id":
                return a.cliente_nombre.localeCompare(b.cliente_nombre, "es");
            case "division_id":
                return a.division_nombre.localeCompare(b.division_nombre, "es");
            case "contrato_id":
                return a.contrato_nombre.localeCompare(b.contrato_nombre, "es");
            case "corpo_id":
                return a.corpo_nombre.localeCompare(b.corpo_nombre, "es");
            case "puesto_id":
                return a.puesto_nombre.localeCompare(b.puesto_nombre, "es");
            case "fecha":
            default:
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }
    });
}

function likertHeaders(global: boolean): string[] {
    if (global) {
        return [
            "Ítem",
            "Mucho menos",
            "Menos",
            "Tal como esperaba",
            "Más",
            "Mucho más",
            "N/A",
        ];
    }
    return ["Ítem", "Muy malo", "Malo", "Regular", "Bueno", "Muy bueno", "No sabe/N/A"];
}

/** Encabezados de cuadrícula como en el formato físico ESC-F-005 (Excel individual). */
function likertHeadersIndividualForm(global: boolean): string[] {
    if (global) {
        return [
            "Ítem a evaluar",
            "Mucho menos de lo esperado",
            "Menos de lo esperado",
            "Tal como lo esperaba",
            "Más de lo esperado",
            "Mucho más de lo esperado",
            "No sabe/No aplica",
        ];
    }
    return ["Ítem a evaluar", "Muy Malo", "Malo", "Regular", "Bueno", "Muy Bueno", "No sabe/No aplica"];
}

const INDIVIDUAL_COMMITMENT_PARAGRAPH =
    "Nuestra empresa está comprometida con una mejora permanente de nuestra calidad, por ello nos es importante conocer la opinión de nuestros clientes sobre la calidad de nuestros servicios. Su opinión nos permitirá mejorar y ofrecerle mejores servicios. Por ello, le agradecemos dedicar unos minutos para completar este cuestionario. Muchas gracias!!";
const INDIVIDUAL_LIKERT_INSTRUCTION_LINE = "Marque con (X) la opción que represente su opinión";

function questionLetter0(i: number): string {
    if (i >= 0 && i < 26) return String.fromCharCode(97 + i);
    return String(i + 1);
}

const individualGridBodyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;

/** Fila Likert del Excel individual: col A = letra; B = ítem; C–G = calificación 1–5; H = N/A. */
function markIndividualLikertRow(
    ws: ExcelJS.Worksheet,
    rowIdx: number,
    letter: string,
    question: string,
    value: number,
    apply: boolean,
    border: Partial<ExcelJS.Borders>,
) {
    const effective = apply && value >= 1 && value <= 5 ? value : 0;
    const a = ws.getCell(rowIdx, 1);
    a.value = letter;
    a.font = { bold: true, size: 10 };
    a.alignment = { horizontal: "center", vertical: "middle" };
    a.border = border;
    a.fill = individualGridBodyFill;
    const b = ws.getCell(rowIdx, 2);
    b.value = question;
    b.alignment = { wrapText: true, vertical: "middle" };
    b.border = border;
    b.fill = individualGridBodyFill;
    for (let col = 3; col <= 7; col++) {
        const cell = ws.getCell(rowIdx, col);
        cell.border = border;
        cell.fill = individualGridBodyFill;
        const rating = col - 2;
        cell.value = effective === rating ? "X" : "";
        cell.alignment = { horizontal: "center", vertical: "middle" };
    }
    const h = ws.getCell(rowIdx, 8);
    h.border = border;
    h.fill = individualGridBodyFill;
    h.value = effective === 0 ? "X" : "";
    h.alignment = { horizontal: "center", vertical: "middle" };
}

function markLikertRow(
    ws: ExcelJS.Worksheet,
    rowIdx: number,
    question: string,
    value: number,
    apply: boolean,
    _global: boolean,
    border: Partial<ExcelJS.Borders>,
    options?: { itemLetter?: string },
) {
    const effective = apply && value >= 1 && value <= 5 ? value : 0;
    const itemText = options?.itemLetter ? `${options.itemLetter}) ${question}` : question;
    for (let c = 1; c <= 7; c++) {
        const cell = ws.getCell(rowIdx, c);
        cell.border = border;
        if (c === 1) {
            cell.value = itemText;
            cell.alignment = { wrapText: true, vertical: "middle" };
        } else if (c >= 2 && c <= 6) {
            const rating = c - 1;
            cell.value = effective === rating ? "X" : "";
            cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
            cell.value = effective === 0 ? "X" : "";
            cell.alignment = { horizontal: "center", vertical: "middle" };
        }
    }
}

/** Escribe `form` / `know_process` (y legado) en la hoja; devuelve la primera fila libre después del bloque. */
function appendStructuredSurveyForm(
    ws: ExcelJS.Worksheet,
    rowStart: number,
    evaluacionesRaw: string | null | undefined,
    border: Partial<ExcelJS.Borders>,
    hdrFill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } },
    maxCol: number,
): number {
    let rr = rowStart;
    const mergeWide = (r: number) => {
        ws.mergeCells(r, 1, r, maxCol);
    };
    const decoded = parseEncuestaEvaluacionesJson(evaluacionesRaw ?? null);

    if (decoded.kind === "raw" && !String(decoded.text || "").trim()) {
        mergeWide(rr);
        ws.getCell(rr, 1).value = "—";
        ws.getCell(rr, 1).border = border;
        return rr + 2;
    }
    if (decoded.kind === "raw") {
        mergeWide(rr);
        ws.getCell(rr, 1).value = decoded.text;
        ws.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
        ws.getCell(rr, 1).border = border;
        return rr + 2;
    }

    if (decoded.kind === "legacy") {
        mergeWide(rr);
        ws.getCell(rr, 1).value = "Evaluación (formato anterior)";
        ws.getCell(rr, 1).font = { bold: true };
        ws.getCell(rr, 1).fill = hdrFill;
        ws.getCell(rr, 1).border = border;
        rr += 1;
        for (const item of decoded.items) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            mergeWide(rr);
            ws.getCell(rr, 1).value = `${String(row.question ?? "").trim()}: ${String(row.result ?? row.value ?? "—")}`;
            ws.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
            ws.getCell(rr, 1).border = border;
            rr += 1;
        }
        return rr + 1;
    }

    for (const sec of decoded.form) {
        if (!sec || typeof sec !== "object") continue;
        const secObj = sec as Record<string, unknown>;
        const title = String(secObj.section_title ?? "").trim();
        const globalSec = isGlobalSectionTitle(title);
        mergeWide(rr);
        ws.getCell(rr, 1).value = title || "Sección";
        ws.getCell(rr, 1).font = { bold: true };
        ws.getCell(rr, 1).fill = hdrFill;
        ws.getCell(rr, 1).border = border;
        ws.getCell(rr, 1).alignment = { vertical: "middle", wrapText: true };
        for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = border;
        rr += 1;
        const hdr = likertHeaders(globalSec);
        const hr = ws.getRow(rr);
        for (let i = 0; i < hdr.length; i++) {
            const c = hr.getCell(i + 1);
            c.value = hdr[i];
            c.font = { bold: true };
            c.fill = hdrFill;
            c.border = border;
            c.alignment = { horizontal: "center", wrapText: true };
        }
        rr += 1;
        const questions = Array.isArray(secObj.questions) ? secObj.questions : [];
        for (const q of questions) {
            if (!q || typeof q !== "object") continue;
            const qRow = q as Record<string, unknown>;
            const qt = String(qRow.question ?? "").trim();
            const apply = coerceQuestionApply(qRow.apply);
            let val = Number(qRow.value);
            if (!Number.isFinite(val)) val = apply ? 5 : 0;
            if (val < 0) val = 0;
            if (val > 5) val = 5;
            if (!apply) val = 0;
            else if (val < 1) val = 1;
            markLikertRow(ws, rr, qt, val, apply, globalSec, border);
            rr += 1;
        }
        const secObs = String(secObj.observations ?? "").trim();
        if (secObs) {
            mergeWide(rr);
            ws.getCell(rr, 1).value = `Observaciones de la sección: ${secObs}`;
            ws.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
            ws.getCell(rr, 1).border = border;
            rr += 1;
        }
        rr += 1;
    }
    mergeWide(rr);
    ws.getCell(rr, 1).value = `¿Conoce el procedimiento de atención de quejas de la compañía? ${decoded.know_process ? "Sí" : "No"}`;
    ws.getCell(rr, 1).border = border;
    rr += 1;
    return rr + 1;
}

const individualTableHdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } } as const;

const thinBlack = { argb: "FF333333" } as const;
const borderSideThin: ExcelJS.Border = { style: "thin", color: thinBlack };
/** Solo laterales (sin superior ni inferior), p. ej. bloques de observaciones y know_process. */
const borderMergedLR: Partial<ExcelJS.Borders> = {
    left: borderSideThin,
    right: borderSideThin,
};
/** Celda A de cabecera de tabla: sin gris y sin borde superior (junto a «Ítem a evaluar»). */
const borderHeaderCellA: Partial<ExcelJS.Borders> = {
    left: borderSideThin,
    right: borderSideThin,
    bottom: borderSideThin,
};

/** Título de sección: bordes laterales y superior; sin inferior (no toca el borde superior de la cuadrícula). */
const borderSectionTitleNoBottom: Partial<ExcelJS.Borders> = {
    top: borderSideThin,
    left: borderSideThin,
    right: borderSideThin,
};

const outerDocumentBorderBlack: ExcelJS.Border = { style: "medium", color: { argb: "FF000000" } };

function patchCellBorder(ws: ExcelJS.Worksheet, row: number, col: number, partial: Partial<ExcelJS.Borders>) {
    const cell = ws.getCell(row, col);
    const prev = (cell.border || {}) as Partial<ExcelJS.Borders>;
    cell.border = { ...prev, ...partial } as ExcelJS.Borders;
}

/** Quita todos los bordes de las celdas en el rectángulo (p. ej. cabecera A2:H12 sin líneas interiores). */
function clearAllBordersInRange(ws: ExcelJS.Worksheet, topRow: number, leftCol: number, bottomRow: number, rightCol: number) {
    if (bottomRow < topRow || rightCol < leftCol) return;
    for (let r = topRow; r <= bottomRow; r++) {
        for (let c = leftCol; c <= rightCol; c++) {
            ws.getCell(r, c).border = {} as ExcelJS.Borders;
        }
    }
}

/** Borde negro exterior de un rectángulo (p. ej. todo el documento A1:H…). */
function applyRectangleOuterBorderBlack(ws: ExcelJS.Worksheet, topRow: number, leftCol: number, bottomRow: number, rightCol: number) {
    if (bottomRow < topRow || rightCol < leftCol) return;
    for (let c = leftCol; c <= rightCol; c++) {
        patchCellBorder(ws, topRow, c, { top: outerDocumentBorderBlack });
        patchCellBorder(ws, bottomRow, c, { bottom: outerDocumentBorderBlack });
    }
    for (let r = topRow; r <= bottomRow; r++) {
        patchCellBorder(ws, r, leftCol, { left: outerDocumentBorderBlack });
        patchCellBorder(ws, r, rightCol, { right: outerDocumentBorderBlack });
    }
}

/** Fondo blanco en el rectángulo sin sobrescribir celdas que ya tienen color (título, cabeceras de tabla, firma, etc.). */
function applyInteriorWhiteRespectingExistingFills(ws: ExcelJS.Worksheet, topRow: number, leftCol: number, bottomRow: number, rightCol: number) {
    const preserveArgb = new Set(["FF1F2A44", "FFE0E0E0", "FFD9EAF7"]);
    for (let row = topRow; row <= bottomRow; row++) {
        for (let col = leftCol; col <= rightCol; col++) {
            const cell = ws.getCell(row, col);
            const f = cell.fill as ExcelJS.FillPattern | undefined;
            if (f && f.type === "pattern") {
                const raw = (f as ExcelJS.FillPattern).fgColor?.argb;
                const argb = raw ? String(raw).toUpperCase() : "";
                if (argb && preserveArgb.has(argb)) continue;
                if (argb === "FFFFFFFF" || argb === "FFFFFF") continue;
                if (argb) continue;
            }
            cell.fill = individualGridBodyFill;
        }
    }
}
function appendIndividualFormToWorksheet(
    ws: ExcelJS.Worksheet,
    rowStart: number,
    evaluacionesRaw: string | null | undefined,
    border: Partial<ExcelJS.Borders>,
): number {
    const maxCol = 8;
    let rr = rowStart;
    const mergeWide = (r: number) => {
        ws.mergeCells(r, 1, r, maxCol);
    };
    const decoded = parseEncuestaEvaluacionesJson(evaluacionesRaw ?? null);

    if (decoded.kind === "raw" && !String(decoded.text || "").trim()) {
        mergeWide(rr);
        ws.getCell(rr, 1).value = "—";
        ws.getCell(rr, 1).border = border;
        return rr + 2;
    }
    if (decoded.kind === "raw") {
        mergeWide(rr);
        ws.getCell(rr, 1).value = decoded.text;
        ws.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
        ws.getCell(rr, 1).border = border;
        return rr + 2;
    }

    if (decoded.kind === "legacy") {
        mergeWide(rr);
        ws.getCell(rr, 1).value = "Evaluación (formato anterior)";
        ws.getCell(rr, 1).font = { bold: true };
        ws.getCell(rr, 1).fill = individualTableHdrFill;
        ws.getCell(rr, 1).border = border;
        rr += 1;
        for (const item of decoded.items) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            ws.getCell(rr, 1).border = border;
            ws.getCell(rr, 1).value = "";
            ws.mergeCells(rr, 2, rr, 8);
            const v = ws.getCell(rr, 2);
            v.value = `${String(row.question ?? "").trim()}: ${String(row.result ?? row.value ?? "—")}`;
            v.alignment = { wrapText: true, vertical: "top" };
            for (let c = 2; c <= 8; c++) ws.getCell(rr, c).border = border;
            rr += 1;
        }
        return rr + 1;
    }

    decoded.form.forEach((sec, sIdx) => {
        if (!sec || typeof sec !== "object") return;
        const secObj = sec as Record<string, unknown>;
        const title = String(secObj.section_title ?? "").trim();
        const globalSec = isGlobalSectionTitle(title);
        const sectionHeading = `${sIdx + 1}. ${title || "Sección"}`;
        if (sIdx === 0) {
            mergeWide(rr);
            const ins = ws.getCell(rr, 1);
            ins.value = INDIVIDUAL_LIKERT_INSTRUCTION_LINE;
            ins.font = { italic: true, size: 10 };
            ins.alignment = { vertical: "middle", wrapText: true, horizontal: "left" };
            for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = {} as ExcelJS.Borders;
            rr += 1;
        }
        mergeWide(rr);
        ws.getCell(rr, 1).value = sectionHeading;
        ws.getCell(rr, 1).font = { bold: true, size: 11 };
        ws.getCell(rr, 1).alignment = { vertical: "middle", wrapText: true };
        for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = borderSectionTitleNoBottom;
        rr += 1;

        const hdr = likertHeadersIndividualForm(globalSec);
        const ha = ws.getCell(rr, 1);
        ha.value = "";
        ha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        ha.border = borderHeaderCellA;
        for (let i = 0; i < hdr.length; i++) {
            const c = ws.getCell(rr, i + 2);
            c.value = hdr[i];
            c.font = { bold: true, size: 10 };
            c.fill = individualTableHdrFill;
            c.border = border;
            c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
        rr += 1;

        const questions = Array.isArray(secObj.questions) ? secObj.questions : [];
        questions.forEach((q, qIdx) => {
            if (!q || typeof q !== "object") return;
            const qRow = q as Record<string, unknown>;
            const qt = String(qRow.question ?? "").trim();
            const apply = coerceQuestionApply(qRow.apply);
            let val = Number(qRow.value);
            if (!Number.isFinite(val)) val = apply ? 5 : 0;
            if (val < 0) val = 0;
            if (val > 5) val = 5;
            if (!apply) val = 0;
            else if (val < 1) val = 1;
            markIndividualLikertRow(ws, rr, questionLetter0(qIdx), qt, val, apply, border);
            rr += 1;
        });

        mergeWide(rr);
        ws.getCell(rr, 1).value = "Si su respuesta fue Muy Malo, Malo y Regular, indique por qué:";
        ws.getCell(rr, 1).font = { italic: true, size: 10 };
        ws.getCell(rr, 1).alignment = { vertical: "middle", wrapText: true };
        for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = borderMergedLR;
        rr += 1;
        const secObs = String(secObj.observations ?? "").trim();
        mergeWide(rr);
        ws.getCell(rr, 1).value = secObs || " ";
        ws.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
        for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = borderMergedLR;
        ws.getRow(rr).height = secObs ? Math.min(120, 16 + Math.ceil(secObs.length / 90) * 14) : 36;
        rr += 1;
        rr += 1;
    });

    mergeWide(rr);
    const kp = decoded.know_process;
    ws.getCell(rr, 1).value = `¿Conoce el procedimiento de atención de quejas de la compañía?     Sí ( ${kp ? "X" : " "} )     No ( ${kp ? " " : "X"} )`;
    ws.getCell(rr, 1).font = { size: 11 };
    ws.getCell(rr, 1).alignment = { vertical: "middle", wrapText: true };
    for (let c = 1; c <= maxCol; c++) ws.getCell(rr, c).border = borderMergedLR;
    rr += 1;
    return rr + 1;
}

export async function buildEncuestaSatisfaccionExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Encuestas");
    const wsDet = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const anchorEvalById = new Map<number, number>();
    const anchorFirmaById = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    const maxCol = 8;
    for (const r of descRows) {
        const start = wsDet.rowCount + 1;
        wsDet.mergeCells(start, 1, start, maxCol);
        wsDet.getCell(start, 1).value = `Encuesta #${r.id} — ${r.cliente_nombre}`;
        wsDet.getCell(start, 1).font = { bold: true };
        wsDet.getCell(start, 1).fill = hdrFill;
        for (let c = 1; c <= maxCol; c++) wsDet.getCell(start, c).border = border;
        anchorEvalById.set(Number(r.id), start);
        const firmaHeaderRow = appendStructuredSurveyForm(wsDet, start + 1, r.evaluaciones, border, hdrFill, maxCol);
        wsDet.mergeCells(firmaHeaderRow, 1, firmaHeaderRow, maxCol);
        wsDet.getCell(firmaHeaderRow, 1).value = "Firma evaluado";
        wsDet.getCell(firmaHeaderRow, 1).font = { bold: true };
        wsDet.getCell(firmaHeaderRow, 1).fill = hdrFill;
        for (let c = 1; c <= maxCol; c++) wsDet.getCell(firmaHeaderRow, c).border = border;
        const firmaRow = firmaHeaderRow + 1;
        anchorFirmaById.set(Number(r.id), firmaRow);
        for (let c = 1; c <= maxCol; c++) wsDet.getCell(firmaRow, c).border = border;
        const sig = parseSignatureForExcel(r.firma_evaluado);
        if (sig) {
            const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
            wsDet.addImage(imgId, { tl: { col: 0.2, row: firmaRow - 0.95 }, ext: { width: 220, height: 80 } });
            wsDet.getRow(firmaRow).height = 72;
        }
        wsDet.addRow([]);
    }

    const headers = [
        "ID",
        "Creado en",
        "Fecha encuesta",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Responsable",
        "Nombre evaluado",
        "Evaluaciones",
        "Firma evaluado",
        "Observaciones",
    ];
    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = hdrFill;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 8, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 12, outlineLevel: 1 },
        { width: 24, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 20, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 20, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 36, outlineLevel: 1 },
    ];

    for (const r of rows) {
        const evRow = anchorEvalById.get(Number(r.id)) ?? 1;
        const fiRow = anchorFirmaById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id,
            r.created_at_txt,
            r.fecha_txt,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.responsable_nombre,
            r.nombre_evaluado ?? "",
            "",
            "",
            String(r.observaciones ?? "").slice(0, 5000),
        ]);
        row.getCell(12).value = { text: "Ver evaluaciones", hyperlink: `#'Detalles'!A${evRow}` };
        row.getCell(12).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(13).value = { text: "Ver firma", hyperlink: `#'Detalles'!A${fiRow}` };
        row.getCell(13).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    wsDet.columns = [
        { width: 28 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 10 },
    ];
    return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Anchos de columna del Excel individual (A estrecha, B más reducida, C–H amplias). */
const INDIVIDUAL_EXCEL_COL_A = 3.4;
const INDIVIDUAL_EXCEL_COL_B = 24;
const INDIVIDUAL_EXCEL_ROW1_HEIGHT_PT = 58;

function applyIndividualSheetColumnWidths(ws: ExcelJS.Worksheet) {
    ws.getColumn(1).width = INDIVIDUAL_EXCEL_COL_A;
    ws.getColumn(2).width = INDIVIDUAL_EXCEL_COL_B;
    for (let c = 3; c <= 6; c++) ws.getColumn(c).width = 13;
    ws.getColumn(7).width = 20;
    ws.getColumn(8).width = 22;
}

export async function buildEncuestaSatisfaccionExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
    const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } } as const;

    for (const r of rows) {
        const safeName = `Encuesta_${r.id}`.replace(/[^\w-]/g, "_").slice(0, 31);
        const ws = wb.addWorksheet(safeName);
        applyIndividualSheetColumnWidths(ws);
        const divisionNombre = String(r.division_nombre || "");
        const docTitle = titleForDivisionNombre(divisionNombre);
        const empresaInst = String(r.empresa_evaluado ?? "").trim() || String(r.cliente_nombre ?? "").trim() || "—";

        const documentName = String(reportName ?? "").trim() || `Encuesta ${r.id}`;

        ws.getRow(1).height = INDIVIDUAL_EXCEL_ROW1_HEIGHT_PT;
        const logoAreaFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
        ws.mergeCells(1, 1, 1, 2);
        for (let c = 1; c <= 2; c++) {
            ws.getCell(1, c).fill = logoAreaFill;
            ws.getCell(1, c).border = border;
        }
        ws.mergeCells(1, 3, 1, 6);
        const titleCell = ws.getCell(1, 3);
        titleCell.value = docTitle;
        titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        titleCell.fill = titleFill;
        for (let c = 3; c <= 6; c++) {
            ws.getCell(1, c).fill = titleFill;
            ws.getCell(1, c).border = border;
        }
        ws.mergeCells(1, 7, 1, 8);
        const docNameAreaFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
        const docNameCell = ws.getCell(1, 7);
        docNameCell.value = documentName;
        docNameCell.font = { bold: true, color: { argb: "FF1F2A44" }, size: 10 };
        docNameCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        docNameCell.fill = docNameAreaFill;
        for (let c = 7; c <= 8; c++) {
            ws.getCell(1, c).fill = docNameAreaFill;
            ws.getCell(1, c).border = border;
        }

        const logo = await resolveLogoPathByEmpresaId(Number(r.empresa_id || 0));
        if (logo) {
            const imgId = wb.addImage({ filename: logo, extension: "png" });
            const box = approxLogoBoxPixels(INDIVIDUAL_EXCEL_COL_A, INDIVIDUAL_EXCEL_COL_B, INDIVIDUAL_EXCEL_ROW1_HEIGHT_PT);
            const nat = await readPngPixelSize(logo);
            const ext = nat ? fitImagePreservingAspect(nat.w, nat.h, box.w, box.h) : { w: 52, h: 28 };
            ws.addImage(imgId, { tl: { col: 0.06, row: 0.1 }, ext: { width: ext.w, height: ext.h } });
        }

        ws.getRow(2).height = 4;
        const estimado = ws.getCell(3, 2);
        estimado.value = "Estimado cliente";
        estimado.font = { bold: true, size: 11 };
        estimado.alignment = { vertical: "middle", wrapText: true };
        estimado.border = border;

        ws.mergeCells(4, 2, 7, 8);
        const commitCell = ws.getCell(4, 2);
        commitCell.value = INDIVIDUAL_COMMITMENT_PARAGRAPH;
        commitCell.font = { size: 10 };
        commitCell.alignment = { vertical: "middle", wrapText: true, horizontal: "center" };
        for (let row = 4; row <= 7; row++) {
            for (let col = 2; col <= 8; col++) {
                ws.getCell(row, col).border = border;
            }
        }
        ws.getRow(4).height = 14;
        ws.getRow(5).height = 14;
        ws.getRow(6).height = 14;
        ws.getRow(7).height = 14;

        ws.getRow(8).height = 6;

        const nombreVal = String(r.nombre_evaluado ?? reportName ?? "").trim() || "—";
        const puestoVal = String(r.puesto_nombre ?? "").trim() || "—";
        const fechaVal = String(r.fecha_txt ?? "").trim() || "—";

        const labelCell = (row: number, col: number, text: string) => {
            const c = ws.getCell(row, col);
            c.value = text;
            c.font = { bold: true, size: 10 };
            c.alignment = { vertical: "middle", wrapText: true };
            c.border = border;
        };
        const valueMergeCD = (row: number, val: string) => {
            ws.mergeCells(row, 3, row, 4);
            const c = ws.getCell(row, 3);
            c.value = val;
            c.alignment = { vertical: "middle", wrapText: true };
            c.border = border;
            ws.getCell(row, 4).border = border;
        };

        labelCell(9, 2, "Nombre completo");
        valueMergeCD(9, nombreVal);
        ws.mergeCells(9, 5, 9, 6);
        const empLbl = ws.getCell(9, 5);
        empLbl.value = "Nombre de Empresa/Institución";
        empLbl.font = { bold: true, size: 10 };
        empLbl.alignment = { vertical: "middle", wrapText: true, horizontal: "center" };
        ws.mergeCells(9, 7, 9, 8);
        const empValGh = ws.getCell(9, 7);
        empValGh.value = empresaInst;
        empValGh.font = { size: 10 };
        empValGh.alignment = { vertical: "middle", wrapText: true, horizontal: "left" };

        labelCell(10, 2, "Puesto");
        valueMergeCD(10, puestoVal);

        labelCell(11, 2, "Fecha");
        valueMergeCD(11, fechaVal);

        ws.getRow(12).height = 6;

        clearAllBordersInRange(ws, 2, 1, 12, 8);

        let rr = 13;

        rr = appendIndividualFormToWorksheet(ws, rr, r.evaluaciones, border);

        ws.mergeCells(rr, 1, rr, 8);
        ws.getCell(rr, 1).value = "Agradecemos nos indique si existe algún punto de mejora a nuestro servicio:";
        ws.getCell(rr, 1).font = { bold: true, size: 11 };
        ws.getCell(rr, 1).alignment = { vertical: "middle", wrapText: true };
        ws.getCell(rr, 1).border = border;
        rr += 1;
        ws.mergeCells(rr, 1, rr, 8);
        const obsText = String(r.observaciones ?? "").trim() || " ";
        const obsCell = ws.getCell(rr, 1);
        obsCell.value = obsText;
        obsCell.alignment = { wrapText: true, vertical: "top" };
        obsCell.border = border;
        ws.getRow(rr).height = Math.max(72, Math.min(200, 40 + Math.ceil(obsText.length / 70) * 14));
        rr += 2;

        ws.mergeCells(rr, 1, rr, 8);
        ws.getCell(rr, 1).value = "Firma del evaluado";
        ws.getCell(rr, 1).font = { bold: true };
        ws.getCell(rr, 1).fill = hdrFill;
        ws.getCell(rr, 1).border = border;
        const sig = parseSignatureForExcel(r.firma_evaluado);
        if (sig) {
            const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
            ws.addImage(imgId, { tl: { col: 0.15, row: rr - 0.88 }, ext: { width: 260, height: 100 } });
            ws.getRow(rr).height = 108;
        } else {
            ws.getRow(rr).height = 36;
        }
        const documentBottomRow = rr;
        rr += 1;

        applyInteriorWhiteRespectingExistingFills(ws, 1, 1, documentBottomRow, 8);
        applyRectangleOuterBorderBlack(ws, 1, 1, documentBottomRow, 8);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
