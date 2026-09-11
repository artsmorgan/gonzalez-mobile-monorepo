/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer, getImageDimensionsFromFile } from "./imageDimensions";

export type ProductoNoConformeModuleFilters = ActaEntregaModuleFilters & {
    /** Nombre del tipo (tabla `c_tipos_producto_no_conforme` / campo `tipo_servicio_no_conforme`). */
    tipoServicioNoConforme?: string | null;
};

export type ProductoNoConformeOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha_identificacion"
    | "tipo_servicio_no_conforme";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

/** En la hoja principal no se vuelca base64 largo; se indica referencia a «Firmas» o texto truncado. */
function previewFirmaResponsableOTextoLargo(v: unknown, maxChars = 400): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const head = s.slice(0, 120).replace(/\s+/g, "");
    if (
        s.startsWith("data:image/") ||
        (head.length >= 48 && /^[A-Za-z0-9+/=_-]+$/.test(head.slice(0, 48)) && s.length > 200)
    ) {
        return "[Firma o imagen — ver hoja «Firmas» o el registro en sistema]";
    }
    return excelCellString(s.length > maxChars ? `${s.slice(0, maxChars)}…` : s);
}

function fmtDateOnly(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function fmtDateTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
}

function normalizeSignatureDataUri(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

/** Alineado con actaEntregaProductos: evita "Invalid base64 input, bad content length" en Buffer / ExcelJS. */
function normalizeBase64Payload(raw: string): string {
    let b64 = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const mod = b64.length % 4;
    if (mod > 0) b64 = `${b64}${"=".repeat(4 - mod)}`;
    return b64;
}

function tryBufferFromSignatureBase64(normalizedB64: string): Buffer | null {
    if (!normalizedB64 || normalizedB64.length < 12) return null;
    try {
        const buf = Buffer.from(normalizedB64, "base64");
        if (!buf.length) return null;
        return buf;
    } catch {
        return null;
    }
}

function parseSignatureForExcel(dataUriOrBase64: string | null | undefined): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUriOrBase64 || String(dataUriOrBase64).trim() === "") return null;
    const s = String(dataUriOrBase64).trim();
    const asDataUri = s.startsWith("data:image/") ? s : `data:image/png;base64,${s}`;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]*)$/i.exec(asDataUri);
    let extension: "png" | "jpeg" = "png";
    let payload: string;
    if (m) {
        extension = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        payload = normalizeBase64Payload(String(m[2] ?? ""));
    } else {
        // data:image/webp u otro: intentar extraer tramo base64 si existe
        const any = /^data:image\/[^;]+;base64,([\s\S]*)$/i.exec(s);
        if (any) {
            payload = normalizeBase64Payload(String(any[1] ?? ""));
            extension = "png";
        } else {
            payload = normalizeBase64Payload(s.replace(/^data:image\/[^,]+,\s*/i, ""));
        }
    }
    if (!payload || payload.length < 16) return null;
    const buf = tryBufferFromSignatureBase64(payload);
    if (!buf || buf.length < 24) return null;
    return { extension, base64: payload };
}

/** `c_producto_no_conforme.created_by` almacena el id de `c_empleado` como texto (API móvil). */
function parseEmpleadoIdFromCreatedBy(raw: unknown): number | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function empleadoDisplayName(e: {
    codigo: string;
    nombre: string | null;
    primer_apellido: string | null;
    segundo_apellido: string | null;
}): string {
    const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    return full ? `${e.codigo} - ${full}` : e.codigo;
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

function mergeWide(ws: ExcelJS.Worksheet, r: number, c1: number, c2: number) {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

export function normalizeProductoNoConformeFilters(raw: unknown): ProductoNoConformeModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const tipo = String(o.tipoServicioNoConforme ?? o.tipo_servicio_no_conforme ?? "").trim();
    if (tipo && tipo !== "todos") {
        return { ...base, tipoServicioNoConforme: tipo };
    }
    return { ...base };
}

export function hasProductoNoConformeListModuleFiltersContent(f: ProductoNoConformeModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.tipoServicioNoConforme) return true;
    return false;
}

export function filtersMatchProductoNoConformeListQuery(parsedRowFilters: any, listModuleFilters?: ProductoNoConformeModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeProductoNoConformeFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (
        listModuleFilters.tipoServicioNoConforme &&
        String(saved.tipoServicioNoConforme || "") !== String(listModuleFilters.tipoServicioNoConforme)
    )
        return false;
    return true;
}

