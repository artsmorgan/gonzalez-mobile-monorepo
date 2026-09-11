/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type DocumentosEntregadosModuleFilters = ActaEntregaModuleFilters & {
    tipoDocumento?: string | null;
};

export type DocumentosEntregadosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha"
    | "tipo_documento"
    | "nombre_oficial_entrega"
    | "nombre_oficial_recibe";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

export function normalizeDocumentosEntregadosFilters(raw: unknown): DocumentosEntregadosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const td = o.tipoDocumento != null && String(o.tipoDocumento).trim() !== "" ? String(o.tipoDocumento).trim() : null;
    return { ...base, tipoDocumento: td };
}

export function hasDocumentosEntregadosListModuleFiltersContent(f: DocumentosEntregadosModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta || f.tipoDocumento) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchDocumentosEntregadosListQuery(parsedRowFilters: any, listModuleFilters?: DocumentosEntregadosModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeDocumentosEntregadosFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if ((listModuleFilters.tipoDocumento ?? "") && String(saved.tipoDocumento ?? "") !== String(listModuleFilters.tipoDocumento ?? "")) return false;
    return true;
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

export async function queryDocumentosEntregadosRows(
    prisma: ReportDataAccess,
    filters: DocumentosEntregadosModuleFilters,
    orderKey: DocumentosEntregadosOrderKey
) {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = desde;
        if (hasta) where.fecha.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.tipoDocumento) where.tipo_documento = filters.tipoDocumento;

    const rows = await prisma.e_control_documento_entregado_cliente.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
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
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            fecha_txt: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            firma_representante_cliente_data_uri: normalizeSignatureDataUri(r.firma_representante_cliente),
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
            case "tipo_documento":
                return String(a.tipo_documento || "").localeCompare(String(b.tipo_documento || ""), "es");
            case "nombre_oficial_entrega":
                return String(a.nombre_oficial_entrega || "").localeCompare(String(b.nombre_oficial_entrega || ""), "es");
            case "nombre_oficial_recibe":
                return String(a.nombre_oficial_recibe || "").localeCompare(String(b.nombre_oficial_recibe || ""), "es");
            case "fecha":
            default:
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }
    });
}

export async function buildDocumentosEntregadosExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Documentos");
    const wsFirmas = wb.addWorksheet("Firmas");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const firmaAnchorById = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of descRows) {
        const start = wsFirmas.rowCount + 1;
        firmaAnchorById.set(Number(r.id), start);
        wsFirmas.mergeCells(start, 1, start, 4);
        wsFirmas.getCell(start, 1).value = `Registro #${r.id} - ${r.cliente_nombre}`;
        wsFirmas.getCell(start, 1).font = { bold: true };
        wsFirmas.getCell(start, 1).fill = hdrFill;
        for (let c = 1; c <= 4; c++) wsFirmas.getCell(start, c).border = border;
        const hr = wsFirmas.addRow(["Cliente", "Oficial entrega", "Oficial recibe", "Firma representante"]);
        hr.font = { bold: true };
        hr.eachCell((cell) => {
            cell.fill = hdrFill;
            cell.border = border;
        });
        const row = wsFirmas.addRow([r.cliente_nombre, r.nombre_oficial_entrega, r.nombre_oficial_recibe, ""]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
        const d = normalizeSignatureDataUri(r.firma_representante_cliente);
        if (d) {
            const b64 = d.replace(/^data:image\/\w+;base64,/, "");
            const imgId = wb.addImage({ base64: b64, extension: "png" });
            wsFirmas.addImage(imgId, { tl: { col: 3.15, row: row.number - 0.85 }, ext: { width: 130, height: 48 } });
            wsFirmas.getRow(row.number).height = 54;
        }
        wsFirmas.addRow([]);
    }

    const headers = [
        "ID",
        "Fecha",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Tipo documento",
        "Nombre oficial entrega",
        "Nombre oficial recibe",
        "Descripción",
        "Firma representante cliente",
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
        { width: 8, outlineLevel: 1 }, { width: 12, outlineLevel: 1 }, { width: 24, outlineLevel: 1 }, { width: 24, outlineLevel: 1 },
        { width: 20, outlineLevel: 1 }, { width: 22, outlineLevel: 1 }, { width: 22, outlineLevel: 1 }, { width: 20, outlineLevel: 1 },
        { width: 20, outlineLevel: 1 }, { width: 22, outlineLevel: 1 }, { width: 22, outlineLevel: 1 }, { width: 36, outlineLevel: 1 }, { width: 26, outlineLevel: 1 },
    ];
    for (const r of rows) {
        const anchor = firmaAnchorById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id, r.fecha_txt, r.empresa_nombre, r.cliente_nombre, r.division_nombre, r.contrato_nombre, r.corpo_nombre, r.puesto_nombre,
            r.tipo_documento, r.nombre_oficial_entrega, r.nombre_oficial_recibe, r.descripcion, "",
        ]);
        row.getCell(13).value = { text: "Ver firma", hyperlink: `#'Firmas'!A${anchor}` };
        row.getCell(13).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    wsFirmas.columns = [{ width: 26 }, { width: 26 }, { width: 26 }, { width: 28 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildDocumentosEntregadosExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const byCliente = new Map<number, any[]>();
    for (const r of rows) {
        const cid = Number(r.cliente_id || 0);
        const list = byCliente.get(cid) ?? [];
        list.push(r);
        byCliente.set(cid, list);
    }
    for (const [clienteId, docs] of byCliente) {
        const first = docs[0];
        const ws = wb.addWorksheet(`Cliente ${String(clienteId).slice(0, 22)}`);
        ws.columns = [{ width: 6 }, { width: 16 }, { width: 24 }, { width: 24 }, { width: 34 }, { width: 22 }, { width: 24 }];
        ws.getRow(1).height = 56;
        ws.mergeCells("A1:B1");
        ws.mergeCells("C1:F1");
        ws.getCell("C1").value = "Control de documentos entregados al cliente";
        ws.getCell("C1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
        ws.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell("C1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
        ws.getCell("G1").value = String(reportName || first?.nombre || "");
        ws.getCell("G1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        const logo = await resolveLogoPathByEmpresaId(Number(first?.empresa_id || 0));
        if (logo) {
            const imgId = wb.addImage({ filename: logo, extension: "png" });
            // Logo centrado en bloque A:B fila 1.
            ws.addImage(imgId, { tl: { col: 0.65, row: 0.08 }, ext: { width: 76, height: 50 } });
        }

        ws.mergeCells("A2:D4");
        ws.mergeCells("E2:G4");
        ws.getCell("A2").value = `Cliente: ${String(first?.cliente_nombre || "")}`;
        ws.getCell("E2").value = `Corpo: ${String(first?.corpo_nombre || "")}`;
        ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell("E2").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell("A2").font = { size: 12 };
        ws.getCell("E2").font = { size: 12 };

        const headers = [
            "#",
            "Fecha",
            "Nombre del Oficial que entrega",
            "Tipo de documento",
            "Descripción (Detalle fechas y # folio)",
            "Nombre representante del cliente que recibe documentos",
            "Firma del Representante del cliente",
        ];
        const headerRow = ws.getRow(5);
        for (let i = 0; i < headers.length; i++) {
            const c = ws.getCell(5, i + 1);
            c.value = headers[i];
            c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
            c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            c.border = {
                top: { style: "thin", color: { argb: "FF000000" } },
                left: { style: "thin", color: { argb: "FF000000" } },
                right: { style: "thin", color: { argb: "FF000000" } },
                bottom: { style: "thin", color: { argb: "FF000000" } },
            };
        }
        headerRow.height = 40;

        const minLines = 10;
        const rowsToRender = Math.max(minLines, docs.length);
        let rowIdx = 6;
        for (let idx = 0; idx < rowsToRender; idx++) {
            const d = docs[idx];
            ws.getCell(rowIdx, 1).value = d ? idx + 1 : "";
            ws.getCell(rowIdx, 2).value = d ? String(d.fecha_txt || "") : "";
            ws.getCell(rowIdx, 3).value = d ? String(d.nombre_oficial_entrega || "") : "";
            ws.getCell(rowIdx, 4).value = d ? String(d.tipo_documento || "") : "";
            ws.getCell(rowIdx, 5).value = d ? String(d.descripcion || "") : "";
            ws.getCell(rowIdx, 6).value = d ? String(d.nombre_oficial_recibe || "") : "";
            ws.getCell(rowIdx, 7).value = "";
            for (let c = 1; c <= 7; c++) {
                const cell = ws.getCell(rowIdx, c);
                cell.border = {
                    top: { style: "thin", color: { argb: "FF000000" } },
                    left: { style: "thin", color: { argb: "FF000000" } },
                    right: { style: "thin", color: { argb: "FF000000" } },
                    bottom: { style: "thin", color: { argb: "FF000000" } },
                };
                cell.alignment = { vertical: "middle", wrapText: true, horizontal: c === 1 ? "center" : "left" };
            }
            const firma = d ? normalizeSignatureDataUri(d.firma_representante_cliente) : null;
            if (d && firma) {
                const imgId = wb.addImage({ base64: firma.replace(/^data:image\/\w+;base64,/, ""), extension: "png" });
                ws.addImage(imgId, { tl: { col: 6.05, row: rowIdx - 0.9 }, ext: { width: 120, height: 44 } });
                ws.getRow(rowIdx).height = 52;
            }
            rowIdx += 1;
        }

        const lastFrameRow = rowIdx - 1;
        for (let rr = 1; rr <= lastFrameRow; rr++) {
            for (let cc = 1; cc <= 7; cc++) {
                const cell = ws.getCell(rr, cc);
                const b = cell.border || {};
                if (rr === 1) b.top = { style: "thin", color: { argb: "FF000000" } };
                if (rr === lastFrameRow) b.bottom = { style: "thin", color: { argb: "FF000000" } };
                if (cc === 1) b.left = { style: "thin", color: { argb: "FF000000" } };
                if (cc === 7) b.right = { style: "thin", color: { argb: "FF000000" } };
                cell.border = b;
            }
        }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}
