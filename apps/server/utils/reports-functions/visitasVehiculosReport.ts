/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma } from "@prisma/client";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer } from "./imageDimensions";

export type VisitasVehiculosModuleFilters = ActaEntregaModuleFilters & {
    responsableIds?: number[] | null;
    cedulaVisitante?: string | null;
    tiposVehiculo?: string[] | null;
    placas?: string[] | null;
};

export type VisitasVehiculosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

const NAVY = "FF1F3864";
const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};
const HDR_FILL_CONSOLIDADO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const DOC_META_DEFAULT = "SEG-F-020, V1, 30/10/2015\nGerente de Operaciones en Seguridad";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

function parseStrings(v: unknown): string[] {
    if (Array.isArray(v)) {
        return [...new Set(v.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0))];
    }
    if (typeof v === "string" && v.trim() !== "") {
        return [...new Set(v.split(",").map((s) => s.trim()).filter((s) => s.length > 0))];
    }
    return [];
}

/** Interpreta `YYYY-MM-DD HH:mm:ss` como fecha/hora local (sin UTC). */
export function parseNaiveDateTime(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (m) {
        const sec = m[6] != null ? Number(m[6]) : 0;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), sec, 0);
    }
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function formatDt(d: Date | null | undefined): string {
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDateOnly(v: unknown): string {
    const d = v instanceof Date ? v : parseNaiveDateTime(String(v ?? ""));
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtTimeOnly(v: unknown): string {
    const d = v instanceof Date ? v : parseNaiveDateTime(String(v ?? ""));
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function excelWorksheetNameSafe(base: string, suffix: string, maxLen = 31): string {
    let name = `${base}${suffix}`.replace(/[\\/?*[\]:'"]/g, "_").trim();
    if (!name) name = "Hoja";
    return name.slice(0, maxLen);
}

function resolveCedulaFotoFilePath(registroId: number, fileName: string | null | undefined): string | null {
    const base = path.basename(String(fileName ?? "").trim());
    if (!base || base === "." || base === "..") return null;
    if (!Number.isFinite(registroId) || registroId <= 0) return null;
    return path.join(process.cwd(), "public", "uploads", "vehicles", String(registroId), base);
}

function excelImageExtForFileName(fileName: string): "png" | "jpeg" | "gif" {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".gif")) return "gif";
    return "jpeg";
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

export function normalizeVisitasVehiculosFilters(raw: unknown): VisitasVehiculosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const rids = toValidIds(o.responsableIds);
    const ced = o.cedulaVisitante != null ? String(o.cedulaVisitante).trim() : "";
    const tipos = parseStrings(o.tiposVehiculo);
    const placas = parseStrings(o.placas);
    const next: VisitasVehiculosModuleFilters = { ...base };
    if (rids.length) next.responsableIds = rids;
    if (ced) next.cedulaVisitante = ced;
    if (tipos.length) next.tiposVehiculo = tipos;
    if (placas.length) next.placas = placas;
    return next;
}

export function hasVisitasVehiculosListModuleFiltersContent(f: VisitasVehiculosModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.responsableIds?.length) return true;
    if (f.cedulaVisitante && String(f.cedulaVisitante).trim() !== "") return true;
    if (f.tiposVehiculo?.length) return true;
    if (f.placas?.length) return true;
    return false;
}

export function filtersMatchVisitasVehiculosListQuery(
    parsedRowFilters: any,
    listModuleFilters?: VisitasVehiculosModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeVisitasVehiculosFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (listModuleFilters.cedulaVisitante && String(saved.cedulaVisitante || "") !== String(listModuleFilters.cedulaVisitante))
        return false;
    const lt = listModuleFilters.tiposVehiculo ?? [];
    const st = saved.tiposVehiculo ?? [];
    if (lt.length) {
        if (!st.length) return false;
        const setS = new Set(st.map((x) => x.toLowerCase()));
        for (const t of lt) {
            if (!setS.has(t.toLowerCase())) return false;
        }
    }
    const lp = listModuleFilters.placas ?? [];
    const sp = saved.placas ?? [];
    if (lp.length) {
        if (!sp.length) return false;
        const setP = new Set(sp.map((x) => x.toLowerCase()));
        for (const p of lp) {
            if (!setP.has(p.toLowerCase())) return false;
        }
    }
    return true;
}

function orderByClause(key: VisitasVehiculosOrderKey): Prisma.e_registro_vehiculosOrderByWithRelationInput {
    switch (key) {
        case "cliente_id":
            return { cliente_id: "asc" };
        case "division_id":
            return { division_id: "asc" };
        case "contrato_id":
            return { contrato_id: "asc" };
        case "corpo_id":
            return { corpo_id: "asc" };
        case "puesto_id":
            return { puesto_id: "asc" };
        case "created_at":
            return { created_at: "asc" };
        case "empresa_id":
        default:
            return { empresa_id: "asc" };
    }
}

async function enrichRows(prisma: ReportDataAccess, raw: any[]): Promise<any[]> {
    const empIds = [...new Set(raw.map((r) => Number(r.empresa_id)).filter((n) => n > 0))];
    const divIds = [...new Set(raw.map((r) => Number(r.division_id)).filter((n) => n > 0))];
    const conIds = [...new Set(raw.map((r) => Number(r.contrato_id)).filter((n) => n > 0))];
    const [emps, divs, cons] = await Promise.all([
        empIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        divIds.length ? prisma.n_division.findMany({ where: { id: { in: divIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        conIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: conIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
    ]);
    const empMap = new Map(emps.map((e) => [e.id, e]));
    const divMap = new Map(divs.map((e) => [e.id, e]));
    const conMap = new Map(cons.map((e) => [e.id, e]));
    return raw.map((r) => {
        const empresa = empMap.get(r.empresa_id);
        const division = divMap.get(r.division_id);
        const contrato = conMap.get(r.contrato_id);
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            responsable_label: r.c_empleado
                ? [r.c_empleado.nombre, r.c_empleado.primer_apellido, r.c_empleado.segundo_apellido].filter(Boolean).join(" ").trim() ||
                  r.c_empleado.codigo
                : "",
            persona_lugar_visita: [r.persona_visita, r.departamento_visita].filter((x) => x != null && String(x).trim() !== "").join(" / "),
        };
    });
}

export async function queryVisitasVehiculosRows(
    prisma: ReportDataAccess,
    filters: VisitasVehiculosModuleFilters,
    orderKey: VisitasVehiculosOrderKey,
    opts?: { take?: number },
): Promise<any[]> {
    const where: Prisma.e_registro_vehiculosWhereInput = { isActive: true };
    const d0 = parseNaiveDateTime(filters.creadoDesde ?? null);
    const d1 = parseNaiveDateTime(filters.creadoHasta ?? null);
    if (d0 || d1) {
        where.created_at = {};
        if (d0) (where.created_at as any).gte = d0;
        if (d1) (where.created_at as any).lte = d1;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.responsableIds?.length) where.responsable_id = { in: filters.responsableIds };
    if (filters.cedulaVisitante && filters.cedulaVisitante.trim() !== "") {
        where.cedula = { contains: filters.cedulaVisitante.trim() };
    }
    if (filters.tiposVehiculo?.length) {
        where.tipo = { in: filters.tiposVehiculo };
    }
    if (filters.placas?.length) {
        const placaOr = filters.placas.map((p) => ({ placa: { contains: p } }));
        where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: placaOr }];
    }

    const raw = await prisma.e_registro_vehiculos.findMany({
        where,
        include: {
            c_empleado: { select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true } },
            e_estructura_cliente: { select: { id: true, nombre: true } },
            e_estructura_sucursal: { select: { id: true, nombre: true, nro_sucursal: true } },
            e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } },
        },
        orderBy: [orderByClause(orderKey), { id: "asc" }],
        take: opts?.take != null && opts.take > 0 ? opts.take : undefined,
    });

    const enriched = await enrichRows(prisma, raw);
    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "empresa_id":
                return a.empresa_nombre.localeCompare(b.empresa_nombre, "es");
            case "cliente_id":
                return (a.e_estructura_cliente?.nombre ?? "").localeCompare(b.e_estructura_cliente?.nombre ?? "", "es");
            case "division_id":
                return a.division_nombre.localeCompare(b.division_nombre, "es");
            case "contrato_id":
                return a.contrato_nombre.localeCompare(b.contrato_nombre, "es");
            case "corpo_id":
                return (a.e_estructura_sucursal?.nombre ?? "").localeCompare(b.e_estructura_sucursal?.nombre ?? "", "es");
            case "puesto_id":
                return (a.e_estructura_puesto?.nombre ?? "").localeCompare(b.e_estructura_puesto?.nombre ?? "", "es");
            case "created_at":
            default:
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
}