export async function queryProductoNoConformeRows(
    prisma: ReportDataAccess,
    filters: ProductoNoConformeModuleFilters,
    orderKey: ProductoNoConformeOrderKey,
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
    if (filters.tipoServicioNoConforme) where.tipo_servicio_no_conforme = filters.tipoServicioNoConforme;

    const rows = await prisma.c_producto_no_conforme.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const creadorIds = [
        ...new Set(rows.map((x: any) => parseEmpleadoIdFromCreatedBy(x.created_by)).filter((n): n is number => n != null)),
    ];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos, creadores] = await Promise.all([
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
        creadorIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: creadorIds } },
                  select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
              })
            : [],
    ]);
    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));
    const creadorById = new Map(creadores.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const empCreadorId = parseEmpleadoIdFromCreatedBy(r.created_by);
        const creador = empCreadorId != null ? creadorById.get(empCreadorId) : undefined;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            corpo_nro: corpo?.nro_sucursal != null ? String(corpo.nro_sucursal) : "",
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            created_at_txt: r.created_at instanceof Date ? fmtDateTime(r.created_at) : String(r.created_at ?? ""),
            created_by_nombre: creador ? empleadoDisplayName(creador) : excelCellString(r.created_by),
            fecha_identificacion_txt: fmtDateOnly(r.fecha_identificacion),
            fecha_solucion_txt: fmtDateOnly(r.fecha_solucion),
            firma_persona_identifico_pnc_data_uri: normalizeSignatureDataUri(r.firma_persona_identifico_pnc),
            firma_persona_origino_pnc_data_uri: normalizeSignatureDataUri(r.firma_persona_origino_pnc),
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
            case "tipo_servicio_no_conforme":
                return String(a.tipo_servicio_no_conforme ?? "").localeCompare(String(b.tipo_servicio_no_conforme ?? ""), "es");
            case "fecha_identificacion":
            default: {
                const ta = new Date(a.fecha_identificacion).getTime();
                const tb = new Date(b.fecha_identificacion).getTime();
                return tb - ta;
            }
        }
    });
}

async function appendPncFirmasBlock(
    wb: ExcelJS.Workbook,
    wsFir: ExcelJS.Worksheet,
    r: any,
    border: Partial<ExcelJS.Borders>,
    hdrFill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } },
    maxCol: number,
): Promise<{ rowIdentTitle: number; rowOrigTitle: number }> {
    const id = Number(r.id);
    const start = wsFir.rowCount + 1;
    mergeWide(wsFir, start, 1, maxCol);
    wsFir.getCell(start, 1).value = `Producto no conforme #${id} — ${excelCellString(r.cliente_nombre)}`;
    wsFir.getCell(start, 1).font = { bold: true, size: 11 };
    wsFir.getCell(start, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsFir.getCell(start, c).border = border;

    let rr = start + 1;
    mergeWide(wsFir, rr, 1, maxCol);
    wsFir.getCell(rr, 1).value = "Firma — Persona que identificó PNC";
    wsFir.getCell(rr, 1).font = { bold: true, size: 10 };
    wsFir.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsFir.getCell(rr, c).border = border;
    const rowIdentTitle = rr;
    rr += 1;
    const sigI = parseSignatureForExcel(r.firma_persona_identifico_pnc);
    mergeWide(wsFir, rr, 1, maxCol);
    if (sigI) {
        try {
            const buf = tryBufferFromSignatureBase64(sigI.base64);
            if (!buf) {
                wsFir.getCell(rr, 1).value = "— Firma no válida —";
            } else {
                const imgId = wb.addImage({ buffer: buf as any, extension: sigI.extension });
                wsFir.getRow(rr).height = 100;
                const nat = getImageDimensionsFromBuffer(buf);
                const nw = nat?.width ?? 280;
                const nh = nat?.height ?? 90;
                const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 320, 96);
                wsFir.addImage(imgId, { tl: { col: 0.35, row: rr - 1 + 0.04 }, ext: { width: dw, height: dh } } as any);
            }
        } catch {
            wsFir.getCell(rr, 1).value = "— Firma no válida —";
        }
    } else {
        wsFir.getCell(rr, 1).value = "— Sin firma —";
    }
    for (let c = 1; c <= maxCol; c++) wsFir.getCell(rr, c).border = border;
    rr += 1;

    mergeWide(wsFir, rr, 1, maxCol);
    wsFir.getCell(rr, 1).value = "Firma — Persona que originó PNC";
    wsFir.getCell(rr, 1).font = { bold: true, size: 10 };
    wsFir.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsFir.getCell(rr, c).border = border;
    const rowOrigTitle = rr;
    rr += 1;
    const sigO = parseSignatureForExcel(r.firma_persona_origino_pnc);
    mergeWide(wsFir, rr, 1, maxCol);
    if (sigO) {
        try {
            const buf = tryBufferFromSignatureBase64(sigO.base64);
            if (!buf) {
                wsFir.getCell(rr, 1).value = "— Firma no válida —";
            } else {
                const imgId = wb.addImage({ buffer: buf as any, extension: sigO.extension });
                wsFir.getRow(rr).height = 100;
                const nat = getImageDimensionsFromBuffer(buf);
                const nw = nat?.width ?? 280;
                const nh = nat?.height ?? 90;
                const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 320, 96);
                wsFir.addImage(imgId, { tl: { col: 0.35, row: rr - 1 + 0.04 }, ext: { width: dw, height: dh } } as any);
            }
        } catch {
            wsFir.getCell(rr, 1).value = "— Firma no válida —";
        }
    } else {
        wsFir.getCell(rr, 1).value = "— Sin firma —";
    }
    for (let c = 1; c <= maxCol; c++) wsFir.getCell(rr, c).border = border;
    rr += 1;
    wsFir.addRow([]);
    return { rowIdentTitle, rowOrigTitle };
}

