/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer } from "./imageDimensions";

export type EvaluacionPersonalModuleFilters = ActaEntregaModuleFilters & {
    empleadoEvaluadoIds?: number[] | null;
    evaluadorIds?: number[] | null;
    /** "Seguridad" | "Aseo & limpieza" | "Otros" — omitir o "todos" = sin filtro. */
    tipoEvaluacion?: string | null;
};

export type EvaluacionPersonalOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

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

const TIPOS_EVAL = new Set(["Seguridad", "Aseo & limpieza", "Otros"]);

export function normalizeEvaluacionPersonalFilters(raw: unknown): EvaluacionPersonalModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const ee = toValidIds(o.empleadoEvaluadoIds);
    const evr = toValidIds(o.evaluadorIds);
    const tipoRaw = o.tipoEvaluacion != null ? String(o.tipoEvaluacion).trim() : "";
    const tipo = tipoRaw && tipoRaw !== "todos" && TIPOS_EVAL.has(tipoRaw) ? tipoRaw : null;
    return {
        ...base,
        ...(ee.length ? { empleadoEvaluadoIds: ee } : {}),
        ...(evr.length ? { evaluadorIds: evr } : {}),
        ...(tipo ? { tipoEvaluacion: tipo } : {}),
    };
}

export function hasEvaluacionPersonalListModuleFiltersContent(f: EvaluacionPersonalModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.empleadoEvaluadoIds?.length || f.evaluadorIds?.length) return true;
    if (f.tipoEvaluacion) return true;
    return false;
}

export function filtersMatchEvaluacionPersonalListQuery(parsedRowFilters: any, listModuleFilters?: EvaluacionPersonalModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeEvaluacionPersonalFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.empleadoEvaluadoIds ?? undefined, saved.empleadoEvaluadoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.evaluadorIds ?? undefined, saved.evaluadorIds ?? undefined)) return false;
    if (listModuleFilters.tipoEvaluacion && String(saved.tipoEvaluacion || "") !== String(listModuleFilters.tipoEvaluacion)) return false;
    return true;
}

function parseSignatureForExcel(dataUriOrBase64: string | null | undefined): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUriOrBase64 || String(dataUriOrBase64).trim() === "") return null;
    const s = String(dataUriOrBase64).trim();
    const d = s.startsWith("data:image/") ? s : `data:image/png;base64,${s}`;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/\s+/g, "") };
}

type StaffEvalQuestion = {
    title?: string;
    answear?: string;
    images?: unknown[];
    image?: string | null;
};
type StaffEvalSection = { title?: string; questions?: StaffEvalQuestion[] };

/** Soporta `[{ title, questions }]` o `{ questions: [...] }` (y doble JSON string). */
export function parseStaffEvaluacionSections(raw: string | null | undefined): StaffEvalSection[] {
    if (!raw || !String(raw).trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(String(raw));
    } catch {
        return [];
    }
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return [];
        }
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        if (Array.isArray(o.questions)) {
            return [{ title: "Preguntas", questions: o.questions as StaffEvalQuestion[] }];
        }
    }
    if (Array.isArray(parsed)) {
        return parsed.filter((x) => x && typeof x === "object") as StaffEvalSection[];
    }
    return [];
}

function safeImageBaseName(name: string): string | null {
    const b = path.basename(String(name || "").trim());
    if (!b || b.includes("..") || b.includes("/") || b.includes("\\")) return null;
    return b;
}