export async function buildVisitasVehiculosExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Visitas vehículos");
    const wsCed = wb.addWorksheet("Cédulas");
    const anchorById = new Map<number, number>();

    const sortedForCed = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of sortedForCed) {
        const rid = Number(r.id);
        const tieneFoto = String(r.file_name ?? "").trim() !== "";
        if (!tieneFoto) continue;

        const start = wsCed.rowCount + 1;
        anchorById.set(rid, start);
        wsCed.mergeCells(start, 1, start, 4);
        wsCed.getCell(start, 1).value = `Registro #${rid} | ${excelCellString(r.placa)} | ${excelCellString(r.nombre)}`;
        wsCed.getCell(start, 1).font = { bold: true };
        wsCed.getCell(start, 1).fill = HDR_FILL_CONSOLIDADO;
        for (let c = 1; c <= 4; c++) wsCed.getCell(start, c).border = BORDER;

        const hdr = wsCed.addRow(["ID", "Placa", "Visitante", "Cédula (imagen)"]);
        hdr.font = { bold: true };
        hdr.eachCell((cell) => {
            cell.border = BORDER;
            cell.fill = HDR_FILL_CONSOLIDADO;
            cell.alignment = { vertical: "middle", wrapText: true };
        });

        const rowImg = wsCed.addRow([rid, excelCellString(r.placa), excelCellString(r.nombre), ""]);
        wsCed.mergeCells(rowImg.number, 4, rowImg.number, 4);
        for (let c = 1; c <= 4; c++) {
            rowImg.getCell(c).border = BORDER;
            rowImg.getCell(c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        }

        const cedPath = resolveCedulaFotoFilePath(rid, r.file_name);
        if (cedPath) {
            try {
                const imgBuf = await fs.readFile(cedPath);
                const ext = excelImageExtForFileName(path.basename(cedPath));
                const natural = getImageDimensionsFromBuffer(imgBuf);
                const BOX_W = 180;
                const BOX_H = 110;
                const nw = natural?.width ?? BOX_W;
                const nh = natural?.height ?? BOX_H;
                const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
                const imgId = wb.addImage({ buffer: imgBuf as any, extension: ext });
                wsCed.addImage(imgId, {
                    tl: { col: 3.06, row: rowImg.number - 1 + 0.08 },
                    ext: { width: drawW, height: drawH },
                    editAs: "oneCell",
                } as any);
                rowImg.height = Math.min(130, Math.max(48, Math.round(drawH * 1.1 + 12)));
            } catch {
                rowImg.getCell(4).value = "(imagen no encontrada)";
            }
        } else {
            rowImg.getCell(4).value = "(sin archivo)";
        }
        wsCed.addRow([]);
    }

    const mainHeaders = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Tipo",
        "Placa",
        "Visitante",
        "Cédula",
        "Ver cédula",
        "Hora entrada",
        "Hora salida",
        "Motivo visita",
        "Persona / lugar visita",
        "Responsable",
        "Creado en",
    ];
    const cedulaLinkCol = 12;

    const h = wsMain.addRow(mainHeaders);
    h.font = { bold: true };
    h.eachCell((cell) => {
        cell.fill = HDR_FILL_CONSOLIDADO;
        cell.border = BORDER;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: mainHeaders.length },
    };
    wsMain.columns = [8, 22, 22, 18, 22, 22, 20, 14, 12, 24, 14, 14, 16, 16, 28, 28, 26, 18].map((w) => ({ width: w }));

    for (const r of rows) {
        const rid = Number(r.id);
        const anchor = anchorById.get(rid);
        const row = wsMain.addRow([
            rid,
            excelCellString(r.empresa_nombre),
            excelCellString(r.e_estructura_cliente?.nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.e_estructura_sucursal?.nombre),
            excelCellString(r.e_estructura_puesto?.nombre),
            excelCellString(r.tipo),
            excelCellString(r.placa),
            excelCellString(r.nombre),
            excelCellString(r.cedula),
            "",
            formatDt(r.hora_entrada instanceof Date ? r.hora_entrada : new Date(r.hora_entrada)),
            r.hora_salida ? formatDt(r.hora_salida instanceof Date ? r.hora_salida : new Date(r.hora_salida)) : "",
            excelCellString(r.razon_visita),
            excelCellString(r.persona_lugar_visita),
            excelCellString(r.responsable_label),
            formatDt(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
        ]);
        row.eachCell((cell) => {
            cell.border = BORDER;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        const linkCell = row.getCell(cedulaLinkCol);
        if (anchor && String(r.file_name ?? "").trim() !== "") {
            linkCell.value = { text: "Ver cédula", hyperlink: `#'Cédulas'!A${anchor}` };
            linkCell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsCed.columns = [10, 14, 26, 40].map((w) => ({ width: w }));
    return Buffer.from(await wb.xlsx.writeBuffer());
}

async function fillControlVehiculosSheet(
    ws: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    rowsForDate: any[],
    reportNombre: string,
    fechaHoja: string,
): Promise<void> {
    const first = rowsForDate[0] ?? {};
    const empId = Number(first?.empresa_id ?? 0);
    const logoPath = await resolveLogoPathByEmpresaId(empId);

    ws.views = [{ showGridLines: false }];
    ws.columns = [{ width: 14 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 26 }, { width: 30 }];

    ws.getRow(1).height = 72;
    for (let r = 2; r <= 5; r++) ws.getRow(r).height = 18;

    ws.mergeCells("B1:E1");
    const titleCell = ws.getCell("B1");
    titleCell.value = "Control de ingreso y salida de visitas y vehículos institucionales";
    titleCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    for (let c = 2; c <= 5; c++) ws.getCell(1, c).border = BORDER;

    const metaText = String(reportNombre ?? "").trim() || DOC_META_DEFAULT;
    const f1 = ws.getCell("F1");
    f1.value = metaText;
    f1.font = { size: 9 };
    f1.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    f1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    f1.border = BORDER;

    const a1 = ws.getCell("A1");
    a1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    a1.border = BORDER;
    a1.alignment = { horizontal: "center", vertical: "middle" };

    if (logoPath) {
        try {
            const buf = await fs.readFile(logoPath);
            const lower = logoPath.toLowerCase();
            const ext: "png" | "jpeg" = lower.endsWith(".png") ? "png" : "jpeg";
            const natural = getImageDimensionsFromBuffer(buf);
            const BOX_W = 78;
            const BOX_H = 58;
            const nw = natural?.width ?? BOX_W;
            const nh = natural?.height ?? BOX_H;
            const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
            const imgId = wb.addImage({ buffer: buf as any, extension: ext });
            ws.addImage(imgId, {
                tl: { col: 0.05, row: 0.06 },
                ext: { width: drawW, height: drawH },
                editAs: "oneCell",
            } as any);
        } catch {
            /* sin logo */
        }
    }

    for (let row = 2; row <= 5; row++) {
        for (let col = 1; col <= 6; col++) {
            ws.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
    }

    const bottomOnly: Partial<ExcelJS.Borders> = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    ws.getCell("A3").value = "Cliente:";
    ws.getCell("A3").font = { size: 11 };
    ws.mergeCells("B3:F3");
    ws.getCell("B3").value = excelCellString(first?.e_estructura_cliente?.nombre);
    for (let c = 2; c <= 6; c++) ws.getCell(3, c).border = bottomOnly as ExcelJS.Borders;

    ws.getCell("A4").value = "Puesto N°:";
    ws.getCell("A4").font = { size: 11 };
    ws.mergeCells("B4:C4");
    const puestoLabel = first?.e_estructura_puesto?.codigo
        ? `${first.e_estructura_puesto.codigo} — ${first.e_estructura_puesto.nombre}`
        : first?.e_estructura_puesto?.nombre;
    ws.getCell("B4").value = excelCellString(puestoLabel);
    ws.getCell("B4").border = bottomOnly as ExcelJS.Borders;
    ws.getCell("C4").border = bottomOnly as ExcelJS.Borders;

    ws.getCell("D4").value = "Fecha:";
    ws.getCell("D4").font = { size: 11 };
    ws.mergeCells("E4:F4");
    ws.getCell("E4").value = fechaHoja;
    ws.getCell("E4").border = bottomOnly as ExcelJS.Borders;
    ws.getCell("F4").border = bottomOnly as ExcelJS.Borders;

    const hdr = ["Placa", "Nombre de Visitante", "Hora entrada", "Hora Salida", "Nombre del Oficial", "Persona o Lugar que visita"];
    for (let c = 1; c <= 6; c++) {
        const cell = ws.getCell(6, c);
        cell.value = hdr[c - 1];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = BORDER;
    }

    let rowPtr = 7;
    const sorted = [...rowsForDate].sort((a, b) => {
        const ta = new Date(a.hora_entrada).getTime();
        const tb = new Date(b.hora_entrada).getTime();
        return ta - tb;
    });
    for (const r of sorted) {
        const vals = [
            excelCellString(r.placa),
            excelCellString(r.nombre),
            fmtTimeOnly(r.hora_entrada),
            fmtTimeOnly(r.hora_salida),
            excelCellString(r.responsable_label),
            excelCellString(r.persona_lugar_visita || r.razon_visita),
        ];
        for (let c = 1; c <= 6; c++) {
            const cell = ws.getCell(rowPtr, c);
            cell.value = vals[c - 1];
            cell.border = BORDER;
            cell.alignment = { vertical: "top", wrapText: true };
        }
        rowPtr += 1;
    }
    for (let i = sorted.length; i < 11; i++) {
        for (let c = 1; c <= 6; c++) ws.getCell(rowPtr, c).border = BORDER;
        rowPtr += 1;
    }

    const thickBlue: ExcelJS.Border = { style: "medium", color: { argb: NAVY } };
    const lastRow = rowPtr - 1;
    for (let rr = 1; rr <= lastRow; rr++) {
        ws.getCell(rr, 1).border = { ...(ws.getCell(rr, 1).border || {}), left: thickBlue };
        ws.getCell(rr, 6).border = { ...(ws.getCell(rr, 6).border || {}), right: thickBlue };
    }
    for (let c = 1; c <= 6; c++) {
        ws.getCell(1, c).border = { ...(ws.getCell(1, c).border || {}), top: { style: "medium", color: { argb: "FF000000" } } };
        ws.getCell(lastRow, c).border = { ...(ws.getCell(lastRow, c).border || {}), bottom: { style: "medium", color: { argb: "FF000000" } } };
    }
}

async function buildVisitasVehiculosPuestoWorkbook(puestoId: number, rows: any[], reportNombre: string): Promise<Buffer> {
    const byDate = new Map<string, any[]>();
    for (const r of rows) {
        const dk = fmtDateOnly(r.hora_entrada);
        if (!dk) continue;
        const arr = byDate.get(dk) ?? [];
        arr.push(r);
        byDate.set(dk, arr);
    }

    const wb = new ExcelJS.Workbook();
    const dates = [...byDate.keys()].sort();
    if (!dates.length) {
        const ws0 = wb.addWorksheet("Vacío");
        ws0.getCell(1, 1).value = "Sin registros";
        return Buffer.from(await wb.xlsx.writeBuffer());
    }

    for (const dk of dates) {
        const list = byDate.get(dk) ?? [];
        const sheetName = excelWorksheetNameSafe(dk.replace(/-/g, ""), `_${puestoId}`, 31);
        const ws = wb.addWorksheet(sheetName);
        await fillControlVehiculosSheet(ws, wb, list, reportNombre, dk);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildVisitasVehiculosIndividualZip(rows: any[], reportNombre: string): Promise<Buffer> {
    const byPuesto = new Map<number, any[]>();
    for (const r of rows) {
        const pid = Number(r.puesto_id);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        const arr = byPuesto.get(pid) ?? [];
        arr.push(r);
        byPuesto.set(pid, arr);
    }

    const files: { name: string; buf: Buffer }[] = [];
    if (byPuesto.size === 0) {
        files.push({
            name: "Visitas_vehiculos_vacio.xlsx",
            buf: await buildVisitasVehiculosPuestoWorkbook(0, [], reportNombre),
        });
    } else {
        for (const [puestoId, list] of byPuesto.entries()) {
            const puestoCod = list[0]?.e_estructura_puesto?.codigo ?? String(puestoId);
            const safe = String(puestoCod).replace(/[/\\?%*:|"<>]/g, "_");
            const buf = await buildVisitasVehiculosPuestoWorkbook(puestoId, list, reportNombre);
            files.push({ name: `Visitas_vehiculos_Puesto_${safe}.xlsx`, buf });
        }
    }

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const archive = archiver("zip", { zlib: { level: 6 } });
        archive.on("error", reject);
        archive.on("data", (c: Buffer) => chunks.push(c));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        for (const f of files) archive.append(f.buf, { name: f.name });
        void archive.finalize();
    });
}
