/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer, getImageDimensionsFromFile } from "./imageDimensions";

export type InduccionRecorridoModuleFilters = ActaEntregaModuleFilters & {
    responsableEmpleadoIds?: number[];
    empleadoIds?: number[];
    participanteCedulas?: string[];
};

export type InduccionRecorridoOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

function toValidIds(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

function parseParticipanteCedulas(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    const out = v
        .map((x) => String(x ?? "").trim())
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/\s+/g, ""));
    return [...new Set(out)];
}

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

function safeParseJsonArray(raw: string | null | undefined): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const v = JSON.parse(String(raw));
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function rowMatchesParticipanteCedulas(participantesJson: string | null | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const arr = safeParseJsonArray(participantesJson ?? undefined);
    const cedulas = arr
        .map((p: any) => String(p?.cedula ?? "").trim().replace(/\s+/g, ""))
        .filter((c: string) => c.length > 0);
    return needles.some((needle) => {
        const n = needle.trim().replace(/\s+/g, "").toLowerCase();
        if (!n) return false;
        return cedulas.some((c) => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
    });
}

export function normalizeInduccionRecorridoFilters(raw: unknown): InduccionRecorridoModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const resp = toValidIds(o.responsableEmpleadoIds);
    const emp = toValidIds(o.empleadoIds);
    const ceds = parseParticipanteCedulas(o.participanteCedulas);
    return {
        ...base,
        ...(resp.length ? { responsableEmpleadoIds: resp } : {}),
        ...(emp.length ? { empleadoIds: emp } : {}),
        ...(ceds.length ? { participanteCedulas: ceds } : {}),
    };
}

export function hasInduccionRecorridoListModuleFiltersContent(f: InduccionRecorridoModuleFilters): boolean {
    if (hasActaContent(f)) return true;
    if (f.responsableEmpleadoIds?.length || f.empleadoIds?.length) return true;
    if (f.participanteCedulas?.length) return true;
    return false;
}

function hasActaContent(f: ActaEntregaModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchInduccionRecorridoListQuery(parsedRowFilters: any, listModuleFilters?: InduccionRecorridoModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeInduccionRecorridoFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.responsableEmpleadoIds ?? undefined, saved.responsableEmpleadoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empleadoIds ?? undefined, saved.empleadoIds ?? undefined)) return false;
    const lp = listModuleFilters.participanteCedulas ?? [];
    const sp = saved.participanteCedulas ?? [];
    if (lp.length) {
        if (!sp.length) return false;
        const setS = new Set(sp.map((x) => String(x).toLowerCase().trim()));
        for (const c of lp) {
            const k = String(c).toLowerCase().trim();
            if (!k || !setS.has(k)) return false;
        }
    }
    return true;
}

