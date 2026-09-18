/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";

export type ActaEntregaModuleFilters = {
    creadoDesde?: string | null;
    creadoHasta?: string | null;
    empresaIds?: number[] | null;
    clienteIds?: number[] | null;
    divisionIds?: number[] | null;
    contratoIds?: number[] | null;
    corpoIds?: number[] | null;
    puestoIds?: number[] | null;
};

export type ActaEntregaOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha"
    | "nombre_entrega"
    | "cedula_entrega"
    | "nombre_recibe"
    | "cedula_recibe";
export type ActaEntregaReportType = "Consolidado" | "Individual";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function normalizeBase64Payload(raw: string): string {
    // Limpia espacios/saltos y corrige base64 URL-safe.
    let b64 = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const mod = b64.length % 4;
    if (mod > 0) b64 = `${b64}${"=".repeat(4 - mod)}`;
    return b64;
}

function parseDataUri(dataUri: string | null): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUri) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUri);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: normalizeBase64Payload(m[2]) };
    }
    // Fallback: si llega sin prefijo data URI.
    return { extension: "png", base64: normalizeBase64Payload(dataUri) };
}

function parseDetalleArray(raw: string | null | undefined): Array<Record<string, unknown>> {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function normalizeActaEntregaFilters(raw: unknown): ActaEntregaModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: ActaEntregaModuleFilters = {};
    if (o.creadoDesde != null && String(o.creadoDesde).trim() !== "") next.creadoDesde = String(o.creadoDesde);
    if (o.creadoHasta != null && String(o.creadoHasta).trim() !== "") next.creadoHasta = String(o.creadoHasta);
    const eids = toValidIds(o.empresaIds);
    const cids = toValidIds(o.clienteIds);
    const dids = toValidIds(o.divisionIds);
    const coids = toValidIds(o.contratoIds);
    const sids = toValidIds(o.corpoIds);
    const pids = toValidIds(o.puestoIds);
    if (eids.length) next.empresaIds = eids;
    if (cids.length) next.clienteIds = cids;
    if (dids.length) next.divisionIds = dids;
    if (coids.length) next.contratoIds = coids;
    if (sids.length) next.corpoIds = sids;
    if (pids.length) next.puestoIds = pids;
    return next;
}

type ActaRow = {
    id: number;
    empresa_id: number;
    cliente_id: number;
    division_id: number;
    contrato_id: number;
    corpo_id: number;
    puesto_id: number;
    fecha: Date;
    tipo_entrega: string;
    mensual: string;
    detalle: string;
    nombre_entrega: string;
    cedula_entrega: string;
    firma_entrega: string | null;
    nombre_recibe: string;
    cedula_recibe: string;
    firma_recibe: string | null;
};