const HDR_MAIN = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } } as const;
/** Cabecera hoja principal en reportes consolidados (Mutuos, Llaves, …). */ // Consolidado
const GRP_HDR_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

export async function buildProductoNoConformeExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("c_producto_no_conforme");
    const wsFir = wb.addWorksheet("Firmas");
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const maxCol = 4;
    const anchorIdentById = new Map<number, number>();
    const anchorOrigById = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of descRows) {
        const { rowIdentTitle, rowOrigTitle } = await appendPncFirmasBlock(wb, wsFir, r, border, GRP_HDR_FILL, maxCol);
        anchorIdentById.set(Number(r.id), rowIdentTitle);
        anchorOrigById.set(Number(r.id), rowOrigTitle);
    }

    /** Orden alineado al modelo; «Creado en / por» después de «Fecha solución». */
    const headers = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal / corpo",
        "Puesto",
        "Fecha identificación",
        "Responsable de la cuenta",
        "Tipo servicio no conforme",
        "Persona que identificó PNC",
        "Descripción",
        "Persona que originó PNC",
        "Acción implementada",
        "Fecha solución",
        "Creado en",
        "Creado por",
        "Responsable aprobar acción",
        "Firma responsable",
        "Firma identificó PNC",
        "Firma originó PNC",
    ];
    const colWidths = [9, 28, 28, 24, 28, 28, 24, 16, 22, 26, 24, 40, 24, 36, 14, 20, 28, 36, 36, 22, 22];
    const colLinkIdent = headers.length - 1;
    const colLinkOrig = headers.length;

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR_FILL;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = colWidths.map((w) => ({ width: w, outlineLevel: 1 }));

    for (const r of rows) {
        const ri = anchorIdentById.get(Number(r.id)) ?? 1;
        const ro = anchorOrigById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            Number(r.id),
            excelCellString(r.empresa_nombre),
            excelCellString(r.cliente_nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.corpo_nombre),
            excelCellString(r.puesto_nombre),
            excelCellString(r.fecha_identificacion_txt),
            excelCellString(r.responsable_cuenta),
            excelCellString(r.tipo_servicio_no_conforme),
            excelCellString(r.persona_identifico_pnc),
            excelCellString(r.descripcion),
            excelCellString(r.persona_origino_pnc),
            excelCellString(r.accion_implementada),
            excelCellString(r.fecha_solucion_txt),
            excelCellString(r.created_at_txt),
            excelCellString(r.created_by_nombre ?? r.created_by),
            excelCellString(r.responsable_aprobar),
            previewFirmaResponsableOTextoLargo(r.firma_responsable),
            "",
            "",
        ]);
        row.getCell(colLinkIdent).value = { text: "Ver firma", hyperlink: `#'Firmas'!A${ri}` };
        row.getCell(colLinkIdent).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(colLinkOrig).value = { text: "Ver firma", hyperlink: `#'Firmas'!A${ro}` };
        row.getCell(colLinkOrig).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    for (let c = 1; c <= maxCol; c++) wsFir.getColumn(c).width = c === 1 ? 48 : 14;
    return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Una hoja, cabecera tipo formulario y tabla desde fila 4 (A1:M2 cabecera + A3:M3 separador). */