export async function queryInduccionRecorridoRows(
    prisma: ReportDataAccess,
    filters: InduccionRecorridoModuleFilters,
    orderKey: InduccionRecorridoOrderKey,
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
    if (filters.responsableEmpleadoIds?.length) {
        where.created_by = { in: filters.responsableEmpleadoIds.map((id) => String(id)) };
    }
    if (filters.empleadoIds?.length) where.empleado_id = { in: filters.empleadoIds };

    let rows = await prisma.c_registro_induccion_recorrido.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    if (filters.participanteCedulas?.length) {
        rows = rows.filter((r: any) => rowMatchesParticipanteCedulas(r.participantes, filters.participanteCedulas!));
    }

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const creadorIds = [...new Set(rows.map((x: any) => parseEmpleadoIdFromCreatedBy(x.created_by)).filter((n): n is number => n != null))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds, plazaIds, empleadoIds] = [
        ids(rows.map((x: any) => x.empresa_id)),
        ids(rows.map((x: any) => x.cliente_id)),
        ids(rows.map((x: any) => x.division_id)),
        ids(rows.map((x: any) => x.contrato_id)),
        ids(rows.map((x: any) => x.corpo_id)),
        ids(rows.map((x: any) => x.puesto_id)),
        ids(rows.map((x: any) => x.plaza_id)),
        ids(rows.map((x: any) => x.empleado_id)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos, plazas, empleados, creadores] = await Promise.all([
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
        plazaIds.length
            ? prisma.e_estructura_plazas.findMany({
                  where: { id: { in: plazaIds } },
                  select: { id: true, nombre: true, codigo_plaza: true, nro_plaza: true },
              })
            : [],
        empleadoIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: empleadoIds } },
                  select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
              })
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
    const plazaById = new Map(plazas.map((x) => [x.id, x]));
    const empleadoById = new Map(empleados.map((x) => [x.id, x]));
    const creadorById = new Map(creadores.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const plaza = plazaById.get(Number(r.plaza_id));
        const empleado = empleadoById.get(Number(r.empleado_id));
        const empCreadorId = parseEmpleadoIdFromCreatedBy(r.created_by);
        const creador = empCreadorId != null ? creadorById.get(empCreadorId) : undefined;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id ?? ""),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            plaza_nombre: plaza
                ? [plaza.nro_plaza != null ? String(plaza.nro_plaza) : "", plaza.codigo_plaza, plaza.nombre].filter(Boolean).join(" - ")
                : String(r.plaza_id ?? ""),
            empleado_txt: empleado ? empleadoDisplayName(empleado) : String(r.empleado_id),
            created_at_txt: r.created_at instanceof Date ? fmtDateTime(r.created_at) : String(r.created_at ?? ""),
            fecha_txt: fmtDateOnly(r.fecha),
            created_by_nombre: creador ? empleadoDisplayName(creador) : excelCellString(r.created_by),
            firma_supervisor_data_uri: normalizeSignatureDataUri(r.firma_supervisor),
            firma_empleado_data_uri: normalizeSignatureDataUri(r.firma_empleado),
            firma_responsable_data_uri: normalizeSignatureDataUri(r.firma_responsable),
        };
    });

    const sortFn = (a: any, b: any) => {
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
    };
    return [...enriched].sort(sortFn);
}

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const HDR_MAIN = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};
const thickBlack: Partial<ExcelJS.Border> = { style: "thick", color: { argb: "FF000000" } };
const thinBlack: ExcelJS.Border = { style: "thin", color: { argb: "FF000000" } };
const whiteFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

function applyThickOuterRect(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const p = (cell.border || {}) as ExcelJS.Borders;
            cell.border = {
                top: r === r1 ? thickBlack : p.top,
                bottom: r === r2 ? thickBlack : p.bottom,
                left: c === c1 ? thickBlack : p.left,
                right: c === c2 ? thickBlack : p.right,
            };
        }
    }
}

/** Borde exterior grueso en B..N / r1..r2; línea inferior fina solo en E..N (no en B:D etiquetas). */
function applyInduccionIndividualInfoFrame(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, rDividerEnd: number, valueColStart: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = {};
        }
    }
    applyThickOuterRect(ws, r1, c1, r2, c2);
    for (let r = r1; r <= rDividerEnd; r++) {
        for (let c = valueColStart; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const p = (cell.border || {}) as ExcelJS.Borders;
            cell.border = {
                ...p,
                bottom: thinBlack,
            };
        }
    }
}

function applyThickOuterRectA1N1(ws: ExcelJS.Worksheet) {
    applyThickOuterRect(ws, 1, 1, 1, 14);
}

function applyWhiteFillRect(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).fill = whiteFill;
        }
    }
}