export async function queryEvaluacionEmpleadoRows(
    prisma: ReportDataAccess,
    filters: EvaluacionPersonalModuleFilters,
    orderKey: EvaluacionPersonalOrderKey,
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
    if (filters.empleadoEvaluadoIds?.length) where.empleado_id = { in: filters.empleadoEvaluadoIds };
    if (filters.evaluadorIds?.length) where.evaluador_id = { in: filters.evaluadorIds };
    if (filters.tipoEvaluacion) where.tipo = filters.tipoEvaluacion;

    const rows = await prisma.c_evaluacion_empleado.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds, empleadoIds, evaluadorIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
        ids(rows.map((x: any) => x.empleado_id)),
        ids(rows.map((x: any) => x.evaluador_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos, empleados, evaluadores] = await Promise.all([
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
        empleadoIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: empleadoIds } },
                  select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
              })
            : [],
        evaluadorIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: evaluadorIds } },
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
    const empleadoById = new Map(empleados.map((x) => [x.id, x]));
    const evaluadorById = new Map(evaluadores.map((x) => [x.id, x]));

    const fmtEmp = (e: (typeof empleados)[0] | undefined) =>
        e ? [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim() || String(e.codigo) : "";

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const empEv = empleadoById.get(Number(r.empleado_id));
        const eva = evaluadorById.get(Number(r.evaluador_id));
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            empleado_evaluado_txt: empEv ? `${fmtEmp(empEv)} (${empEv.codigo})` : String(r.nombre_empleado || r.empleado_id),
            evaluador_txt: eva ? `${fmtEmp(eva)} (${eva.codigo})` : String(r.nombre_evaluador || r.evaluador_id),
            created_at_txt: r.created_at instanceof Date ? r.created_at.toISOString().replace("T", " ").slice(0, 19) : String(r.created_at ?? ""),
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
            case "created_at":
            default:
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
}