export async function buildProductoNoConformeExcelIndividual(rows: any[], reportNombre?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Registro PNC");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
    };
    const borderRightDark: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
    };
    const fillWhite = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
    const titleFill = HDR_MAIN;

    ws.columns = [6, 22, 24, 12, 22, 24, 24, 16, 38, 24, 34, 14, 28].map((w) => ({ width: w }));

    ws.getRow(1).height = 40;
    ws.getRow(2).height = 40;
    ws.getRow(3).height = 14;

    ws.mergeCells(1, 1, 2, 4);
    ws.mergeCells(1, 5, 2, 11);
    ws.mergeCells(1, 12, 2, 13);
    ws.mergeCells(3, 1, 3, 13);

    ws.getCell(1, 1).fill = fillWhite;
    ws.getCell(1, 5).fill = titleFill;
    ws.getCell(1, 12).fill = fillWhite;
    ws.getCell(3, 1).fill = fillWhite;

    ws.getCell(1, 5).value = "Registro de producto no conforme";
    ws.getCell(1, 5).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getCell(1, 5).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    const nombreTop = String(reportNombre ?? "").trim();
    ws.getCell(1, 12).value = nombreTop;
    ws.getCell(1, 12).font = { bold: true, size: 10, color: { argb: "FF000000" } };
    ws.getCell(1, 12).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    for (let r = 1; r <= 2; r++) {
        for (let c = 1; c <= 13; c++) {
            ws.getCell(r, c).border = borderThin as ExcelJS.Borders;
        }
    }

    ws.getCell(3, 1).value = null;
    ws.getCell(3, 1).border = borderRightDark as ExcelJS.Borders;

    const firstEmpresaId = rows.length ? Number(rows[0].empresa_id) : 0;
    const logoPath = await resolveLogoPathByEmpresaId(firstEmpresaId);
    if (logoPath) {
        try {
            const ext = path.extname(logoPath).toLowerCase() === ".png" ? "png" : "jpeg";
            const imgId = wb.addImage({ filename: logoPath, extension: ext as "png" | "jpeg" });
            const original = await getImageDimensionsFromFile(logoPath);
            const ow = original?.width ?? 200;
            const oh = original?.height ?? 80;
            const { width: dw, height: dh } = fitImageExtInsideBox(ow, oh, 300, 76);
            ws.addImage(imgId, { tl: { col: 0.06, row: 0.04 }, ext: { width: dw, height: dh }, editAs: "oneCell" });
        } catch {
            /* ignore */
        }
    }

    const hdrs = [
        "#",
        "Cliente",
        "Sociedad",
        "# de Corpo",
        "Responsable de la cuenta",
        "Tipo de Servicio No Conforme",
        "Persona que identificó PNC",
        "Fecha de identificación",
        "Descripción de la No Conformidad",
        "Persona que originó el PNC",
        "Acción implementada",
        "Fecha de Solución",
        "Responsable de aprobar la acción",
    ];
    const hr = 4;
    ws.getRow(hr).height = 36;
    for (let c = 1; c <= 13; c++) {
        const cell = ws.getCell(hr, c);
        cell.value = hdrs[c - 1];
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = titleFill;
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    let n = 0;
    for (const r of rows) {
        n += 1;
        const data = ws.addRow([
            n,
            excelCellString(r.cliente_nombre),
            excelCellString(r.empresa_nombre),
            excelCellString(r.corpo_nro || r.corpo_nombre),
            excelCellString(r.responsable_cuenta),
            excelCellString(r.tipo_servicio_no_conforme),
            excelCellString(r.persona_identifico_pnc),
            excelCellString(r.fecha_identificacion_txt),
            excelCellString(r.descripcion),
            excelCellString(r.persona_origino_pnc),
            excelCellString(r.accion_implementada),
            excelCellString(r.fecha_solucion_txt),
            excelCellString(r.responsable_aprobar),
        ]);
        data.eachCell((cell) => {
            cell.border = borderThin;
            cell.alignment = { vertical: "top", wrapText: true };
        });
    }

    ws.views = [{ state: "frozen", ySplit: hr }];

    return Buffer.from(await wb.xlsx.writeBuffer());
}