async function appendDetalleBlocks(
    wb: ExcelJS.Workbook,
    wsDet: ExcelJS.Worksheet,
    r: any,
    hdrFill: typeof GRP_HDR,
    maxCol: number,
): Promise<{ rt: number; ra: number; rp: number; rs: number }> {
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const start = wsDet.rowCount + 1;
    mergeWide(wsDet, start, 1, maxCol);
    wsDet.getCell(start, 1).value = `Registro inducción #${r.id} — ${excelCellString(r.cliente_nombre)}`;
    wsDet.getCell(start, 1).font = { bold: true, size: 12 };
    wsDet.getCell(start, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(start, c).border = border;

    let rr = start + 1;
    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Temas desarrollados";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    const rowTemasTitle = rr;
    rr += 1;
    const h1 = wsDet.addRow(["#", "Tema", "Respuesta (SI/NO/NA)", "Comentarios"]);
    h1.font = { bold: true };
    h1.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
    });
    const temas = safeParseJsonArray(r.temas_desarrollados);
    let idx = 0;
    for (const t of temas) {
        idx += 1;
        const row = wsDet.addRow([idx, excelCellString(t?.tema), excelCellString(t?.respuesta), excelCellString(t?.comentarios)]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { wrapText: true, vertical: "top" };
        });
    }
    if (temas.length === 0) {
        const row = wsDet.addRow(["—", "Sin datos", "", ""]);
        row.eachCell((cell) => {
            cell.border = border;
        });
    }
    rr = wsDet.rowCount + 1;

    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Aspectos específicos por contrato";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    const rowAspTitle = rr;
    rr += 1;
    const h2 = wsDet.addRow(["#", "Aspecto", "Respuesta (SI/NO/NA)", "Comentarios"]);
    h2.font = { bold: true };
    h2.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
    });
    const asp = safeParseJsonArray(r.aspectos_especificos);
    idx = 0;
    for (const t of asp) {
        idx += 1;
        const row = wsDet.addRow([idx, excelCellString(t?.aspecto), excelCellString(t?.respuesta), excelCellString(t?.comentarios)]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { wrapText: true, vertical: "top" };
        });
    }
    if (asp.length === 0) {
        const row = wsDet.addRow(["—", "Sin datos", "", ""]);
        row.eachCell((cell) => {
            cell.border = border;
        });
    }
    rr = wsDet.rowCount + 1;

    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Participantes";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    const rowPartTitle = rr;
    rr += 1;
    const h3 = wsDet.addRow(["#", "Nombre completo", "Cédula", "Firma"]);
    h3.font = { bold: true };
    h3.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
    });
    const parts = safeParseJsonArray(r.participantes);
    idx = 0;
    for (const p of parts) {
        idx += 1;
        const excelRow = wsDet.addRow([idx, excelCellString(p?.nombre_completo), excelCellString(p?.cedula), ""]);
        excelRow.height = 72;
        excelRow.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { wrapText: true, vertical: "middle" };
        });
        const sig = parseSignatureForExcel(p?.firma);
        if (sig) {
            try {
                const buf = tryBufferFromSignatureBase64(sig.base64);
                if (buf) {
                    const imgId = wb.addImage({ buffer: buf as any, extension: sig.extension });
                    const nat = getImageDimensionsFromBuffer(buf);
                    const nw = nat?.width ?? 200;
                    const nh = nat?.height ?? 60;
                    const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 220, 64);
                    wsDet.addImage(imgId, {
                        tl: { col: 3 + 0.05, row: excelRow.number - 1 + 0.02 },
                        ext: { width: dw, height: dh },
                    } as any);
                }
            } catch {
                wsDet.getCell(excelRow.number, 4).value = "—";
            }
        }
    }
    if (parts.length === 0) {
        const row = wsDet.addRow(["—", "Sin participantes", "", ""]);
        row.eachCell((cell) => {
            cell.border = border;
        });
    }
    rr = wsDet.rowCount + 1;

    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Firma supervisor";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    const rowSupTitle = rr;
    rr += 1;
    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getRow(rr).height = 100;
    const sigS = parseSignatureForExcel(r.firma_supervisor);
    if (sigS) {
        try {
            const buf = tryBufferFromSignatureBase64(sigS.base64);
            if (buf) {
                const imgId = wb.addImage({ buffer: buf as any, extension: sigS.extension });
                const nat = getImageDimensionsFromBuffer(buf);
                const nw = nat?.width ?? 280;
                const nh = nat?.height ?? 90;
                const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 400, 88);
                wsDet.addImage(imgId, { tl: { col: 0.3, row: rr - 1 + 0.04 }, ext: { width: dw, height: dh } } as any);
            }
        } catch {
            wsDet.getCell(rr, 1).value = "— Sin firma —";
        }
    } else {
        wsDet.getCell(rr, 1).value = "— Sin firma —";
    }
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    rr += 1;

    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getCell(rr, 1).value = "Firma empleado (evaluado)";
    wsDet.getCell(rr, 1).font = { bold: true };
    wsDet.getCell(rr, 1).fill = hdrFill;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    rr += 1;
    mergeWide(wsDet, rr, 1, maxCol);
    wsDet.getRow(rr).height = 100;
    const sigE = parseSignatureForExcel(r.firma_empleado);
    if (sigE) {
        try {
            const buf = tryBufferFromSignatureBase64(sigE.base64);
            if (buf) {
                const imgId = wb.addImage({ buffer: buf as any, extension: sigE.extension });
                const nat = getImageDimensionsFromBuffer(buf);
                const nw = nat?.width ?? 280;
                const nh = nat?.height ?? 90;
                const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 400, 88);
                wsDet.addImage(imgId, { tl: { col: 0.3, row: rr - 1 + 0.04 }, ext: { width: dw, height: dh } } as any);
            }
        } catch {
            wsDet.getCell(rr, 1).value = "— Sin firma —";
        }
    } else {
        wsDet.getCell(rr, 1).value = "— Sin firma —";
    }
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rr, c).border = border;
    wsDet.addRow([]);
    return { rt: rowTemasTitle, ra: rowAspTitle, rp: rowPartTitle, rs: rowSupTitle };
}

