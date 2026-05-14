/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type VulnerabilidadModuleFilters = ActaEntregaModuleFilters;
export type VulnerabilidadOrderKey = "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id" | "puesto_id" | "fecha";

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

function parseDataUri(dataUri: string | null): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUri) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUri);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: String(dataUri).replace(/\s+/g, "") };
}

function parseArrayJSON(raw: string | null | undefined): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

function parseBoletaSections(raw: string | null | undefined): Array<{ key?: string; title?: string; vulnerabilityLevel?: string; items?: any[] }> {
    const arr = parseArrayJSON(raw);
    return arr.map((x) => {
        let items: any[] = [];
        if (Array.isArray(x?.items)) items = x.items;
        else if (typeof x?.items === "string") {
            try {
                const p = JSON.parse(x.items);
                items = Array.isArray(p) ? p : [];
            } catch {
                items = [];
            }
        }
        return {
            key: x?.key != null ? String(x.key) : undefined,
            title: x?.title != null ? String(x.title) : undefined,
            vulnerabilityLevel: x?.vulnerabilityLevel != null ? String(x.vulnerabilityLevel) : undefined,
            items,
        };
    });
}

export function normalizeVulnerabilidadFilters(raw: unknown): VulnerabilidadModuleFilters {
    return normalizeActaEntregaFilters(raw);
}

export function hasVulnerabilidadListModuleFiltersContent(f: VulnerabilidadModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds && f.empresaIds.length > 0) return true;
    if (f.clienteIds && f.clienteIds.length > 0) return true;
    if (f.divisionIds && f.divisionIds.length > 0) return true;
    if (f.contratoIds && f.contratoIds.length > 0) return true;
    if (f.corpoIds && f.corpoIds.length > 0) return true;
    if (f.puestoIds && f.puestoIds.length > 0) return true;
    return false;
}

export function filtersMatchVulnerabilidadListQuery(parsedRowFilters: any, listModuleFilters?: VulnerabilidadModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeVulnerabilidadFilters(mf);
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
    return true;
}

async function resolveLogoBuffer(empresaId: number): Promise<Buffer | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const p = path.resolve(process.cwd(), "app", "logo-images", logoName);
    try {
        return await fs.readFile(p);
    } catch {
        return null;
    }
}