export async function queryActaEntregaProductos(
    prisma: ReportDataAccess,
    filters: ActaEntregaModuleFilters,
    orderKey: ActaEntregaOrderKey,
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

    const rows = (await prisma.c_acta_entre_producto.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    })) as unknown as ActaRow[];

    const empresaIds = [...new Set(rows.map((x) => Number(x.empresa_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const clienteIds = [...new Set(rows.map((x) => Number(x.cliente_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const divisionIds = [...new Set(rows.map((x) => Number(x.division_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const contratoIds = [...new Set(rows.map((x) => Number(x.contrato_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const corpoIds = [...new Set(rows.map((x) => Number(x.corpo_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const puestoIds = [...new Set(rows.map((x) => Number(x.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } })
            : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({
                  where: { id: { in: contratoIds } },
                  select: { id: true, nombre: true, nro_contrato: true },
              })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: corpoIds } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
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
            firma_entrega_data_uri: normalizeSignatureDataUri(r.firma_entrega),
            firma_recibe_data_uri: normalizeSignatureDataUri(r.firma_recibe),
        };
    });

    const sorted = [...enriched].sort((a, b) => {
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
            case "nombre_entrega":
                return String(a.nombre_entrega || "").localeCompare(String(b.nombre_entrega || ""), "es");
            case "cedula_entrega":
                return String(a.cedula_entrega || "").localeCompare(String(b.cedula_entrega || ""), "es");
            case "nombre_recibe":
                return String(a.nombre_recibe || "").localeCompare(String(b.nombre_recibe || ""), "es");
            case "cedula_recibe":
                return String(a.cedula_recibe || "").localeCompare(String(b.cedula_recibe || ""), "es");
            case "fecha":
            default:
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }
    });

    return sorted;
}

export async function buildActaEntregaExcelBuffer(rows: any[]): Promise<Buffer> {
    return buildActaEntregaExcelBufferByType(rows, "Consolidado"); // Consolidado
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

function applyThinBorderToRange(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    for (let r = fromRow; r <= toRow; r++) {
        for (let c = fromCol; c <= toCol; c++) {
            ws.getRow(r).getCell(c).border = border;
        }
    }
}

function applyOuterBorderToRange(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
    const thin = { style: "thin" as const };
    for (let r = fromRow; r <= toRow; r++) {
        for (let c = fromCol; c <= toCol; c++) {
            const cell = ws.getRow(r).getCell(c);
            const border: Partial<ExcelJS.Borders> = {};
            if (r === fromRow) border.top = thin;
            if (r === toRow) border.bottom = thin;
            if (c === fromCol) border.left = thin;
            if (c === toCol) border.right = thin;
            cell.border = border;
        }
    }
}

export async function buildActaEntregaExcelBufferByType(
    rows: any[],
    reportType: ActaEntregaReportType,
    reportName?: string,
): Promise<Buffer> {
    if (reportType === "Individual") {
        const workbook = new ExcelJS.Workbook();
        const borderThin: Partial<ExcelJS.Borders> = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        };

        for (const r of rows) {
            const sheetName = `Acta ${String(r.id).slice(0, 20)}`;
            const ws = workbook.addWorksheet(sheetName);
            ws.columns = [
                { width: 18 },
                { width: 11 },
                { width: 10 },
                { width: 11 },
                { width: 11 },
                { width: 3 },
                { width: 24 },
                { width: 11 },
                { width: 10 },
                { width: 11 },
                { width: 11 },
            ];
            ws.views = [{ state: "frozen", ySplit: 6 }];

            // Encabezado superior (logo + titulo oscuro + bloque derecho editable)
            ws.mergeCells("A1:B3");
            ws.mergeCells("C1:I3");
            ws.mergeCells("J1:K3");
            ws.getCell("C1").value = "Acta de entrega de producto";
            ws.getCell("C1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            ws.getCell("C1").alignment = { vertical: "middle", horizontal: "center" };
            ws.getCell("C1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A3A" } };
            ws.getCell("J1").value = String(reportName ?? "");
            ws.getCell("J1").alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            ws.getCell("J1").font = { size: 9 };
            applyThinBorderToRange(ws, 1, 3, 1, 11);

            const logoPath = await resolveLogoPathByEmpresaId(Number(r.empresa_id));
            if (logoPath) {
                const imgId = workbook.addImage({ filename: logoPath, extension: "png" });
                // Centrado dentro de A1:B3
                ws.addImage(imgId, { tl: { col: 0.72, row: 0.55 }, ext: { width: 42, height: 42 } });
            }

            // Header con etiqueta + espacio de dato al lado.
            ws.mergeCells("A4:C4");
            ws.mergeCells("D4:E4");
            ws.mergeCells("F4:H4");
            ws.mergeCells("I4:K4");
            ws.getCell("A4").value = "Fecha de Entrega";
            ws.getCell("F4").value = "Tipo de Entrega";
            ws.getCell("D4").value = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? "");
            ws.getCell("I4").value = String(r.tipo_entrega ?? "");

            ws.mergeCells("A5:C5");
            ws.mergeCells("D5:E5");
            ws.mergeCells("F5:H5");
            ws.mergeCells("I5:K5");
            ws.getCell("A5").value = "Cliente";
            ws.getCell("F5").value = "Mensual";
            ws.getCell("D5").value = String(r.cliente_nombre ?? "");
            ws.getCell("I5").value = String(r.mensual ?? "");
            applyThinBorderToRange(ws, 4, 5, 1, 11);
            ["A4", "F4", "A5", "F5"].forEach((k) => {
                ws.getCell(k).font = { bold: true };
                ws.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
                ws.getCell(k).alignment = { horizontal: "left", vertical: "middle" };
            });
            ["D4", "I4", "D5", "I5"].forEach((k) => {
                ws.getCell(k).alignment = { horizontal: "left", vertical: "middle" };
            });

            // Barra azul "Productos de Limpieza"
            ws.mergeCells("A6:K6");
            ws.getCell("A6").value = "Productos de Limpieza";
            ws.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
            ws.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E3A62" } };
            applyThinBorderToRange(ws, 6, 6, 1, 11);

            // Headers dobles
            const headRow = 7;
            ws.getCell(headRow, 1).value = "Descripción";
            ws.getCell(headRow, 2).value = "Unid/Medida";
            ws.getCell(headRow, 3).value = "Cantidad";
            ws.getCell(headRow, 4).value = "Devolución";
            ws.getCell(headRow, 5).value = "Faltantes";
            ws.getCell(headRow, 7).value = "Descripción";
            ws.getCell(headRow, 8).value = "Unid/Medida";
            ws.getCell(headRow, 9).value = "Cantidad";
            ws.getCell(headRow, 10).value = "Devolución";
            ws.getCell(headRow, 11).value = "Faltantes";
            ws.getRow(headRow).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
            ws.getRow(headRow).height = 28;
            ws.getRow(headRow).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            ws.getRow(headRow).eachCell((c, colNumber) => {
                if (colNumber === 6) {
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
                } else {
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5A9AD1" } };
                }
                c.border = borderThin;
            });
            ws.getCell(headRow, 6).value = "";
            ws.getCell(headRow, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
            ws.getCell(headRow, 6).border = borderThin;

            // Orden solicitado: fila izquierda, fila derecha, segunda izquierda, segunda derecha...
            const detalleRows = parseDetalleArray(r.detalle);
            let baseRow = 8;
            let leftTurn = true;
            for (const item of detalleRows) {
                const targetRow = leftTurn ? baseRow : baseRow;
                const startCol = leftTurn ? 1 : 7;
                ws.getCell(targetRow, startCol).value = String(item.descripcion ?? "");
                ws.getCell(targetRow, startCol + 1).value = String(item.unidad_medida ?? "");
                ws.getCell(targetRow, startCol + 2).value = String(item.cantidad ?? "");
                ws.getCell(targetRow, startCol + 3).value = String(item.devolucion ?? "");
                ws.getCell(targetRow, startCol + 4).value = String(item.faltantes ?? "");
                for (let c = startCol; c <= startCol + 4; c++) ws.getCell(targetRow, c).border = borderThin;
                ws.getCell(targetRow, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
                ws.getCell(targetRow, 6).border = borderThin;
                if (!leftTurn) baseRow += 1;
                leftTurn = !leftTurn;
            }
            // rellena líneas visuales amplias según referencia
            const detailEnd = Math.max(baseRow + 1, 24);
            for (let rr = 8; rr <= detailEnd; rr++) {
                applyThinBorderToRange(ws, rr, rr, 1, 5);
                applyThinBorderToRange(ws, rr, rr, 7, 11);
                ws.getCell(rr, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
                ws.getCell(rr, 6).border = borderThin;
                ws.getRow(rr).height = 20;
            }
            ws.getRow(8).height = 28;

            // Nota + observaciones
            ws.mergeCells(`A${detailEnd + 1}:K${detailEnd + 1}`);
            ws.getCell(`A${detailEnd + 1}`).value =
                'Nota: Por favor no alterar las cantidades con lapicero ni lápiz.';
            ws.getCell(`A${detailEnd + 1}`).alignment = { horizontal: "center" };
            ws.getCell(`A${detailEnd + 1}`).font = { size: 8 };
            ws.mergeCells(`A${detailEnd + 2}:K${detailEnd + 2}`);
            ws.getCell(`A${detailEnd + 2}`).value = "Observaciones y/o Faltantes:";
            applyThinBorderToRange(ws, detailEnd + 1, detailEnd + 2, 1, 11);

            const sigEntrega = parseDataUri(normalizeSignatureDataUri(r.firma_entrega));
            const sigRecibe = parseDataUri(normalizeSignatureDataUri(r.firma_recibe));
            const sigTop = detailEnd + 3;
            const sigBottom = sigTop + 7;
            ws.mergeCells(`A${sigTop}:E${sigTop}`);
            ws.mergeCells(`G${sigTop}:K${sigTop}`);
            ws.getCell(`A${sigTop}`).value = "ENTREGA";
            ws.getCell(`G${sigTop}`).value = "RECIBE";
            ws.getCell(`A${sigTop}`).alignment = { horizontal: "center" };
            ws.getCell(`G${sigTop}`).alignment = { horizontal: "center" };
            ws.getCell(`A${sigTop}`).font = { bold: true };
            ws.getCell(`G${sigTop}`).font = { bold: true };
            const labelRows = ["Nombre", "Cédula", "Fecha", "Firma"];
            for (let i = 1; i <= 4; i++) {
                const rr = sigTop + i;
                ws.getCell(rr, 1).value = labelRows[i - 1];
                ws.getCell(rr, 7).value = labelRows[i - 1];
                ws.mergeCells(`B${rr}:E${rr}`);
                ws.mergeCells(`H${rr}:K${rr}`);
                ws.getCell(rr, 2).border = { bottom: { style: "thin" } };
                ws.getCell(rr, 8).border = { bottom: { style: "thin" } };
            }
            ws.getCell(sigTop + 1, 2).value = String(r.nombre_entrega ?? "");
            ws.getCell(sigTop + 2, 2).value = String(r.cedula_entrega ?? "");
            ws.getCell(sigTop + 3, 2).value = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? "");
            ws.getCell(sigTop + 1, 8).value = String(r.nombre_recibe ?? "");
            ws.getCell(sigTop + 2, 8).value = String(r.cedula_recibe ?? "");
            ws.getCell(sigTop + 3, 8).value = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? "");
            // Sin cuadrícula interior: solo borde externo + líneas de escritura.
            // Bloque de firma reducido para no ocupar tantas casillas.
            for (let rr = sigTop; rr <= sigBottom; rr++) {
                for (let cc = 1; cc <= 5; cc++) {
                    ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                }
                for (let cc = 7; cc <= 11; cc++) {
                    ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                }
            }
            applyOuterBorderToRange(ws, sigTop, sigBottom, 1, 5);
            applyOuterBorderToRange(ws, sigTop, sigBottom, 7, 11);
            ws.mergeCells(`B${sigTop + 5}:E${sigBottom}`);
            ws.mergeCells(`H${sigTop + 5}:K${sigBottom}`);
            // Refuerzo de borde exterior en celdas combinadas de firma (derecha e inferior).
            for (let rr = sigTop + 5; rr <= sigBottom; rr++) {
                ws.getCell(rr, 5).border = {
                    ...(ws.getCell(rr, 5).border || {}),
                    right: { style: "thin" },
                };
                ws.getCell(rr, 11).border = {
                    ...(ws.getCell(rr, 11).border || {}),
                    right: { style: "thin" },
                };
            }
            for (let cc = 2; cc <= 5; cc++) {
                ws.getCell(sigBottom, cc).border = {
                    ...(ws.getCell(sigBottom, cc).border || {}),
                    bottom: { style: "thin" },
                };
            }
            for (let cc = 8; cc <= 11; cc++) {
                ws.getCell(sigBottom, cc).border = {
                    ...(ws.getCell(sigBottom, cc).border || {}),
                    bottom: { style: "thin" },
                };
            }
            ws.getRow(sigTop + 5).height = 52;
            ws.getRow(sigTop + 6).height = 52;
            ws.getRow(sigTop + 7).height = 52;
            if (sigEntrega) {
                const imgId = workbook.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
                ws.addImage(imgId, { tl: { col: 1.1, row: sigTop + 4.8 }, ext: { width: 250, height: 150 } });
            }
            if (sigRecibe) {
                const imgId = workbook.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
                ws.addImage(imgId, { tl: { col: 7.1, row: sigTop + 4.8 }, ext: { width: 250, height: 150 } });
            }

            // Separador central como la referencia: fondo claro con borde negro alrededor.
            applyThinBorderToRange(ws, 1, detailEnd + 2, 1, 11);
            for (let rr = sigTop; rr <= sigBottom; rr++) {
                ws.getCell(rr, 6).value = "";
                ws.getCell(rr, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                ws.getCell(rr, 6).border = borderThin;
            }
        }
        const ab = await workbook.xlsx.writeBuffer();
        return Buffer.from(ab);
    }

    const workbook = new ExcelJS.Workbook();
    const main = workbook.addWorksheet("Acta entrega productos");
    const details = workbook.addWorksheet("Detalles");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    /** Cuadrícula jerárquica: cada fila es el acta (nivel 0) o uno de sus ítems de `detalle` (nivel 1). */
    main.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const mainHeaders = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Acta",
        "Empresa",
        "Cliente",
        "Division ID",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Fecha",
        "Tipo entrega",
        "Mensual",
        "Nombre entrega",
        "Cedula entrega",
        "Nombre recibe",
        "Cedula recibe",
        "Ver detalle",
        "Ver firma entrega",
        "Ver firma recibe",
        "Descripción (detalle)",
        "Unidad medida (detalle)",
        "Cantidad (detalle)",
        "Devolución (detalle)",
        "Faltantes (detalle)",
    ];
    const COL_VER_DETALLE = 19;
    const COL_VER_FIRMA_ENTREGA = 20;
    const COL_VER_FIRMA_RECIBE = 21;

    const h = main.addRow(mainHeaders);
    h.font = { bold: true };
    h.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    h.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
        c.border = borderThin;
    });
    main.getRow(1).height = 28;
    main.views = [{ state: "frozen", ySplit: 1 }];
    /** Anchos amplios y sin agrupación de columnas: el filtrado va en la fila de encabezado (autoFilter). */
    main.columns = [
        { width: 12 },
        { width: 14 },
        { width: 8 },
        { width: 20 },
        { width: 12 },
        { width: 38 },
        { width: 36 },
        { width: 16 },
        { width: 38 },
        { width: 36 },
        { width: 36 },
        { width: 28 },
        { width: 22 },
        { width: 16 },
        { width: 32 },
        { width: 22 },
        { width: 32 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 32 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
    ];

    const detailsStartById = new Map<number, number>();
    let dRow = 1;
    const rowsDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of rowsDesc) {
        const start = dRow;
        detailsStartById.set(Number(r.id), start);
        details.getCell(`A${dRow}`).value = `Registro #${r.id}`;
        details.getCell(`A${dRow}`).font = { bold: true, size: 12 };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        dRow += 1;
        details.getCell(`A${dRow}`).value = `Empresa: ${r.empresa_nombre}`;
        details.getCell(`C${dRow}`).value = `Cliente: ${r.cliente_nombre}`;
        dRow += 1;
        details.getCell(`A${dRow}`).value = "Detalle";
        details.getCell(`A${dRow}`).font = { bold: true };
        dRow += 1;

        const detalleRows = parseDetalleArray(r.detalle);
        details.getRow(dRow).values = ["Descripcion", "Unidad medida", "Cantidad", "Devolucion", "Faltantes"];
        details.getRow(dRow).font = { bold: true };
        details.getRow(dRow).eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4DCCB" } };
            c.border = borderThin;
        });
        dRow += 1;
        for (const item of detalleRows) {
            const rowDet = details.getRow(dRow);
            rowDet.values = [
                String(item.descripcion ?? ""),
                String(item.unidad_medida ?? ""),
                String(item.cantidad ?? ""),
                String(item.devolucion ?? ""),
                String(item.faltantes ?? ""),
            ];
            rowDet.eachCell((c) => {
                c.border = borderThin;
            });
            dRow += 1;
        }

        const sigEntrega = parseDataUri(normalizeSignatureDataUri(r.firma_entrega));
        const sigRecibe = parseDataUri(normalizeSignatureDataUri(r.firma_recibe));
        details.getCell(`A${dRow}`).value = "Firma entrega";
        details.getCell(`F${dRow}`).value = "Firma recibe";
        details.getCell(`A${dRow}`).font = { bold: true };
        details.getCell(`F${dRow}`).font = { bold: true };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        details.getCell(`F${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        details.getCell(`A${dRow}`).border = borderThin;
        details.getCell(`F${dRow}`).border = borderThin;
        dRow += 1;
        const imgTop = dRow - 1;
        if (sigEntrega) {
            const imgId = workbook.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
            details.addImage(imgId, { tl: { col: 0, row: imgTop }, ext: { width: 220, height: 90 } });
        }
        if (sigRecibe) {
            const imgId = workbook.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
            details.addImage(imgId, { tl: { col: 5, row: imgTop }, ext: { width: 220, height: 90 } });
        }
        details.getRow(dRow).height = 70;
        details.getRow(dRow + 1).height = 20;
        dRow += 3;
    }
    details.columns = [
        { width: 32 },
        { width: 20 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 32 },
        { width: 20 },
    ];

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
        row.getCell(4).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        row.height = 22;
        if (nivel === 0) {
            row.getCell(4).font = { bold: true };
        }
    };

    let totalDataRows = 0;
    for (const r of rows) {
        const detailRow = detailsStartById.get(Number(r.id)) ?? 1;
        const fechaTxt = r.fecha instanceof Date ? r.fecha.toISOString() : String(r.fecha ?? "");
        const general = [
            String(r.id),
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_id,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            fechaTxt,
            r.tipo_entrega,
            r.mensual,
            r.nombre_entrega,
            r.cedula_entrega,
            r.nombre_recibe,
            r.cedula_recibe,
        ];

        const rootRow = main.addRow([
            String(r.id),
            "",
            0,
            "Acta",
            ...general,
            "Ver detalle",
            "Ver firma entrega",
            "Ver firma recibe",
            "",
            "",
            "",
            "",
            "",
        ]);
        rootRow.getCell(COL_VER_DETALLE).value = { text: "Ver detalle", hyperlink: `#'Detalles'!A${detailRow}` };
        rootRow.getCell(COL_VER_FIRMA_ENTREGA).value = { text: "Ver firma entrega", hyperlink: `#'Detalles'!A${detailRow}` };
        rootRow.getCell(COL_VER_FIRMA_RECIBE).value = { text: "Ver firma recibe", hyperlink: `#'Detalles'!A${detailRow}` };
        rootRow.getCell(COL_VER_DETALLE).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(COL_VER_FIRMA_ENTREGA).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(COL_VER_FIRMA_RECIBE).font = { color: { argb: "FF0563C1" }, underline: true };
        styleDataRow(rootRow, 0);
        totalDataRows += 1;

        const detalleRows = parseDetalleArray(r.detalle);
        detalleRows.forEach((item, idx) => {
            const itemRow = main.addRow([
                `${r.id}.d${idx + 1}`,
                String(r.id),
                1,
                "Detalle producto",
                ...general,
                "",
                "",
                "",
                String(item.descripcion ?? ""),
                String(item.unidad_medida ?? ""),
                String(item.cantidad ?? ""),
                String(item.devolucion ?? ""),
                String(item.faltantes ?? ""),
            ]);
            styleDataRow(itemRow, 1);
            totalDataRows += 1;
        });
    }
    main.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, totalDataRows + 1), column: mainHeaders.length },
    };

    const ab = await workbook.xlsx.writeBuffer();
    return Buffer.from(ab);
}
