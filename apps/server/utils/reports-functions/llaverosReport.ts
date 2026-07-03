/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import archiver from "archiver";
import { PassThrough } from "stream";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type LlaverosModuleFilters = ActaEntregaModuleFilters & {
    entregadoPorContains?: string | null;
    recibidoPorContains?: string | null;
};

export type LlaverosOrderKey = "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id" | "puesto_id" | "created_at";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function normText(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s ? s : null;
}

function excelCellString(v: unknown, max = 32767): string {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) : s;
}

function normalizeSignatureDataUri(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureDataForExcel(dataUriOrBase64: unknown): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        return { extension: m[1].toLowerCase() === "png" ? "png" : "jpeg", base64: String(m[2]).replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/^data:image\/\w+;base64,/, "").replace(/\s+/g, "") };
}

function fmtDate(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function fmtTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function parseIds(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
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

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
    try {
        const buf = await fs.readFile(filePath);
        if (
            buf.length >= 24 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
        ) {
            const width = buf.readUInt32BE(16);
            const height = buf.readUInt32BE(20);
            if (width > 0 && height > 0) return { width, height };
        }
        if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
            let i = 2;
            while (i + 9 < buf.length) {
                if (buf[i] !== 0xff) {
                    i += 1;
                    continue;
                }
                const marker = buf[i + 1];
                const isSof =
                    marker === 0xc0 ||
                    marker === 0xc1 ||
                    marker === 0xc2 ||
                    marker === 0xc3 ||
                    marker === 0xc5 ||
                    marker === 0xc6 ||
                    marker === 0xc7 ||
                    marker === 0xc9 ||
                    marker === 0xca ||
                    marker === 0xcb ||
                    marker === 0xcd ||
                    marker === 0xce ||
                    marker === 0xcf;
                if (isSof) {
                    const height = buf.readUInt16BE(i + 5);
                    const width = buf.readUInt16BE(i + 7);
                    if (width > 0 && height > 0) return { width, height };
                    break;
                }
                const len = buf.readUInt16BE(i + 2);
                if (!Number.isFinite(len) || len < 2) break;
                i += 2 + len;
            }
        }
        return null;
    } catch {
        return null;
    }
}

export function normalizeLlaverosFilters(raw: unknown): LlaverosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
        ...base,
        entregadoPorContains: normText(o.entregadoPorContains),
        recibidoPorContains: normText(o.recibidoPorContains),
    };
}

export function hasLlaverosListModuleFiltersContent(f: LlaverosModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.entregadoPorContains || f.recibidoPorContains) return true;
    return false;
}

export function filtersMatchLlaverosListQuery(parsedRowFilters: any, listModuleFilters?: LlaverosModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeLlaverosFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (listModuleFilters.entregadoPorContains && String(saved.entregadoPorContains || "") !== String(listModuleFilters.entregadoPorContains)) return false;
    if (listModuleFilters.recibidoPorContains && String(saved.recibidoPorContains || "") !== String(listModuleFilters.recibidoPorContains)) return false;
    return true;
}

export async function queryLlaverosRows(prisma: ReportDataAccess, filters: LlaverosModuleFilters, orderKey: LlaverosOrderKey) {
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

    const movimientoWhere: any = {};
    if (filters.entregadoPorContains) movimientoWhere.nombre_persona_entrega = { contains: filters.entregadoPorContains };
    if (filters.recibidoPorContains) movimientoWhere.nombre_persona_recibe = { contains: filters.recibidoPorContains };
    if (Object.keys(movimientoWhere).length > 0) {
        where.e_movimiento_llavero = { some: movimientoWhere };
    }

    const rows = await prisma.e_llavero.findMany({
        where,
        include: {
            e_movimiento_llavero: { orderBy: { id: "desc" } },
            e_llave_en_llavero: {
                include: {
                    e_llave: true,
                },
            },
        },
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const empresaIds = parseIds(rows.map((x) => x.empresa_id));
    const clienteIds = parseIds(rows.map((x) => x.cliente_id));
    const divisionIds = parseIds(rows.map((x) => x.division_id));
    const contratoIds = parseIds(rows.map((x) => x.contrato_id));
    const corpoIds = parseIds(rows.map((x) => x.corpo_id));
    const puestoIds = parseIds(rows.map((x) => x.puesto_id));
    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } })
            : [],
        puestoIds.length ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
    ]);
    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const links = Array.isArray(r.e_llave_en_llavero) ? r.e_llave_en_llavero : [];
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            movimientos_count: Array.isArray(r.e_movimiento_llavero) ? r.e_movimiento_llavero.length : 0,
            llaves_vinculadas_count: links.filter((x: any) => x?.e_llave).length,
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