function mergeWide(ws: ExcelJS.Worksheet, r: number, c1: number, c2: number) {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

/** Escribe bloque de evaluación + firma manual en hoja Detalles; devuelve { evalStartRow, firmaRow } (filas 1-based). */
async function appendEvaluacionPersonalDetailBlock(
    wb: ExcelJS.Workbook,
    wsDet: ExcelJS.Worksheet,
    r: any,
    border: Partial<ExcelJS.Borders>,
    hdrFill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } },
    maxCol: number,
): Promise<{ evalStartRow: number; firmaRow: number }> {
    const evalId = Number(r.id);
    const start = wsDet.rowCount + 1;
    mergeWide(wsDet, start, 1, maxCol);
    wsDet.getCell(start, 1).value = `Evaluación de personal #${evalId} — ${r.empleado_evaluado_txt}`;
    wsDet.getCell(start, 1).font = { bold: true, size: 11 };
    wsDet.getCell(start, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(start, c).border = border;
    const evalStartRow = start;

    let rr = start + 1;
    const sections = parseStaffEvaluacionSections(r.evaluacion);
    if (!sections.length) {
        mergeWide(wsDet, rr, 1, maxCol);
        wsDet.getCell(rr, 1).value = "— Sin datos de evaluación —";
        wsDet.getCell(rr, 1).border = border;
        rr += 1;
    } else {
        for (const sec of sections) {
            mergeWide(wsDet, rr, 1, maxCol);
            wsDet.getCell(rr, 1).value = String(sec.title || "Sección").trim() || "Sección";
            wsDet.getCell(rr, 1).font = { bold: true };
            wsDet.getCell(rr, 1).fill = hdrFill;
            for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
            rr += 1;
            const hdrRow = rr;
            wsDet.getCell(hdrRow, 1).value = "Pregunta";
            wsDet.getCell(hdrRow, 2).value = "Calificación (1–10)";
            wsDet.getCell(hdrRow, 1).font = { bold: true };
            wsDet.getCell(hdrRow, 2).font = { bold: true };
            wsDet.getCell(hdrRow, 1).fill = hdrFill;
            wsDet.getCell(hdrRow, 2).fill = hdrFill;
            for (let c = 1; c <= 2; c++) {
                wsDet.getCell(hdrRow, c).border = border;
                wsDet.getCell(hdrRow, c).alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
            }
            for (let c = 3; c <= maxCol; c++) {
                wsDet.getCell(hdrRow, c).border = border;
                wsDet.getCell(hdrRow, c).fill = hdrFill;
            }
            rr += 1;
            const questions = Array.isArray(sec.questions) ? sec.questions : [];
            for (const q of questions) {
                wsDet.getCell(rr, 1).value = String(q?.title ?? "").trim() || "—";
                wsDet.getCell(rr, 2).value = String(q?.answear ?? "").trim() || "—";
                wsDet.getCell(rr, 1).alignment = { wrapText: true, vertical: "top" };
                wsDet.getCell(rr, 2).alignment = { horizontal: "center", vertical: "middle" };
                wsDet.getCell(rr, 1).border = border;
                wsDet.getCell(rr, 2).border = border;
                for (let c = 3; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
                rr += 1;
                const imgs: string[] = [];
                if (Array.isArray(q?.images)) {
                    for (const im of q.images) {
                        const s = safeImageBaseName(String(im ?? ""));
                        if (s) imgs.push(s);
                    }
                } else if (q?.image) {
                    const s = safeImageBaseName(String(q.image));
                    if (s) imgs.push(s);
                }
                const imgDir = path.resolve(process.cwd(), "public", "uploads", "evaluations", String(evalId), "images");
                /** Caja máxima en píxeles (ext de ExcelJS): contain sin deformar. */
                const IMG_BOX_W = 280;
                const IMG_BOX_H = 100;
                for (const fileName of imgs) {
                    const abs = path.join(imgDir, fileName);
                    try {
                        const lower = fileName.toLowerCase();
                        const ext = lower.endsWith(".png") ? "png" : "jpeg";
                        const imgBuf = await fs.readFile(abs);
                        const natural = getImageDimensionsFromBuffer(imgBuf);
                        const nw = natural?.width ?? IMG_BOX_W;
                        const nh = natural?.height ?? Math.round(IMG_BOX_H * 0.65);
                        const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, IMG_BOX_W, IMG_BOX_H);
                        const imgId = wb.addImage({ filename: abs, extension: ext });
                        mergeWide(wsDet, rr, 1, maxCol);
                        wsDet.getRow(rr).height = Math.min(170, Math.max(48, Math.round(drawH * 1.08 + 10)));
                        wsDet.addImage(imgId, { tl: { col: 0.5, row: rr - 1 + 0.05 }, ext: { width: drawW, height: drawH } } as any);
                        for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
                        rr += 1;
                    } catch {
                        mergeWide(wsDet, rr, 1, maxCol);
                        wsDet.getCell(rr, 1).value = `(Imagen no encontrada: ${fileName})`;
                        wsDet.getCell(rr, 1).border = border;
                        rr += 1;
                    }
                }
            }
            rr += 1;
        }
    }

    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Firma empleado (manual)";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    rr += 1;
    const firmaRow = rr;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    const FIRMA_BOX_W = 240;
    const FIRMA_BOX_H = 90;
    const sig = parseSignatureForExcel(r.firma_empleado_manual);
    if (sig) {
        const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
        let drawW = FIRMA_BOX_W;
        let drawH = FIRMA_BOX_H;
        try {
            const sigBuf = Buffer.from(sig.base64, "base64");
            const natural = getImageDimensionsFromBuffer(sigBuf);
            if (natural && natural.width > 0 && natural.height > 0) {
                const fitted = fitImageExtInsideBox(natural.width, natural.height, FIRMA_BOX_W, FIRMA_BOX_H);
                drawW = fitted.width;
                drawH = fitted.height;
            }
        } catch {
            /* usar caja por defecto */
        }
        wsDet.addImage(imgId, { tl: { col: 0.3, row: rr - 1 + 0.02 }, ext: { width: drawW, height: drawH } } as any);
        wsDet.getRow(rr).height = Math.min(120, Math.max(52, Math.round(drawH * 1.05 + 8)));
    } else {
        wsDet.getCell(rr, 1).value = "—";
    }
    wsDet.addRow([]);
    return { evalStartRow, firmaRow };
}

export async function buildEvaluacionPersonalExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Evaluaciones");
    const wsDet = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
    const maxCol = 6;
    const anchorEvalById = new Map<number, number>();
    const anchorFirmaById = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));

    for (const r of descRows) {
        const { evalStartRow, firmaRow } = await appendEvaluacionPersonalDetailBlock(wb, wsDet, r, border, hdrFill, maxCol);
        anchorEvalById.set(Number(r.id), evalStartRow);
        anchorFirmaById.set(Number(r.id), firmaRow);
    }

    /** Cuadrícula jerárquica: Evaluación (nivel 0) → Sección (nivel 1, de `evaluacion`) → Pregunta (nivel 2, de `sec.questions`). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Evaluación",
        "Creado en",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Tipo",
        "Empleado evaluado",
        "Evaluador",
        "Ver evaluación",
        "Ver firma",
        "Comentarios",
        "Sección",
        "Pregunta",
        "Respuesta",
        "Imágenes (nombres)",
    ];
    const COL_VER_EVAL = 16;
    const COL_VER_FIRMA = 17;
    const COL_SECCION = 19;

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = hdrFill;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 12 },
        { width: 14 },
        { width: 8 },
        { width: 20 },
        { width: 12 },
        { width: 18 },
        { width: 24 },
        { width: 22 },
        { width: 20 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 14 },
        { width: 28 },
        { width: 28 },
        { width: 16 },
        { width: 16 },
        { width: 36 },
        { width: 24 },
        { width: 40 },
        { width: 30 },
        { width: 30 },
    ];

    const blank = (n: number) => Array.from({ length: n }, () => "");

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
        row.getCell(4).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(4).font = { bold: true };
    };

    const imagesJoined = (q: any): string => {
        const names: string[] = [];
        if (Array.isArray(q?.images)) {
            for (const im of q.images) {
                const s = String(im ?? "").trim();
                if (s && !s.startsWith("data:image/")) names.push(s);
            }
        } else if (q?.image && typeof q.image === "string" && !q.image.startsWith("data:image/")) {
            names.push(q.image.trim());
        }
        return names.join(", ");
    };

    let totalDataRows = 0;
    for (const r of rows) {
        const evRow = anchorEvalById.get(Number(r.id)) ?? 1;
        const fiRow = anchorFirmaById.get(Number(r.id)) ?? 1;
        const general = [
            String(r.id),
            r.created_at_txt,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.tipo,
            r.empleado_evaluado_txt,
            r.evaluador_txt,
        ];

        const rootRow = wsMain.addRow([
            String(r.id),
            "",
            0,
            "Evaluación",
            ...general,
            "Ver evaluación",
            "Ver firma",
            String(r.comentarios ?? "").slice(0, 5000),
            ...blank(4),
        ]);
        rootRow.getCell(COL_VER_EVAL).value = { text: "Ver evaluación", hyperlink: `#'Detalles'!A${evRow}` };
        rootRow.getCell(COL_VER_EVAL).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(COL_VER_FIRMA).value = { text: "Ver firma", hyperlink: `#'Detalles'!A${fiRow}` };
        rootRow.getCell(COL_VER_FIRMA).font = { color: { argb: "FF0563C1" }, underline: true };
        styleDataRow(rootRow, 0);
        totalDataRows += 1;

        const sections = parseStaffEvaluacionSections(r.evaluacion);
        sections.forEach((sec, secIdx) => {
            const secTitle = String(sec.title ?? "").trim() || `Sección ${secIdx + 1}`;
            const secId = `${r.id}.s${secIdx + 1}`;
            const secRow = wsMain.addRow([
                secId,
                String(r.id),
                1,
                "Sección",
                ...general,
                ...blank(3),
                secTitle,
                "",
                "",
                "",
            ]);
            styleDataRow(secRow, 1);
            totalDataRows += 1;

            const questions = Array.isArray(sec.questions) ? sec.questions : [];
            questions.forEach((q, qIdx) => {
                const row = wsMain.addRow([
                    `${secId}.q${qIdx + 1}`,
                    secId,
                    2,
                    "Pregunta",
                    ...general,
                    ...blank(3),
                    "",
                    String(q?.title ?? ""),
                    String(q?.answear ?? ""),
                    imagesJoined(q),
                ]);
                styleDataRow(row, 2);
                totalDataRows += 1;
            });
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, totalDataRows + 1), column: headers.length } };
    for (let c = 1; c <= maxCol; c++) wsDet.getColumn(c).width = c <= 2 ? 40 : 12;
    return Buffer.from(await wb.xlsx.writeBuffer());
}