export async function queryVulnerabilidadRows(
    prisma: PrismaClient,
    filters: VulnerabilidadModuleFilters,
    orderKey: VulnerabilidadOrderKey,
): Promise<any[]> {
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

    const rows = await prisma.c_boleta_apreciacion_vulnerabilidad.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const empresaIds = [...new Set(rows.map((x) => Number(x.empresa_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const clienteIds = [...new Set(rows.map((x) => Number(x.cliente_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const divisionIds = [...new Set(rows.map((x) => Number(x.division_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const contratoIds = [...new Set(rows.map((x) => Number(x.contrato_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const corpoIds = [...new Set(rows.map((x) => Number(x.corpo_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const puestoIds = [...new Set(rows.map((x) => Number(x.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } }) : [],
        puestoIds.length ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
    ]);

    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(r.empresa_id);
        const cliente = clienteById.get(r.cliente_id);
        const division = divisionById.get(r.division_id);
        const contrato = contratoById.get(r.contrato_id);
        const corpo = corpoById.get(r.corpo_id);
        const puesto = puestoById.get(r.puesto_id);
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            firma_solicitante_data_uri: normalizeSignatureDataUri(r.firma_solicitante),
            firma_responsable_data_uri: normalizeSignatureDataUri(r.firma_responsable),
        };
    });

    return [...enriched].sort((a, b) => {
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

export async function buildVulnerabilidadExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const workbook = new ExcelJS.Workbook();
    const main = workbook.addWorksheet("Apreciacion vulnerabilidad");
    const details = workbook.addWorksheet("Detalles");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const headers = ["ID", "Empresa", "Cliente", "División", "Contrato", "Sucursal", "Puesto", "Fecha", "Solicitante", "Boleta", "Métricas", "Observaciones"];
    const h = main.addRow(headers);
    h.font = { bold: true };
    h.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    h.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
        c.border = borderThin;
    });
    main.views = [{ state: "frozen", ySplit: 1 }];
    main.columns = [
        { width: 8, outlineLevel: 1 },
        { width: 30, outlineLevel: 1 },
        { width: 26, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 30, outlineLevel: 1 },
        { width: 28, outlineLevel: 1 },
        { width: 30, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 24, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 34, outlineLevel: 1 },
    ];

    const detailStartById = new Map<number, number>();
    let dRow = 1;
    const rowsDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of rowsDesc) {
        detailStartById.set(Number(r.id), dRow);
        details.getCell(`A${dRow}`).value = `Registro #${r.id}`;
        details.getCell(`A${dRow}`).font = { bold: true, size: 12 };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        dRow += 1;

        details.getCell(`A${dRow}`).value = "Boleta";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        dRow += 1;
        const sections = parseBoletaSections(r.boleta);
        for (const sec of sections) {
            const title = String(sec.title ?? "");
            details.getCell(`A${dRow}`).value = title;
            details.getCell(`A${dRow}`).font = { bold: true };
            details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EEF9" } };
            details.getCell(`A${dRow}`).border = borderThin;
            details.getCell(`B${dRow}`).border = borderThin;
            details.getCell(`C${dRow}`).border = borderThin;
            details.getCell(`D${dRow}`).border = borderThin;
            dRow += 1;

            if (sec.key === "porcentaje_vulnerabilidad") {
                details.getRow(dRow).values = ["Nivel", String(sec.vulnerabilityLevel ?? "")];
                details.getRow(dRow).eachCell((c) => (c.border = borderThin));
                dRow += 1;
                continue;
            }
            for (const item of sec.items ?? []) {
                details.getRow(dRow).values = [String(item.label ?? ""), String(item.answer ?? "")];
                details.getRow(dRow).eachCell((c) => (c.border = borderThin));
                dRow += 1;
            }
        }

        details.getCell(`A${dRow}`).value = "Métricas de vulnerabilidad";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        dRow += 1;
        for (const m of parseArrayJSON(r.metricas_vulnerablidad)) {
            details.getCell(`A${dRow}`).value = String(m ?? "");
            details.getCell(`A${dRow}`).border = borderThin;
            details.getCell(`B${dRow}`).border = borderThin;
            details.getCell(`C${dRow}`).border = borderThin;
            details.getCell(`D${dRow}`).border = borderThin;
            dRow += 1;
        }
        dRow += 1;
    }
    details.columns = [{ width: 48 }, { width: 18 }, { width: 18 }, { width: 18 }];

    for (const r of rows) {
        const dr = detailStartById.get(Number(r.id)) ?? 1;
        const row = main.addRow([
            r.id,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            r.nombre_solicitante ?? "",
            "Ver boleta",
            "Ver métricas",
            r.observaciones ?? "",
        ]);
        row.getCell(10).value = { text: "Ver boleta", hyperlink: `#'Detalles'!A${dr}` };
        row.getCell(11).value = { text: "Ver métricas", hyperlink: `#'Detalles'!A${dr}` };
        row.getCell(10).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(11).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
    }
    main.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildVulnerabilidadExcelIndividual(rows: any[], reportNombre: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const blueFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } } as const;

    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E73AE" } } as const;

    for (const r of rows) {
        const ws = workbook.addWorksheet(`R${r.id}`.slice(0, 31));
        ws.views = [{ showGridLines: false }];
        // Grilla basada en plantilla: bloque izquierdo (A:J), separador (K), bloque derecho (L:U)
        // Dentro de cada bloque: Nro + Detalle (ancho) + SI + NO
        ws.columns = [
            { width: 14.5 }, // A (logo / numeración)
            { width: 10.4 }, // B detalle izq
            { width: 6.4 }, // C
            { width: 6.4 }, // D
            { width: 6.4 }, // E
            { width: 6.4 }, // F
            { width: 6.4 }, // G
            { width: 6.4 }, // H
            { width: 4.2 }, // I SI
            { width: 4.2 }, // J NO
            { width: 2.2 }, // K separador central
            { width: 7.2 }, // L nro der
            { width: 10.4 }, // M detalle der
            { width: 6.4 }, // N
            { width: 6.4 }, // O
            { width: 6.4 }, // P
            { width: 6.4 }, // Q
            { width: 6.4 }, // R
            { width: 6.4 }, // S
            { width: 4.2 }, // T SI
            { width: 4.2 }, // U NO
        ];

        // Header row
        ws.mergeCells("A1:A2");
        ws.mergeCells("B1:O2");
        ws.mergeCells("P1:U2");
        ws.getRow(1).height = 30;
        ws.getRow(2).height = 30;
        ws.getCell("B1").value = "BOLETA DE APRECIACIÓN DE VULNERABILIDAD";
        ws.getCell("B1").fill = blueFill;
        ws.getCell("B1").font = { color: { argb: "FFFFFFFF" }, bold: true };
        ws.getCell("B1").alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell("P1").value = String(r.nombre ?? r.titulo ?? reportNombre ?? "");
        ws.getCell("P1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        for (let rr = 1; rr <= 2; rr++) for (let cc = 1; cc <= 21; cc++) ws.getCell(rr, cc).border = borderThin;
        // Fila 3 sin bordes (excepto superior)
        for (let cc = 1; cc <= 21; cc++) {
            ws.getCell(3, cc).border = { top: { style: "thin" } };
        }

        const logo = await resolveLogoBuffer(Number(r.empresa_id));
        if (logo) {
            try {
                const imgId = workbook.addImage({ base64: logo.toString("base64"), extension: "png" });
                ws.addImage(imgId, { tl: { col: 0.6, row: 0.3 }, ext: { width: 72, height: 58 } });
            } catch {}
        }

        ws.getRow(4).height = 18;
        ws.getRow(5).height = 18;
        ws.getCell("R4").value = "DIA";
        ws.getCell("S4").value = "MES";
        ws.getCell("T4").value = "AÑO";
        ws.getCell("R5").value = new Date(r.fecha).getDate();
        ws.getCell("S5").value = new Date(r.fecha).getMonth() + 1;
        ws.getCell("T5").value = new Date(r.fecha).getFullYear();
        for (const c of ["R4", "S4", "T4", "R5", "S5", "T5"]) {
            ws.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
            ws.getCell(c).font = { bold: true, size: 9 };
            ws.getCell(c).border = borderThin;
        }

        ws.mergeCells("A6:C6");
        ws.mergeCells("D6:J6");
        ws.mergeCells("K6:N6");
        ws.mergeCells("O6:U6");
        ws.mergeCells("A7:C7");
        ws.mergeCells("D7:J7");
        ws.mergeCells("K7:N7");
        ws.mergeCells("O7:U7");
        ws.getCell("A6").value = "CLIENTE:";
        ws.getCell("D6").value = String(r.cliente_nombre ?? "");
        ws.getCell("K6").value = "PUESTO:";
        ws.getCell("O6").value = String(r.puesto_nombre ?? "");
        ws.getCell("A7").value = "ENLACE:";
        ws.getCell("D7").value = String(r.enlace ?? "");
        ws.getCell("K7").value = "SOLICITADO POR:";
        ws.getCell("O7").value = String(r.nombre_solicitante ?? "");
        for (let rr = 6; rr <= 7; rr++) {
            for (let cc = 1; cc <= 21; cc++) {
                // Sin borde interior entre etiqueta y contenido: C|D y N|O
                const left = cc === 4 || cc === 15 ? undefined : { style: "thin" as const };
                const right = cc === 3 || cc === 14 ? undefined : { style: "thin" as const };
                ws.getCell(rr, cc).border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left,
                    right,
                };
                ws.getCell(rr, cc).alignment = { vertical: "middle", horizontal: cc <= 3 || (cc >= 12 && cc <= 14) ? "left" : "left", wrapText: true };
            }
        }

        const setSectionHeader = (row: number, text: string) => {
            ws.mergeCells(`A${row}:U${row}`);
            ws.getCell(`A${row}`).value = text;
            ws.getCell(`A${row}`).fill = blueFill;
            ws.getCell(`A${row}`).font = { color: { argb: "FFFFFFFF" }, bold: true };
            ws.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
            // Header sin bordes internos (solo contorno horizontal y extremos)
            for (let cc = 1; cc <= 21; cc++) {
                ws.getCell(row, cc).border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: cc === 1 ? { style: "thin" } : undefined,
                    right: cc === 21 ? { style: "thin" } : undefined,
                };
            }
        };

        const setDualDetailHeader = (row: number) => {
            ws.mergeCells(`B${row}:H${row}`);
            ws.mergeCells(`M${row}:S${row}`);
            ws.getCell(`B${row}`).value = "DETALLE";
            ws.getCell(`I${row}`).value = "SI";
            ws.getCell(`J${row}`).value = "NO";
            ws.getCell(`M${row}`).value = "DETALLE";
            ws.getCell(`T${row}`).value = "SI";
            ws.getCell(`U${row}`).value = "NO";
            for (let cc = 1; cc <= 21; cc++) {
                if (cc === 11) {
                    // Separación blanca entre bloques
                    ws.getCell(row, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                    ws.getCell(row, cc).border = {};
                    continue;
                }
                ws.getCell(row, cc).fill = hdrFill;
                ws.getCell(row, cc).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 9 };
                ws.getCell(row, cc).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                ws.getCell(row, cc).border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: cc === 1 || cc === 12 ? { style: "thin" } : undefined,
                    right: cc === 10 || cc === 21 ? { style: "thin" } : undefined,
                };
            }
        };

        const renderDualItemRow = (row: number, idx: number | null, item: any, right = false) => {
            const base = right ? 12 : 1;
            const nCol = base;
            const dFrom = base + 1;
            const dTo = base + 7;
            const siCol = base + 8;
            const noCol = base + 9;

            if (idx != null) ws.getCell(row, nCol).value = idx;
            ws.mergeCells(row, dFrom, row, dTo);
            ws.getCell(row, dFrom).value = String(item?.label ?? "");
            const ans = String(item?.answer ?? "").toLowerCase().trim();
            ws.getCell(row, siCol).value = ans === "si" ? "X" : "";
            ws.getCell(row, noCol).value = ans === "no" ? "X" : "";
        };

        const estimateRowHeight = (leftLabel?: string, rightLabel?: string) => {
            const l = String(leftLabel ?? "").trim();
            const r = String(rightLabel ?? "").trim();
            const maxLen = Math.max(l.length, r.length);
            // Altura base + escalado simple para celdas envueltas (se parece al patrón de la plantilla)
            if (maxLen <= 55) return 18;
            if (maxLen <= 95) return 24;
            if (maxLen <= 135) return 30;
            return 36;
        };

        let rowPtr = 9;
        const sections = parseBoletaSections(r.boleta);
        const pctSection = sections.find((s) => s.key === "porcentaje_vulnerabilidad");
        const regularSections = sections.filter((s) => s.key !== "porcentaje_vulnerabilidad");

        for (const sec of regularSections) {
            setSectionHeader(rowPtr, String(sec.title ?? ""));
            rowPtr += 1;
            setDualDetailHeader(rowPtr);
            rowPtr += 1;

            const items = (sec.items ?? []).filter(Boolean);
            const half = Math.ceil(items.length / 2);
            const left = items.slice(0, half);
            const right = items.slice(half);
            const maxRows = Math.max(left.length, right.length, 1);

            for (let i = 0; i < maxRows; i++) {
                if (left[i]) renderDualItemRow(rowPtr, i + 1, left[i], false);
                if (right[i]) renderDualItemRow(rowPtr, half + i + 1, right[i], true);
                for (let cc = 1; cc <= 21; cc++) {
                    if (cc === 11) {
                        ws.getCell(rowPtr, cc).border = {};
                        ws.getCell(rowPtr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                        continue;
                    }
                    ws.getCell(rowPtr, cc).border = borderThin;
                    ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: cc === 2 || cc === 13 ? "left" : "center", wrapText: true };
                    ws.getCell(rowPtr, cc).font = { size: 8 };
                }
                ws.getRow(rowPtr).height = estimateRowHeight(left[i]?.label, right[i]?.label);
                rowPtr += 1;
            }
            // Espacio en blanco entre tablas
            ws.getRow(rowPtr).height = 8;
            rowPtr += 1;
        }

        setSectionHeader(rowPtr, "% DE VULNERABILIDAD");
        rowPtr += 1;
        // Solo un bloque de header en % de vulnerabilidad (sin duplicado a la derecha)
        ws.mergeCells(`B${rowPtr}:H${rowPtr}`);
        ws.getCell(`B${rowPtr}`).value = "DETALLE";
        ws.getCell(`I${rowPtr}`).value = "SI";
        ws.getCell(`J${rowPtr}`).value = "NO";
        for (let cc = 1; cc <= 21; cc++) {
            ws.getCell(rowPtr, cc).fill = hdrFill;
            ws.getCell(rowPtr, cc).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 9 };
            ws.getCell(rowPtr, cc).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            ws.getCell(rowPtr, cc).border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: cc === 1 ? { style: "thin" } : undefined,
                right: cc === 21 ? { style: "thin" } : undefined,
            };
        }
        rowPtr += 1;

        const level = String(pctSection?.vulnerabilityLevel ?? "").toLowerCase().trim();
        const vulnRows = ["baja", "media", "alta"];
        for (let i = 0; i < vulnRows.length; i++) {
            ws.getCell(`A${rowPtr}`).value = i + 1;
            ws.mergeCells(`B${rowPtr}:H${rowPtr}`);
            ws.getCell(`B${rowPtr}`).value = `Vulnerabilidad ${vulnRows[i]}`;
            ws.getCell(`I${rowPtr}`).value = level === vulnRows[i] ? "X" : "";
            for (let cc = 1; cc <= 21; cc++) {
                ws.getCell(rowPtr, cc).border = borderThin;
                ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: cc === 2 ? "left" : "center" };
            }
            ws.getRow(rowPtr).height = 18;
            rowPtr += 1;
        }

        setSectionHeader(rowPtr, "OBSERVACIONES");
        rowPtr += 1;
        ws.mergeCells(`A${rowPtr}:U${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Breve detalle de los elementos que influyen en el porcentaje de vulnerabilidad";
        ws.getCell(`A${rowPtr}`).fill = hdrFill;
        ws.getCell(`A${rowPtr}`).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 9 };
        ws.getCell(`A${rowPtr}`).alignment = { horizontal: "center", vertical: "middle" };
        for (let cc = 1; cc <= 21; cc++) ws.getCell(rowPtr, cc).border = borderThin;
        rowPtr += 1;

        const metrics = parseArrayJSON(r.metricas_vulnerablidad);
        const text = metrics.map((m, i) => `${i + 1}. ${String(m ?? "")}`).join("\n");
        ws.mergeCells(`A${rowPtr}:U${rowPtr + 4}`);
        ws.getCell(`A${rowPtr}`).value = text || "—";
        ws.getCell(`A${rowPtr}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
        for (let rr = rowPtr; rr <= rowPtr + 4; rr++) for (let cc = 1; cc <= 21; cc++) ws.getCell(rr, cc).border = borderThin;
        rowPtr += 6;

        ws.mergeCells(`A${rowPtr}:M${rowPtr}`);
        ws.mergeCells(`N${rowPtr}:U${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Firma solicitante";
        ws.getCell(`A${rowPtr}`).font = { bold: true };
        for (let cc = 1; cc <= 21; cc++) ws.getCell(rowPtr, cc).border = borderThin;
        ws.getRow(rowPtr).height = 42;

        const sig = parseDataUri(r.firma_solicitante_data_uri ?? null);
        if (sig) {
            try {
                const imgId = workbook.addImage({ base64: sig.base64, extension: sig.extension });
                ws.addImage(imgId, { tl: { col: 13.3, row: rowPtr - 1 + 0.1 }, ext: { width: 140, height: 32 } });
            } catch {}
        }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
}