export async function buildLlaverosExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Llaveros");
    const wsMov = wb.addWorksheet("Movimientos");
    const wsDet = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const movAnchorByKey = new Map<number, number>();
    const detAnchorByKey = new Map<number, number>();

    const byIdDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));

    for (const r of byIdDesc) {
        const startMov = wsMov.rowCount + 1;
        movAnchorByKey.set(Number(r.id), startMov);
        wsMov.mergeCells(startMov, 1, startMov, 11);
        wsMov.getCell(startMov, 1).value = `Llavero #${r.id} | ${r.nombre_llavero || ""} | ${r.empresa_nombre || ""}`;
        wsMov.getCell(startMov, 1).font = { bold: true };
        wsMov.getCell(startMov, 1).fill = hdrFill;
        for (let c = 1; c <= 11; c++) wsMov.getCell(startMov, c).border = border;
        const h = wsMov.addRow([
            "ID movimiento",
            "Entrega",
            "Recibe",
            "Departamento",
            "Teléfono",
            "Fecha",
            "Hora",
            "Firma entrega",
            "Firma recibe",
            "Firma responsable",
            "Llavero ID",
        ]);
        h.font = { bold: true };
        h.eachCell((cell) => {
            cell.border = border;
            cell.fill = hdrFill;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
        const movs = Array.isArray(r.e_movimiento_llavero) ? r.e_movimiento_llavero : [];
        for (const m of movs) {
            const row = wsMov.addRow([
                String(m.id ?? ""),
                excelCellString(m.nombre_persona_entrega),
                excelCellString(m.nombre_persona_recibe),
                excelCellString(m.departamento),
                excelCellString(m.telefono),
                fmtDate(m.fecha),
                fmtTime(m.hora),
                "",
                "",
                "",
                String(r.id),
            ]);
            row.eachCell((cell) => (cell.border = border));
            row.height = 44;
            const sigEntrega = parseSignatureDataForExcel(m.firma_entrega);
            const sigRecibe = parseSignatureDataForExcel(m.firma_recibe);
            if (sigEntrega) {
                try {
                    const imgId = wb.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
                    wsMov.addImage(imgId, { tl: { col: 7 + 0.08, row: row.number - 1 + 0.06 }, ext: { width: 110, height: 36 }, editAs: "oneCell" });
                } catch {
                    wsMov.getCell(row.number, 8).value = "Inválida";
                }
            }
            if (sigRecibe) {
                try {
                    const imgId = wb.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
                    wsMov.addImage(imgId, { tl: { col: 8 + 0.08, row: row.number - 1 + 0.06 }, ext: { width: 110, height: 36 }, editAs: "oneCell" });
                } catch {
                    wsMov.getCell(row.number, 9).value = "Inválida";
                }
            }
            wsMov.getCell(row.number, 10).value = excelCellString(m.firma_responsable ?? "");
        }
        wsMov.addRow([]);
    }

    for (const r of byIdDesc) {
        const startDet = wsDet.rowCount + 1;
        detAnchorByKey.set(Number(r.id), startDet);
        wsDet.mergeCells(startDet, 1, startDet, 5);
        wsDet.getCell(startDet, 1).value = `Llavero #${r.id} | ${excelCellString(r.nombre_llavero)} | ${excelCellString(r.empresa_nombre)}`;
        wsDet.getCell(startDet, 1).font = { bold: true };
        wsDet.getCell(startDet, 1).fill = hdrFill;
        for (let c = 1; c <= 5; c++) wsDet.getCell(startDet, c).border = border;

        const hdr = wsDet.addRow(["ID llave", "N° llave", "Lugar abre", "Cant. copias", "Observaciones (llave)"]);
        hdr.font = { bold: true };
        hdr.eachCell((cell) => {
            cell.border = border;
            cell.fill = hdrFill;
            cell.alignment = { vertical: "middle", wrapText: true };
        });

        const links = Array.isArray(r.e_llave_en_llavero) ? r.e_llave_en_llavero : [];
        const llavesRows = links.map((x: any) => x?.e_llave).filter(Boolean);
        if (llavesRows.length === 0) {
            const er = wsDet.addRow(["— Sin llaves vinculadas —", "", "", "", ""]);
            er.getCell(1).border = border;
            er.getCell(1).alignment = { vertical: "top", wrapText: true };
        } else {
            for (const ll of llavesRows) {
                const dr = wsDet.addRow([
                    String(ll.id ?? ""),
                    excelCellString(ll.numero_llave),
                    excelCellString(ll.lugar_abre),
                    String(ll.cantidad_copias ?? ""),
                    excelCellString(ll.observaciones),
                ]);
                dr.eachCell((cell) => {
                    cell.border = border;
                    cell.alignment = { vertical: "top", wrapText: true };
                });
            }
        }
        wsDet.addRow([]);
    }

    const headers = [
        "ID",
        "N° llavero",
        "Nombre llavero",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Observaciones",
        "Creado",
        "Movimientos",
        "Llaves vinculadas",
    ];
    const hr = wsMain.addRow(headers);
    hr.font = { bold: true };
    hr.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { vertical: "middle", wrapText: true };
    });
    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
    };

    const linkMovCol = 12;
    const linkDetCol = 13;

    for (const r of rows) {
        const row = wsMain.addRow([
            String(r.id),
            excelCellString(r.numero_llavero),
            excelCellString(r.nombre_llavero),
            excelCellString(r.empresa_nombre),
            excelCellString(r.cliente_nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.corpo_nombre),
            excelCellString(r.puesto_nombre),
            excelCellString(r.observaciones),
            fmtDate(r.created_at),
            "Ver movimientos",
            Number(r.llaves_vinculadas_count) > 0 ? "Ver llaves" : "",
        ]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        const movRow = movAnchorByKey.get(Number(r.id));
        if (movRow) {
            const c = wsMain.getCell(row.number, linkMovCol);
            c.value = { text: "Ver movimientos", hyperlink: `#'Movimientos'!A${movRow}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        const detRow = detAnchorByKey.get(Number(r.id));
        if (detRow && Number(r.llaves_vinculadas_count) > 0) {
            const c = wsMain.getCell(row.number, linkDetCol);
            c.value = { text: "Ver llaves", hyperlink: `#'Detalles'!A${detRow}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsMain.columns = [8, 12, 22, 26, 22, 18, 22, 22, 22, 28, 14, 18, 16].map((w) => ({ width: w }));
    wsMov.columns = [12, 22, 22, 20, 16, 14, 12, 18, 18, 18, 10].map((w) => ({ width: w }));
    wsDet.columns = [10, 14, 28, 12, 40].map((w) => ({ width: w }));
    return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildLlaverosIndividualWorkbook(rows: any[], reportName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Registro llaveros");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF102D4E" } } as const;

    ws.columns = [4.5, 18, 24, 24, 28].map((w) => ({ width: w }));
    ws.getRow(1).height = 52;
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 24;
    ws.getRow(5).height = 22;

    ws.mergeCells("A1:B1");
    ws.mergeCells("C1:D1");
    ws.getCell("C1").value = "REGISTRO DE LLAVEROS";
    ws.getCell("C1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    ws.getCell("C1").fill = hdrFill;
    ws.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("E1").value = excelCellString(reportName || "SEG-F-021");
    ws.getCell("E1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getCell("E1").font = { size: 10 };
    ws.getCell("E1").border = border;

    const logo = await resolveLogoPathByEmpresaId(Number(rows[0]?.empresa_id || 0));
    if (logo) {
        try {
            const ext = path.extname(logo).toLowerCase() === ".png" ? "png" : "jpeg";
            const imgId = wb.addImage({ filename: logo, extension: ext as "png" | "jpeg" });
            const dims = await getImageDimensions(logo);
            const boxW = 105;
            const boxH = 45;
            const scale = dims ? Math.min(boxW / dims.width, boxH / dims.height) : 1;
            const width = dims ? Math.max(1, Math.round(dims.width * scale)) : boxW;
            const height = dims ? Math.max(1, Math.round(dims.height * scale)) : boxH;
            ws.addImage(imgId, { tl: { col: 0.15 + (boxW - width) / 2 / 64, row: 0.08 + (boxH - height) / 2 / 20 }, ext: { width, height }, editAs: "oneCell" });
        } catch {
            // ignore
        }
    }

    for (let r = 2; r <= 4; r += 1) {
        for (let c = 1; c <= 5; c += 1) {
            ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
    }

    ws.getCell("B2").value = "Cliente:";
    ws.getCell("B3").value = "Puesto:";
    ws.mergeCells("C2:D2");
    ws.mergeCells("C3:D3");
    ws.getCell("C2").value = excelCellString(rows[0]?.cliente_nombre ?? "");
    ws.getCell("C3").value = excelCellString(rows[0]?.puesto_nombre ?? "");
    for (let c = 1; c <= 5; c += 1) ws.getCell(1, c).border = border;
    for (let r = 2; r <= 4; r += 1) for (let c = 1; c <= 5; c += 1) ws.getCell(r, c).border = {};
    for (let c = 1; c <= 5; c += 1) {
        ws.getCell(2, c).border = { ...ws.getCell(2, c).border, top: { style: "thin" } };
        ws.getCell(4, c).border = { ...ws.getCell(4, c).border, bottom: { style: "thin" } };
    }
    for (let r = 2; r <= 4; r += 1) {
        ws.getCell(r, 1).border = { ...ws.getCell(r, 1).border, left: { style: "thin" } };
        ws.getCell(r, 5).border = { ...ws.getCell(r, 5).border, right: { style: "thin" } };
    }
    ws.getCell("A4").border = { left: { style: "thin" } };

    ws.getCell("B5").value = "N° llavero";
    ws.getCell("C5").value = "Nombre llavero";
    ws.getCell("D5").value = "";
    ws.getCell("E5").value = "Observaciones";
    ws.getCell("A5").value = "";
    ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getCell("A5").border = { left: { style: "thin" }, right: { style: "thin" } };
    ws.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    for (const col of ["B", "C", "D", "E"] as const) {
        const cell = ws.getCell(`${col}5`);
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.fill = hdrFill;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    }

    const firstDataRow = 6;
    let rowNum = firstDataRow;
    for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const rr = ws.getRow(rowNum++);
        rr.getCell(1).value = String(i + 1);
        rr.getCell(2).value = excelCellString(r.numero_llavero);
        rr.getCell(3).value = excelCellString(r.nombre_llavero);
        rr.getCell(4).value = "";
        rr.getCell(5).value = excelCellString(r.observaciones);
        rr.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    for (let i = rows.length; i < 12; i += 1) {
        const blank = ws.getRow(rowNum++);
        blank.getCell(1).value = String(i + 1);
        blank.eachCell((cell) => (cell.border = border));
    }

    const lastDataRow = rowNum - 1;
    for (let c = 2; c <= 5; c += 1) ws.getCell(5, c).border = border;
    for (let r = firstDataRow; r <= lastDataRow; r += 1) {
        for (let c = 2; c <= 5; c += 1) ws.getCell(r, c).border = border;
        ws.getCell(r, 1).border = {};
        ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    }

    for (const r of rows) {
        const movWs = wb.addWorksheet(`Movimiento llaveros ${String(r.id)}`.slice(0, 31));
        movWs.columns = [22, 26, 19, 19, 10, 11, 17, 11, 22, 17].map((w) => ({ width: w }));
        movWs.getRow(1).height = 52;
        movWs.getRow(2).height = 14;
        movWs.getRow(4).height = 26;

        movWs.mergeCells("A1:B1");
        movWs.mergeCells("C1:H1");
        movWs.mergeCells("I1:J1");
        movWs.getCell("C1").value = "MOVIMIENTO DE LLAVEROS";
        movWs.getCell("C1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        movWs.getCell("C1").fill = hdrFill;
        movWs.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
        movWs.getCell("I1").value = excelCellString(reportName || "SEG-F-030");
        movWs.getCell("I1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        movWs.getCell("I1").font = { size: 10 };
        movWs.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        movWs.getCell("I1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

        const blk = { style: "thin" as const, color: { argb: "FF000000" } };
        for (let c = 1; c <= 10; c += 1) {
            const cell = movWs.getCell(1, c);
            const b: Partial<ExcelJS.Borders> = { top: blk, bottom: blk };
            if (c === 1) b.left = blk;
            if (c === 10) b.right = blk;
            cell.border = b;
        }

        if (logo) {
            try {
                const ext = path.extname(logo).toLowerCase() === ".png" ? "png" : "jpeg";
                const imgId = wb.addImage({ filename: logo, extension: ext as "png" | "jpeg" });
                const dims = await getImageDimensions(logo);
                const boxW = 105;
                const boxH = 48;
                const scale = dims ? Math.min(boxW / dims.width, boxH / dims.height) : 1;
                const width = dims ? Math.max(1, Math.round(dims.width * scale)) : boxW;
                const height = dims ? Math.max(1, Math.round(dims.height * scale)) : boxH;
                const wchA = movWs.getColumn(1).width ?? 22;
                const wchB = movWs.getColumn(2).width ?? 26;
                const pxA = wchA * 7;
                const pxB = wchB * 7;
                const mergedPx = pxA + pxB;
                const leftPx = Math.max(0, (mergedPx - width) / 2);
                const tlCol = leftPx < pxA ? leftPx / pxA : 1 + (leftPx - pxA) / pxB;
                const rowHpt = movWs.getRow(1).height ?? 52;
                const rowHpx = (rowHpt * 96) / 72;
                const topPx = Math.max(0, (rowHpx - height) / 2);
                const tlRow = topPx / rowHpx;
                movWs.addImage(imgId, {
                    tl: { col: tlCol, row: tlRow },
                    ext: { width, height },
                    editAs: "oneCell",
                });
            } catch {
                // ignore
            }
        }

        movWs.mergeCells("A2:J2");
        movWs.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        movWs.getCell("A2").border = { left: blk, right: blk, top: blk };

        for (let rr = 2; rr <= 3; rr += 1) {
            for (let c = 1; c <= 10; c += 1) {
                movWs.getCell(rr, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            }
        }
        movWs.getCell("A3").value = "Cliente:";
        movWs.getCell("A3").font = { bold: true };
        movWs.mergeCells("B3:J3");
        movWs.getCell("B3").value = excelCellString(r.cliente_nombre);
        movWs.getCell("B3").alignment = { vertical: "middle", wrapText: true };

        const headers = [
            "Nombre del Oficial que entrega o recibe",
            "Nombre de la persona que entrega o recibe",
            "Departamento donde labora",
            "Teléfono",
            "Entrega",
            "Recibo",
            "Día",
            "Hora",
            "Firma de quien entrega",
            "Firma de quien recibe",
        ];
        const hdrRowNum = 4;
        for (let c = 1; c <= 10; c += 1) {
            const cell = movWs.getCell(hdrRowNum, c);
            cell.value = headers[c - 1];
            cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
            cell.fill = hdrFill;
            cell.border = border;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }

        const movs = Array.isArray(r.e_movimiento_llavero) ? r.e_movimiento_llavero : [];
        let movRowNum = 5;
        for (const m of movs) {
            const row = movWs.getRow(movRowNum++);
            row.height = 46;
            row.getCell(1).value = excelCellString(m.nombre_persona_entrega);
            row.getCell(2).value = excelCellString(m.nombre_persona_recibe);
            row.getCell(3).value = excelCellString(m.departamento);
            row.getCell(4).value = excelCellString(m.telefono);
            row.getCell(5).value = "";
            row.getCell(6).value = "";
            row.getCell(7).value = fmtDate(m.fecha);
            row.getCell(8).value = fmtTime(m.hora);
            for (let col = 1; col <= 10; col += 1) {
                const cell = row.getCell(col);
                cell.border = border;
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            }

            const sigEntrega = parseSignatureDataForExcel(m.firma_entrega);
            if (sigEntrega) {
                try {
                    const imgId = wb.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
                    movWs.addImage(imgId, { tl: { col: 8 + 0.08, row: row.number - 1 + 0.05 }, ext: { width: 112, height: 42 }, editAs: "oneCell" });
                } catch {
                    movWs.getCell(row.number, 9).value = "Inválida";
                }
            }
            const sigRecibe = parseSignatureDataForExcel(m.firma_recibe);
            if (sigRecibe) {
                try {
                    const imgId = wb.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
                    movWs.addImage(imgId, { tl: { col: 9 + 0.08, row: row.number - 1 + 0.05 }, ext: { width: 82, height: 42 }, editAs: "oneCell" });
                } catch {
                    movWs.getCell(row.number, 10).value = "Inválida";
                }
            }
        }

        for (let i = movs.length; i < 9; i += 1) {
            const row = movWs.getRow(movRowNum++);
            row.height = 28;
            for (let col = 1; col <= 10; col += 1) row.getCell(col).border = border;
        }

        const lastDataRow = movRowNum - 1;
        const outline = { style: "medium" as const, color: { argb: "FF000000" } };
        for (let rr = 1; rr <= lastDataRow; rr += 1) {
            for (let cc = 1; cc <= 10; cc += 1) {
                const cell = movWs.getCell(rr, cc);
                const b = { ...(cell.border || {}) } as Partial<ExcelJS.Borders>;
                if (rr === 1) b.top = outline;
                if (rr === lastDataRow) b.bottom = outline;
                if (cc === 1) b.left = outline;
                if (cc === 10) b.right = outline;
                cell.border = b;
            }
        }

        for (let c = 3; c <= 10; c += 1) movWs.getCell(3, c).border = {};
        movWs.getCell("A3").border = { left: outline, bottom: blk };
        movWs.getCell("B3").border = { bottom: blk };
        movWs.getCell("J3").border = { right: outline, bottom: blk };
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildLlaverosIndividualZip(rows: any[], reportName: string): Promise<Buffer> {
    const grouped = new Map<number, any[]>();
    for (const r of rows) {
        const corpoId = Number(r.corpo_id || 0);
        if (!grouped.has(corpoId)) grouped.set(corpoId, []);
        grouped.get(corpoId)!.push(r);
    }

    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve, reject) => {
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => stream.destroy(err));
    archive.pipe(stream);

    for (const [corpoId, list] of grouped.entries()) {
        const wb = await buildLlaverosIndividualWorkbook(list, reportName);
        archive.append(wb, { name: `Llaveros_Corpo_${corpoId}.xlsx` });
    }

    await archive.finalize();
    return await done;
}