export async function buildInduccionRecorridoExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Inducción recorrido");
    const wsDet = wb.addWorksheet("Detalles");
    const maxCol = 4;
    const anchorTemas = new Map<number, number>();
    const anchorAsp = new Map<number, number>();
    const anchorPart = new Map<number, number>();
    const anchorSup = new Map<number, number>();

    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        const a = await appendDetalleBlocks(wb, wsDet, r, GRP_HDR, maxCol);
        anchorTemas.set(Number(r.id), a.rt);
        anchorAsp.set(Number(r.id), a.ra);
        anchorPart.set(Number(r.id), a.rp);
        anchorSup.set(Number(r.id), a.rs);
    }

    /** Cuadrícula jerárquica: Registro (nivel 0) → Tema / Aspecto / Participante, hermanos (nivel 1). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Registro",
        "Creado en",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Plaza",
        "Fecha (visita)",
        "Renglón / edificio",
        "Supervisor cliente",
        "Supervisor corporación",
        "División (texto)",
        "Empleado",
        "Responsable (creado por)",
        "Ver temas",
        "Ver aspectos",
        "Ver participantes",
        "Ver firma supervisor",
        "Tema",
        "Respuesta (tema)",
        "Comentarios (tema)",
        "Aspecto",
        "Respuesta (aspecto)",
        "Comentarios (aspecto)",
        "Nombre completo (participante)",
        "Cédula (participante)",
    ];
    const c1 = headers.indexOf("Ver temas") + 1;
    const c2 = headers.indexOf("Ver aspectos") + 1;
    const c3 = headers.indexOf("Ver participantes") + 1;
    const c4 = headers.indexOf("Ver firma supervisor") + 1;
    const COL_TIPO_FILA = headers.indexOf("Tipo de fila") + 1;
    const linkCols = new Set([c1, c2, c3, c4]);

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin as ExcelJS.Borders;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = headers.map((lab) => {
        if (lab.includes("Renglón") || lab.includes("Supervisor")) return { width: 28 };
        if (lab.startsWith("Ver")) return { width: 16 };
        return { width: 22 };
    });

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell, col) => {
            cell.border = borderThin as ExcelJS.Borders;
            if (!linkCols.has(col)) cell.alignment = { vertical: "middle", wrapText: true };
        });
        row.getCell(COL_TIPO_FILA).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(COL_TIPO_FILA).font = { bold: true };
    };

    for (const r of rows) {
        const rt = anchorTemas.get(Number(r.id)) ?? 1;
        const ra = anchorAsp.get(Number(r.id)) ?? 1;
        const rp = anchorPart.get(Number(r.id)) ?? 1;
        const rs = anchorSup.get(Number(r.id)) ?? 1;
        const general: Record<number, unknown> = {
            [headers.indexOf("ID Registro") + 1]: r.id,
            [headers.indexOf("Creado en") + 1]: r.created_at_txt,
            [headers.indexOf("Empresa") + 1]: r.empresa_nombre,
            [headers.indexOf("Cliente") + 1]: r.cliente_nombre,
            [headers.indexOf("División") + 1]: r.division_nombre,
            [headers.indexOf("Contrato") + 1]: r.contrato_nombre,
            [headers.indexOf("Sucursal") + 1]: r.corpo_nombre,
            [headers.indexOf("Puesto") + 1]: r.puesto_nombre,
            [headers.indexOf("Plaza") + 1]: r.plaza_nombre,
            [headers.indexOf("Fecha (visita)") + 1]: r.fecha_txt,
            [headers.indexOf("Renglón / edificio") + 1]: excelCellString(r.renglon_edificio),
            [headers.indexOf("Supervisor cliente") + 1]: excelCellString(r.supervisor_cliente),
            [headers.indexOf("Supervisor corporación") + 1]: excelCellString(r.supervisor_corporacion),
            [headers.indexOf("División (texto)") + 1]: excelCellString(r.division),
            [headers.indexOf("Empleado") + 1]: r.empleado_txt,
            [headers.indexOf("Responsable (creado por)") + 1]: r.created_by_nombre,
        };

        const rootValues = new Array(headers.length).fill("");
        rootValues[0] = String(r.id);
        rootValues[2] = 0;
        rootValues[3] = "Registro";
        for (const [col, val] of Object.entries(general)) rootValues[Number(col) - 1] = val;
        const rootRow = wsMain.addRow(rootValues);
        rootRow.getCell(c1).value = { text: "Ver", hyperlink: `#'Detalles'!A${rt}` };
        rootRow.getCell(c1).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(c2).value = { text: "Ver", hyperlink: `#'Detalles'!A${ra}` };
        rootRow.getCell(c2).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(c3).value = { text: "Ver", hyperlink: `#'Detalles'!A${rp}` };
        rootRow.getCell(c3).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(c4).value = { text: "Ver", hyperlink: `#'Detalles'!A${rs}` };
        rootRow.getCell(c4).font = { color: { argb: "FF0563C1" }, underline: true };
        styleDataRow(rootRow, 0);

        safeParseJsonArray(r.temas_desarrollados).forEach((t: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.tema${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Tema";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Tema")] = excelCellString(t?.tema);
            values[headers.indexOf("Respuesta (tema)")] = excelCellString(t?.respuesta);
            values[headers.indexOf("Comentarios (tema)")] = excelCellString(t?.comentarios);
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });

        safeParseJsonArray(r.aspectos_especificos).forEach((a: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.asp${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Aspecto";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Aspecto")] = excelCellString(a?.aspecto);
            values[headers.indexOf("Respuesta (aspecto)")] = excelCellString(a?.respuesta);
            values[headers.indexOf("Comentarios (aspecto)")] = excelCellString(a?.comentarios);
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });

        safeParseJsonArray(r.participantes).forEach((p: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.part${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Participante";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Nombre completo (participante)")] = excelCellString(p?.nombre_completo);
            values[headers.indexOf("Cédula (participante)")] = excelCellString(p?.cedula);
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });
    }
    for (let c = 1; c <= maxCol; c++) wsDet.getColumn(c).width = c === 2 ? 48 : 14;
    return Buffer.from(await wb.xlsx.writeBuffer());
}

function safeSheetName(name: string): string {
    const s = name.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
    return s || "Registro";
}

async function buildOneInduccionSheet(wb: ExcelJS.Workbook, r: any, reportNombre: string): Promise<void> {
    const ws = wb.addWorksheet(safeSheetName(`R${r.id}`));
    const nCol = 14;
    ws.columns = Array.from({ length: nCol }, () => ({ width: 10 }));
    ws.getColumn(1).width = 4.5;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 10;
    for (let c = 4; c <= 10; c++) ws.getColumn(c).width = 11;
    ws.getColumn(11).width = 6;
    ws.getColumn(12).width = 6;
    ws.getColumn(13).width = 6;
    ws.getColumn(14).width = 14;

    const row1Height = 72;
    ws.getRow(1).height = row1Height;

    ws.mergeCells(1, 1, 1, 3);
    ws.mergeCells(1, 4, 1, 10);
    ws.mergeCells(1, 11, 1, 14);

    for (let c = 1; c <= 3; c++) {
        const cell = ws.getCell(1, c);
        cell.fill = whiteFill;
    }
    ws.getCell(1, 4).value = "Registro de inducción y recorrido al misceláneo";
    ws.getCell(1, 4).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    ws.getCell(1, 4).fill = HDR_MAIN;
    ws.getCell(1, 4).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let c = 5; c <= 10; c++) {
        ws.getCell(1, c).fill = HDR_MAIN;
    }
    ws.getCell(1, 11).value = excelCellString(reportNombre);
    ws.getCell(1, 11).font = { bold: true, size: 9 };
    ws.getCell(1, 11).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let c = 11; c <= 14; c++) {
        ws.getCell(1, c).fill = whiteFill;
    }

    const logoPath = await resolveLogoPathByEmpresaId(Number(r.empresa_id));
    if (logoPath) {
        try {
            const ext = path.extname(logoPath).toLowerCase() === ".png" ? "png" : "jpeg";
            const imgId = wb.addImage({ filename: logoPath, extension: ext as "png" | "jpeg" });
            const original = await getImageDimensionsFromFile(logoPath);
            const ow = original?.width ?? 200;
            const oh = original?.height ?? 80;
            const { width: dw, height: dh } = fitImageExtInsideBox(ow, oh, 220, row1Height - 8);
            ws.addImage(imgId, { tl: { col: 0.02, row: 0.02 }, ext: { width: dw, height: dh }, editAs: "oneCell" });
        } catch {
            /* ignore */
        }
    }

    const putInfoRow = (r0: number, label: string, value: string) => {
        ws.mergeCells(r0, 2, r0, 4);
        ws.getCell(r0, 2).value = label;
        ws.getCell(r0, 2).font = { bold: true };
        ws.getCell(r0, 2).alignment = { vertical: "middle", wrapText: true };
        ws.mergeCells(r0, 5, r0, 14);
        ws.getCell(r0, 5).value = value;
        ws.getCell(r0, 5).alignment = { vertical: "middle", wrapText: true };
    };
    putInfoRow(3, "Fecha", r.fecha_txt);
    putInfoRow(4, "Renglón o edificio", excelCellString(r.renglon_edificio));
    putInfoRow(5, "Supervisor del cliente", excelCellString(r.supervisor_cliente));
    putInfoRow(6, "Supervisor de corporación", excelCellString(r.supervisor_corporacion));
    ws.mergeCells(7, 2, 7, 14);
    ws.getRow(7).height = 10;

    applyInduccionIndividualInfoFrame(ws, 3, 2, 7, 14, 6, 5);

    let row = 9;
    ws.getRow(8).height = 8;

    ws.mergeCells(row, 2, row, 10);
    ws.getCell(row, 2).value = "Temas desarrollados en el recorrido e inducción al empleado";
    ws.getCell(row, 2).font = { bold: true };
    ws.getCell(row, 2).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(row, 11).value = "SI";
    ws.getCell(row, 12).value = "NO";
    ws.getCell(row, 13).value = "NA";
    ws.getCell(row, 14).value = "Comentarios";
    for (let c = 2; c <= 14; c++) {
        ws.getCell(row, c).fill = whiteFill;
        ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
        ws.getCell(row, c).font = { ...(ws.getCell(row, c).font || {}), bold: true };
    }
    row += 1;
    const temas = safeParseJsonArray(r.temas_desarrollados);
    let n = 0;
    for (const t of temas) {
        n += 1;
        ws.getCell(row, 1).value = n;
        ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "top" };
        ws.getCell(row, 1).border = { right: thinBlack };
        ws.mergeCells(row, 2, row, 10);
        ws.getCell(row, 2).value = excelCellString(t?.tema);
        ws.getCell(row, 11).value = String(t?.respuesta ?? "").toUpperCase() === "SI" ? "X" : "";
        ws.getCell(row, 12).value = String(t?.respuesta ?? "").toUpperCase() === "NO" ? "X" : "";
        ws.getCell(row, 13).value = String(t?.respuesta ?? "").toUpperCase() === "NA" ? "X" : "";
        ws.getCell(row, 14).value = excelCellString(t?.comentarios);
        ws.getCell(row, 2).border = borderThin as ExcelJS.Borders;
        for (let c = 11; c <= 14; c++) ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
        ws.getRow(row).height = 28;
        row += 1;
    }

    row += 1;
    ws.mergeCells(row, 2, row, 10);
    ws.getCell(row, 2).value = "Aspectos Específicos por Contrato";
    ws.getCell(row, 2).font = { bold: true };
    ws.getCell(row, 2).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(row, 11).value = "SI";
    ws.getCell(row, 12).value = "NO";
    ws.getCell(row, 13).value = "NA";
    ws.getCell(row, 14).value = "Comentarios";
    for (let c = 2; c <= 14; c++) {
        ws.getCell(row, c).fill = whiteFill;
        ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
        ws.getCell(row, c).font = { ...(ws.getCell(row, c).font || {}), bold: true };
    }
    row += 1;
    const asp = safeParseJsonArray(r.aspectos_especificos);
    n = 0;
    for (const t of asp) {
        n += 1;
        ws.getCell(row, 1).value = n;
        ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "top" };
        ws.getCell(row, 1).border = { right: thinBlack };
        ws.mergeCells(row, 2, row, 10);
        ws.getCell(row, 2).value = excelCellString(t?.aspecto);
        ws.getCell(row, 11).value = String(t?.respuesta ?? "").toUpperCase() === "SI" ? "X" : "";
        ws.getCell(row, 12).value = String(t?.respuesta ?? "").toUpperCase() === "NO" ? "X" : "";
        ws.getCell(row, 13).value = String(t?.respuesta ?? "").toUpperCase() === "NA" ? "X" : "";
        ws.getCell(row, 14).value = excelCellString(t?.comentarios);
        ws.getCell(row, 2).border = borderThin as ExcelJS.Borders;
        for (let c = 11; c <= 14; c++) ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
        row += 1;
    }

    row += 2;
    ws.mergeCells(row, 3, row, 7);
    ws.getCell(row, 3).value = "Nombre Completo";
    ws.mergeCells(row, 8, row, 10);
    ws.getCell(row, 8).value = "Firma";
    ws.mergeCells(row, 11, row, 13);
    ws.getCell(row, 11).value = "Cédula";
    for (const c of [3, 8, 11]) {
        ws.getCell(row, c).font = { bold: true };
        ws.getCell(row, c).fill = whiteFill;
        ws.getCell(row, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    for (let c = 3; c <= 13; c++) ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
    row += 1;
    const parts = safeParseJsonArray(r.participantes);
    for (const p of parts) {
        ws.mergeCells(row, 3, row, 7);
        ws.getCell(row, 3).value = excelCellString(p?.nombre_completo);
        ws.mergeCells(row, 8, row, 10);
        ws.getCell(row, 8).value = "";
        ws.mergeCells(row, 11, row, 13);
        ws.getCell(row, 11).value = excelCellString(p?.cedula);
        ws.getRow(row).height = 56;
        for (let c = 3; c <= 13; c++) ws.getCell(row, c).border = borderThin as ExcelJS.Borders;
        if (p?.firma) {
            const sig = parseSignatureForExcel(p.firma);
            if (sig) {
                try {
                    const buf = tryBufferFromSignatureBase64(sig.base64);
                    if (buf) {
                        const imgId = wb.addImage({ buffer: buf as any, extension: sig.extension });
                        const nat = getImageDimensionsFromBuffer(buf);
                        const nw = nat?.width ?? 160;
                        const nh = nat?.height ?? 48;
                        const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 120, 44);
                        ws.addImage(imgId, { tl: { col: 7.05, row: row - 1 + 0.05 }, ext: { width: dw, height: dh } } as any);
                    }
                } catch {
                    /* ignore */
                }
            }
        }
        row += 1;
    }

    row += 2;
    const sigRow = row;
    const sigRowHeight = 68;
    ws.mergeCells(sigRow, 2, sigRow, 4);
    ws.getCell(sigRow, 2).value = "Firma Supervisor de Aseo y Limpieza";
    ws.getCell(sigRow, 2).font = { bold: true };
    ws.getCell(sigRow, 2).alignment = { vertical: "middle", wrapText: true };
    ws.mergeCells(sigRow, 5, sigRow, 13);
    ws.getRow(sigRow).height = sigRowHeight;
    const sigS = parseSignatureForExcel(r.firma_supervisor);
    if (sigS) {
        try {
            const buf = tryBufferFromSignatureBase64(sigS.base64);
            if (buf) {
                const imgId = wb.addImage({ buffer: buf as any, extension: sigS.extension });
                const nat = getImageDimensionsFromBuffer(buf);
                const nw = nat?.width ?? 300;
                const nh = nat?.height ?? 80;
                const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, 720, sigRowHeight - 4);
                ws.addImage(imgId, { tl: { col: 4.01, row: sigRow - 1 + 0.01 }, ext: { width: dw, height: dh } } as any);
            }
        } catch {
            /* ignore */
        }
    }
    for (let c = 5; c <= 13; c++) {
        ws.getCell(sigRow, c).border = { bottom: thinBlack };
    }

    const outerBottomRow = sigRow + 1;
    applyWhiteFillRect(ws, 1, 1, outerBottomRow, 14);
    for (let c = 4; c <= 10; c++) {
        ws.getCell(1, c).fill = HDR_MAIN;
    }
    ws.getCell(1, 4).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    applyThickOuterRect(ws, 1, 1, outerBottomRow, 14);
    for (let c = 5; c <= 13; c++) {
        ws.getCell(sigRow, c).border = { bottom: thinBlack };
    }
    applyThickOuterRectA1N1(ws);
}

export async function buildInduccionRecorridoExcelIndividual(rows: any[], reportNombre?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const nombre = String(reportNombre ?? "").trim();
    for (const r of rows) {
        await buildOneInduccionSheet(wb, r, nombre);
    }
    if (rows.length === 0) {
        const ws = wb.addWorksheet("Vacío");
        ws.getCell(1, 1).value = "Sin registros";
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}
