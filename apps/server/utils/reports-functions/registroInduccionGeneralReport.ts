/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    AlignmentType,
    ImageRun,
    ShadingType,
    BorderStyle,
    VerticalAlign,
} from "docx";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import {
    flattenTemasForDocx,
    getCheckedTemaIds,
    getDocxTitlesForDivision,
    getTemaNodesForDivision,
    type FlatDocxTemaRow,
} from "./registroInduccionGeneralTemas";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer } from "./imageDimensions";

const SIG_ROW_HEIGHT = 88;
const SIG_BOX_W = 260;
const SIG_BOX_H = 76;
const DOCX_SIG_W = 200;
const DOCX_SIG_H = 88;

export type RegistroInduccionGeneralModuleFilters = ActaEntregaModuleFilters & {
    colaboradorCedulas?: string[];
    capacitadorCedulas?: string[];
};

export type RegistroInduccionGeneralOrderKey =
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

function parseCedulas(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => String(x ?? "").trim().replace(/\s+/g, "")).filter((s) => s.length > 0))];
}

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseEmpleadoIdFromCreatedBy(raw: unknown): number | null {
    const n = Number(String(raw ?? "").trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function excelCellString(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function fmtDateOnly(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
}

function normalizeSignatureDataUri(raw: unknown): string | null {
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
        return buf.length ? buf : null;
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
        payload = normalizeBase64Payload(any ? String(any[1] ?? "") : s.replace(/^data:image\/[^,]+,\s*/i, ""));
    }
    if (!payload || payload.length < 16) return null;
    const buf = tryBufferFromSignatureBase64(payload);
    if (!buf || buf.length < 24) return null;
    return { extension, base64: payload };
}

function embedSignatureInExcelCell(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    excelRow: ExcelJS.Row,
    colIndex: number,
    firmaRaw: string | null | undefined,
    boxW = SIG_BOX_W,
    boxH = SIG_BOX_H,
): void {
    const sig = parseSignatureForExcel(firmaRaw);
    if (!sig) return;
    try {
        const buf = tryBufferFromSignatureBase64(sig.base64);
        if (!buf) return;
        const imgId = wb.addImage({ buffer: buf as any, extension: sig.extension });
        const nat = getImageDimensionsFromBuffer(buf);
        const nw = nat?.width ?? 240;
        const nh = nat?.height ?? 72;
        const { width: dw, height: dh } = fitImageExtInsideBox(nw, nh, boxW, boxH);
        ws.addImage(imgId, {
            tl: { col: colIndex - 1 + 0.08, row: excelRow.number - 1 + 0.06 },
            ext: { width: dw, height: dh },
        } as any);
    } catch {
        /* ignore */
    }
}

type PersonaParsed = {
    nombre?: string;
    cedula?: string;
    puesto_text?: string;
    firma?: string | null;
    firma_data_uri?: string | null;
};

function normalizePersonaEntry(p: unknown): PersonaParsed | null {
    if (p == null || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const nombre = String(o.nombre ?? o.nombre_completo ?? o.name ?? "").trim();
    const cedula = String(o.cedula ?? o.cedula_identidad ?? "").trim();
    const puesto_text = String(o.puesto_text ?? o.puesto ?? "").trim();
    const firmaRaw = o.firma ?? o.firma_data_uri ?? null;
    const firma = firmaRaw != null && String(firmaRaw).trim() !== "" ? String(firmaRaw) : null;
    if (!nombre && !cedula && !puesto_text && !firma) return null;
    return {
        nombre,
        cedula,
        puesto_text,
        firma,
        firma_data_uri: normalizeSignatureDataUri(firma),
    };
}

function safeParsePersonas(raw: unknown): PersonaParsed[] {
    if (raw == null) return [];
    let v: unknown = raw;
    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return [];
        try {
            v = JSON.parse(s);
            if (typeof v === "string") {
                try {
                    v = JSON.parse(v);
                } catch {
                    /* keep */
                }
            }
        } catch {
            return [];
        }
    }
    let arr: unknown[] = [];
    if (Array.isArray(v)) {
        arr = v;
    } else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const key of ["colaboradores", "capacitadores", "items", "list", "data", "personas"]) {
            if (Array.isArray(o[key])) {
                arr = o[key] as unknown[];
                break;
            }
        }
    }
    const out: PersonaParsed[] = [];
    for (const item of arr) {
        const n = normalizePersonaEntry(item);
        if (n) out.push(n);
    }
    return out;
}

/** Lista completa desde JSON guardado; no usar preview vacío `[]` en lugar del raw. */
function resolvePersonasForReport(r: any, field: "colaboradores" | "capacitadores"): PersonaParsed[] {
    const previewKey = field === "colaboradores" ? "colaboradores_preview" : "capacitadores_preview";
    const fromRaw = safeParsePersonas(r[field]);
    if (fromRaw.length > 0) return fromRaw;
    const preview = r[previewKey];
    if (Array.isArray(preview) && preview.length > 0) {
        return preview.map((p: any) => ({
            ...p,
            firma_data_uri: p.firma_data_uri ?? normalizeSignatureDataUri(p?.firma ?? null),
        }));
    }
    return [];
}

function rowMatchesCedulas(jsonRaw: string | null | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const arr = safeParsePersonas(jsonRaw);
    const cedulas = arr
        .map((p) => String(p?.cedula ?? "").trim().replace(/\s+/g, ""))
        .filter((c) => c.length > 0);
    return needles.some((needle) => {
        const n = needle.trim().replace(/\s+/g, "").toLowerCase();
        if (!n) return false;
        return cedulas.some((c) => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
    });
}

export function normalizeRegistroInduccionGeneralFilters(raw: unknown): RegistroInduccionGeneralModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const col = parseCedulas(o.colaboradorCedulas);
    const cap = parseCedulas(o.capacitadorCedulas);
    return {
        ...base,
        ...(col.length ? { colaboradorCedulas: col } : {}),
        ...(cap.length ? { capacitadorCedulas: cap } : {}),
    };
}

export function hasRegistroInduccionGeneralListModuleFiltersContent(f: RegistroInduccionGeneralModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.colaboradorCedulas?.length || f.capacitadorCedulas?.length) return true;
    return false;
}

export function filtersMatchRegistroInduccionGeneralListQuery(
    parsedRowFilters: any,
    listModuleFilters?: RegistroInduccionGeneralModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeRegistroInduccionGeneralFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    const lc = listModuleFilters.colaboradorCedulas ?? [];
    const sc = saved.colaboradorCedulas ?? [];
    if (lc.length) {
        if (!sc.length) return false;
        const setS = new Set(sc.map((x) => String(x).toLowerCase().trim()));
        for (const c of lc) {
            if (!setS.has(String(c).toLowerCase().trim())) return false;
        }
    }
    const lk = listModuleFilters.capacitadorCedulas ?? [];
    const sk = saved.capacitadorCedulas ?? [];
    if (lk.length) {
        if (!sk.length) return false;
        const setS = new Set(sk.map((x) => String(x).toLowerCase().trim()));
        for (const c of lk) {
            if (!setS.has(String(c).toLowerCase().trim())) return false;
        }
    }
    return true;
}

export async function queryRegistroInduccionGeneralRows(
    prisma: ReportDataAccess,
    filters: RegistroInduccionGeneralModuleFilters,
    orderKey: RegistroInduccionGeneralOrderKey,
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

    let rows = await prisma.c_registro_induccion_general.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    if (filters.colaboradorCedulas?.length) {
        rows = rows.filter((r) => rowMatchesCedulas(r.colaboradores, filters.colaboradorCedulas!));
    }
    if (filters.capacitadorCedulas?.length) {
        rows = rows.filter((r) => rowMatchesCedulas(r.capacitadores, filters.capacitadorCedulas!));
    }

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const creadorIds = [...new Set(rows.map((x) => parseEmpleadoIdFromCreatedBy(x.created_by)).filter((n): n is number => n != null))];

    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds] = [
        ids(rows.map((x) => x.empresa_id)),
        ids(rows.map((x) => x.cliente_id)),
        ids(rows.map((x) => x.division_id)),
        ids(rows.map((x) => x.contrato_id)),
        ids(rows.map((x) => x.corpo_id)),
        ids(rows.map((x) => x.puesto_id)),
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

    const empleadoDisplayName = (e: {
        codigo: string;
        nombre: string | null;
        primer_apellido: string | null;
        segundo_apellido: string | null;
    }) => {
        const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
        return full ? `${e.codigo} - ${full}` : e.codigo;
    };

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(r.empresa_id);
        const cliente = clienteById.get(r.cliente_id);
        const division = divisionById.get(r.division_id);
        const contrato = contratoById.get(r.contrato_id);
        const corpo = corpoById.get(r.corpo_id);
        const puesto = puestoById.get(r.puesto_id);
        const empId = parseEmpleadoIdFromCreatedBy(r.created_by);
        const creador = empId != null ? creadorById.get(empId) : undefined;
        const colaboradores = resolvePersonasForReport(r, "colaboradores");
        const capacitadores = resolvePersonasForReport(r, "capacitadores");
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division ?? r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            fecha_txt: fmtDateOnly(r.fecha),
            created_at_txt: fmtDateTime(r.created_at),
            empleado_creador_nombre: creador ? empleadoDisplayName(creador) : excelCellString(r.created_by),
            firma_responsable_data_uri: normalizeSignatureDataUri(r.firma_responsable),
            colaboradores_preview: colaboradores,
            capacitadores_preview: capacitadores,
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

const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};
const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const SEC_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } } as const;

function parseTemasSectionsForDetalle(temasRaw: string): Array<{ text: string; items: Array<{ text: string; checked: boolean }> }> {
    const sections: Array<{ text: string; items: Array<{ text: string; checked: boolean }> }> = [];
    let obj: any;
    try {
        obj = JSON.parse(String(temasRaw));
    } catch {
        return sections;
    }
    if (Array.isArray(obj?.sections)) {
        for (const sec of obj.sections) {
            const items = Array.isArray(sec?.items)
                ? sec.items.map((it: any) => ({
                      text: String(it?.text ?? it?.id ?? ""),
                      checked: !!it?.checked,
                  }))
                : [];
            sections.push({ text: String(sec?.text ?? ""), items });
        }
        return sections;
    }
    const checked = getCheckedTemaIds(temasRaw);
    const nodes = getTemaNodesForDivision(Number(obj?.meta?.division_id ?? 0), obj?.meta?.division_nombre);
    const flat = flattenTemasForDocx(nodes);
    let cur: { text: string; items: Array<{ text: string; checked: boolean }> } | null = null;
    for (const row of flat) {
        if (row.kind === "section") {
            cur = { text: row.text, items: [] };
            sections.push(cur);
        } else if (cur) {
            cur.items.push({ text: row.text, checked: checked.has(row.id) });
        } else {
            sections.push({ text: row.text, items: [{ text: row.text, checked: checked.has(row.id) }] });
        }
    }
    return sections;
}

function appendDetalleRigBlocks(
    wb: ExcelJS.Workbook,
    wsDet: ExcelJS.Worksheet,
    r: any,
): { rowTemas: number; rowColab: number; rowCap: number } {
    const maxCol = 5;
    const titleRow = wsDet.rowCount + 1;
    wsDet.mergeCells(titleRow, 1, titleRow, maxCol);
    wsDet.getCell(titleRow, 1).value = `Registro #${r.id} — ${r.empresa_nombre} / ${r.cliente_nombre}`;
    wsDet.getCell(titleRow, 1).font = { bold: true, size: 12 };
    wsDet.getCell(titleRow, 1).fill = GRP_HDR;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(titleRow, c).border = borderThin;

    const rowTemasTitle = wsDet.rowCount + 1;
    wsDet.mergeCells(rowTemasTitle, 1, rowTemasTitle, maxCol);
    wsDet.getCell(rowTemasTitle, 1).value = "Temas a tratar";
    wsDet.getCell(rowTemasTitle, 1).font = { bold: true };
    wsDet.getCell(rowTemasTitle, 1).fill = SEC_HDR;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rowTemasTitle, c).border = borderThin;

    const sections = parseTemasSectionsForDetalle(String(r.temas_a_tratar ?? "{}"));
    for (const sec of sections) {
        const hasSub = sec.items.length > 1 || (sec.items.length === 1 && sec.items[0]?.text !== sec.text);
        if (hasSub) {
            const sh = wsDet.addRow([sec.text, "", "", "", ""]);
            sh.font = { bold: true };
            sh.eachCell((c) => {
                c.fill = SEC_HDR;
                c.border = borderThin;
            });
            for (const it of sec.items) {
                const row = wsDet.addRow(["", it.text, it.checked ? "√" : "", "", ""]);
                row.eachCell((c) => {
                    c.border = borderThin;
                    c.alignment = { vertical: "top", wrapText: true };
                });
            }
        } else {
            const only = sec.items[0];
            const row = wsDet.addRow([sec.text, "", only?.checked ? "√" : "", "", ""]);
            row.eachCell((c) => {
                c.border = borderThin;
                c.alignment = { vertical: "top", wrapText: true };
            });
        }
    }

    const rowColabTitle = wsDet.rowCount + 1;
    wsDet.mergeCells(rowColabTitle, 1, rowColabTitle, maxCol);
    wsDet.getCell(rowColabTitle, 1).value = "Colaboradores";
    wsDet.getCell(rowColabTitle, 1).font = { bold: true };
    wsDet.getCell(rowColabTitle, 1).fill = SEC_HDR;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rowColabTitle, c).border = borderThin;

    const ch = wsDet.addRow(["Nombre", "Cédula", "Puesto", "Firma", ""]);
    ch.font = { bold: true };
    ch.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
    });
    const colabs = resolvePersonasForReport(r, "colaboradores");
    for (const p of colabs) {
        const excelRow = wsDet.addRow([
            String(p?.nombre ?? ""),
            String(p?.cedula ?? ""),
            String(p?.puesto_text ?? ""),
            "",
            "",
        ]);
        excelRow.height = SIG_ROW_HEIGHT;
        excelRow.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", wrapText: true };
        });
        embedSignatureInExcelCell(wb, wsDet, excelRow, 4, p?.firma_data_uri || p?.firma);
    }
    if (!colabs.length) {
        wsDet.addRow(["—", "—", "—", "—", ""]).eachCell((c) => {
            c.border = borderThin;
        });
    }

    const rowCapTitle = wsDet.rowCount + 1;
    wsDet.mergeCells(rowCapTitle, 1, rowCapTitle, maxCol);
    wsDet.getCell(rowCapTitle, 1).value = "Capacitadores";
    wsDet.getCell(rowCapTitle, 1).font = { bold: true };
    wsDet.getCell(rowCapTitle, 1).fill = SEC_HDR;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rowCapTitle, c).border = borderThin;

    const cph = wsDet.addRow(["Nombre", "Cédula", "Firma", "", ""]);
    cph.font = { bold: true };
    cph.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
    });
    const caps = resolvePersonasForReport(r, "capacitadores");
    for (const p of caps) {
        const excelRow = wsDet.addRow([String(p?.nombre ?? ""), String(p?.cedula ?? ""), "", "", ""]);
        excelRow.height = SIG_ROW_HEIGHT;
        excelRow.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", wrapText: true };
        });
        embedSignatureInExcelCell(wb, wsDet, excelRow, 3, p?.firma_data_uri || p?.firma);
    }
    if (!caps.length) {
        wsDet.addRow(["—", "—", "—", "", ""]).eachCell((c) => {
            c.border = borderThin;
        });
    }

    wsDet.addRow([]);
    return { rowTemas: rowTemasTitle, rowColab: rowColabTitle, rowCap: rowCapTitle };
}

export async function buildRegistroInduccionGeneralExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Inducción general");
    const wsDet = wb.addWorksheet("Detalles");
    const anchorT = new Map<number, number>();
    const anchorC = new Map<number, number>();
    const anchorK = new Map<number, number>();

    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        const a = appendDetalleRigBlocks(wb, wsDet, r);
        anchorT.set(Number(r.id), a.rowTemas);
        anchorC.set(Number(r.id), a.rowColab);
        anchorK.set(Number(r.id), a.rowCap);
    }

    /** Cuadrícula jerárquica: Registro (nivel 0) → Sección de tema (nivel 1, de `temas_a_tratar`) → Ítem del tema (nivel 2); Colaborador / Capacitador son hermanos de Sección (nivel 1). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Registro",
        "Creado en",
        "Fecha",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Empleado (creador)",
        "Ver temas",
        "Ver colaboradores",
        "Ver capacitadores",
        "Firma responsable",
        "Sección (tema)",
        "Tema",
        "Marcado (tema)",
        "Nombre (colaborador)",
        "Cédula (colaborador)",
        "Puesto (colaborador)",
        "Tiene firma (colaborador)",
        "Nombre (capacitador)",
        "Cédula (capacitador)",
        "Tiene firma (capacitador)",
    ];
    const cT = headers.indexOf("Ver temas") + 1;
    const cC = headers.indexOf("Ver colaboradores") + 1;
    const cK = headers.indexOf("Ver capacitadores") + 1;
    const cF = headers.indexOf("Firma responsable") + 1;
    const COL_TIPO_FILA = headers.indexOf("Tipo de fila") + 1;
    const linkCols = new Set([cT, cC, cK]);

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell, colNumber) => {
            cell.border = borderThin;
            if (!linkCols.has(colNumber) && colNumber !== cF) {
                cell.alignment = { vertical: "top", wrapText: true };
            }
        });
        row.getCell(COL_TIPO_FILA).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(COL_TIPO_FILA).font = { bold: true };
    };

    for (const r of rows) {
        const rt = anchorT.get(Number(r.id)) ?? 1;
        const rc = anchorC.get(Number(r.id)) ?? 1;
        const rk = anchorK.get(Number(r.id)) ?? 1;
        const general: Record<number, unknown> = {
            [headers.indexOf("ID Registro") + 1]: r.id,
            [headers.indexOf("Creado en") + 1]: r.created_at_txt,
            [headers.indexOf("Fecha") + 1]: r.fecha_txt,
            [headers.indexOf("Empresa") + 1]: r.empresa_nombre,
            [headers.indexOf("Cliente") + 1]: r.cliente_nombre,
            [headers.indexOf("División") + 1]: r.division_nombre,
            [headers.indexOf("Contrato") + 1]: r.contrato_nombre,
            [headers.indexOf("Sucursal") + 1]: r.corpo_nombre,
            [headers.indexOf("Puesto") + 1]: r.puesto_nombre,
            [headers.indexOf("Empleado (creador)") + 1]: r.empleado_creador_nombre,
        };

        const rootValues = new Array(headers.length).fill("");
        rootValues[0] = String(r.id);
        rootValues[2] = 0;
        rootValues[3] = "Registro";
        for (const [col, val] of Object.entries(general)) rootValues[Number(col) - 1] = val;
        rootValues[cF - 1] = excelCellString(r.firma_responsable);
        const rootRow = wsMain.addRow(rootValues);
        rootRow.getCell(cT).value = { text: "Ver temas", hyperlink: `#'Detalles'!A${rt}` };
        rootRow.getCell(cT).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(cC).value = { text: "Ver colaboradores", hyperlink: `#'Detalles'!A${rc}` };
        rootRow.getCell(cC).font = { color: { argb: "FF0563C1" }, underline: true };
        rootRow.getCell(cK).value = { text: "Ver capacitadores", hyperlink: `#'Detalles'!A${rk}` };
        rootRow.getCell(cK).font = { color: { argb: "FF0563C1" }, underline: true };
        styleDataRow(rootRow, 0);

        const sections = parseTemasSectionsForDetalle(String(r.temas_a_tratar ?? "{}"));
        sections.forEach((sec, secIdx) => {
            const secId = `${r.id}.tsec${secIdx + 1}`;
            const secValues = new Array(headers.length).fill("");
            secValues[0] = secId;
            secValues[1] = String(r.id);
            secValues[2] = 1;
            secValues[3] = "Sección de tema";
            for (const [col, val] of Object.entries(general)) secValues[Number(col) - 1] = val;
            secValues[headers.indexOf("Sección (tema)")] = sec.text;
            const secRow = wsMain.addRow(secValues);
            styleDataRow(secRow, 1);

            sec.items.forEach((it, itIdx) => {
                const values = new Array(headers.length).fill("");
                values[0] = `${secId}.item${itIdx + 1}`;
                values[1] = secId;
                values[2] = 2;
                values[3] = "Ítem de tema";
                for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
                values[headers.indexOf("Tema")] = it.text;
                values[headers.indexOf("Marcado (tema)")] = it.checked ? "Sí" : "No";
                const row = wsMain.addRow(values);
                styleDataRow(row, 2);
            });
        });

        const colabs = resolvePersonasForReport(r, "colaboradores");
        colabs.forEach((p, idx) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.colab${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Colaborador";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Nombre (colaborador)")] = String(p?.nombre ?? "");
            values[headers.indexOf("Cédula (colaborador)")] = String(p?.cedula ?? "");
            values[headers.indexOf("Puesto (colaborador)")] = String(p?.puesto_text ?? "");
            values[headers.indexOf("Tiene firma (colaborador)")] = p?.firma_data_uri || p?.firma ? "Sí" : "No";
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });

        const caps = resolvePersonasForReport(r, "capacitadores");
        caps.forEach((p, idx) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.cap${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Capacitador";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Nombre (capacitador)")] = String(p?.nombre ?? "");
            values[headers.indexOf("Cédula (capacitador)")] = String(p?.cedula ?? "");
            values[headers.indexOf("Tiene firma (capacitador)")] = p?.firma_data_uri || p?.firma ? "Sí" : "No";
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, wsMain.rowCount), column: headers.length },
    };
    wsMain.columns = [
        { width: 12 },
        { width: 14 },
        { width: 8 },
        { width: 20 },
        { width: 10 },
        { width: 20 },
        { width: 14 },
        { width: 26 },
        { width: 24 },
        { width: 20 },
        { width: 22 },
        { width: 22 },
        { width: 20 },
        { width: 28 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 40 },
        { width: 28 },
        { width: 40 },
        { width: 14 },
        { width: 26 },
        { width: 16 },
        { width: 26 },
        { width: 16 },
        { width: 26 },
        { width: 16 },
        { width: 16 },
    ];
    wsDet.columns = [{ width: 22 }, { width: 52 }, { width: 16 }, { width: 38 }, { width: 18 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
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

const DOC_FONT = "Arial";
const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function centeredParagraph(
    text: string,
    opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean },
): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
            new TextRun({
                text: String(text ?? ""),
                bold: opts?.bold,
                italics: opts?.italics,
                size: opts?.size ?? 20,
                color: opts?.color,
                font: DOC_FONT,
            }),
        ],
    });
}

function leftParagraph(
    text: string,
    opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean },
): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
            new TextRun({
                text: String(text ?? ""),
                bold: opts?.bold,
                italics: opts?.italics,
                size: opts?.size ?? 20,
                color: opts?.color,
                font: DOC_FONT,
            }),
        ],
    });
}

function cellLabel(text: string) {
    return new TableCell({
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [centeredParagraph(text, { bold: true })],
    });
}

function cellVal(text: string) {
    return new TableCell({
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [centeredParagraph(String(text ?? ""))],
    });
}

function collectColaboradorPuestosText(colaboradores: PersonaParsed[]): string {
    const puestos = new Set<string>();
    for (const p of colaboradores) {
        const t = String(p.puesto_text ?? "").trim();
        if (t) puestos.add(t);
    }
    return [...puestos].join(", ");
}

function buildColaboradoresPuestoSection(
    title: string,
    puestosText: string,
): (Paragraph | Table)[] {
    const puestoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 38, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph("Puesto que ocupan los colaboradores:", { bold: true })],
                    }),
                    new TableCell({
                        width: { size: 62, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(puestosText)],
                    }),
                ],
            }),
        ],
    });
    return [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: title, bold: true, size: 22, font: DOC_FONT })],
        }),
        puestoTable,
        new Paragraph({ spacing: { after: 200 } }),
    ];
}

function headerCell(text: string, widthPct: number, opts?: { fill?: string; color?: string }) {
    return new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        shading: opts?.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            centeredParagraph(text, { bold: true, size: 18, color: opts?.color ?? "000000" }),
        ],
    });
}

function signatureParagraph(firma: string | null | undefined): Paragraph[] {
    const img = parseDataUri(normalizeSignatureDataUri(firma ?? null));
    if (!img) {
        return [new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: " ", font: DOC_FONT })] })];
    }
    try {
        const buf = Buffer.from(img.base64, "base64");
        return [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [
                    new ImageRun({
                        data: new Uint8Array(buf),
                        transformation: { width: DOCX_SIG_W, height: DOCX_SIG_H },
                        type: img.extension === "png" ? "png" : "jpg",
                    }),
                ],
            }),
        ];
    } catch {
        return [new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: " ", font: DOC_FONT })] })];
    }
}

function signatureTableCell(firma: string | null | undefined, widthPct = 34): TableCell {
    return new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: signatureParagraph(firma),
    });
}

function buildTemaTableRows(flat: FlatDocxTemaRow[], checked: Set<string>): TableRow[] {
    const header = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                shading: { fill: "1F3864", type: ShadingType.CLEAR, color: "auto" },
                borders: thinBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [centeredParagraph("N°", { bold: true, color: "FFFFFF", size: 18 })],
            }),
            new TableCell({
                width: { size: 82, type: WidthType.PERCENTAGE },
                shading: { fill: "1F3864", type: ShadingType.CLEAR, color: "auto" },
                borders: thinBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [centeredParagraph("Temas a tratar", { bold: true, color: "FFFFFF", size: 18 })],
            }),
            new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                shading: { fill: "1F3864", type: ShadingType.CLEAR, color: "auto" },
                borders: thinBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [centeredParagraph("Marque con √", { bold: true, color: "FFFFFF", size: 16 })],
            }),
        ],
    });

    const rows: TableRow[] = [header];
    for (const item of flat) {
        const isSection = item.kind === "section";
        const mark = !isSection && checked.has(item.id) ? "√" : "";
        const prefix = isSection ? "" : "   ".repeat(Math.max(0, item.level));
        const text = isSection ? item.text : `${prefix}${item.text}`;
        const fill = isSection ? "B8CCE4" : "FFFFFF";
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        borders: thinBorder,
                        shading: { fill, type: ShadingType.CLEAR, color: "auto" },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            centeredParagraph(item.id, { bold: isSection, size: 18 }),
                        ],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        shading: { fill, type: ShadingType.CLEAR, color: "auto" },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [leftParagraph(text, { bold: isSection, size: isSection ? 20 : 18 })],
                    }),
                    new TableCell({
                        borders: thinBorder,
                        shading: { fill, type: ShadingType.CLEAR, color: "auto" },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(mark, { bold: true, size: 22 })],
                    }),
                ],
            }),
        );
    }
    return rows;
}

export async function buildRegistroInduccionGeneralDocxBuffer(row: any, reportNombre: string): Promise<Buffer> {
    const nombreEsquina = String(reportNombre ?? "").trim();
    const divisionId = Number(row.division_id ?? 0);
    const titles = getDocxTitlesForDivision(divisionId, row.division);
    const nodes = getTemaNodesForDivision(divisionId, row.division);
    const flat = flattenTemasForDocx(nodes);
    const checked = getCheckedTemaIds(String(row.temas_a_tratar ?? "{}"));

    const logoBuf = await resolveLogoBuffer(Number(row.empresa_id));
    const logoChildren: Paragraph[] = logoBuf
        ? [
              new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                      new ImageRun({
                          data: new Uint8Array(logoBuf),
                          transformation: { width: 85, height: 85 },
                          type: "png",
                      }),
                  ],
              }),
          ]
        : [new Paragraph("")];

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 22, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: logoChildren,
                    }),
                    new TableCell({
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        shading: { fill: "1F3864", type: ShadingType.CLEAR, color: "auto" },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: titles.headerTitle,
                                        bold: true,
                                        size: 22,
                                        color: "FFFFFF",
                                        font: DOC_FONT,
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(nombreEsquina, { bold: true, size: 18 })],
                    }),
                ],
            }),
        ],
    });

    const colaboradores = resolvePersonasForReport(row, "colaboradores");
    const puestosSection = buildColaboradoresPuestoSection(
        titles.colaboradoresPuestoTitle,
        collectColaboradorPuestosText(colaboradores),
    );

    const fechaRow = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [cellLabel("Fecha:"), cellVal(row.fecha_txt ?? "")],
            }),
        ],
    });

    const temasTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: buildTemaTableRows(flat, checked),
    });

    const capacitadores = resolvePersonasForReport(row, "capacitadores");
    const capWidths = [34, 33, 33];
    const capHeader = new TableRow({
        tableHeader: true,
        children: ["Nombre", "Cédula", "Firma"].map((h, i) =>
            headerCell(h, capWidths[i], { fill: "1F3864", color: "FFFFFF" }),
        ),
    });
    const capRows: TableRow[] = [capHeader];
    for (let i = 0; i < Math.max(capacitadores.length, 2); i++) {
        const p = capacitadores[i];
        capRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: capWidths[0], type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(String(p?.nombre ?? ""))],
                    }),
                    new TableCell({
                        width: { size: capWidths[1], type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(String(p?.cedula ?? ""))],
                    }),
                    signatureTableCell(p?.firma_data_uri || p?.firma, capWidths[2]),
                ],
            }),
        );
    }

    const colWidths = [38, 34, 28];
    const colHeader = new TableRow({
        tableHeader: true,
        children: ["Nombre Completo", "Firma", "Cédula"].map((h, i) =>
            headerCell(h, colWidths[i], { fill: "1F3864", color: "FFFFFF" }),
        ),
    });
    const colRows: TableRow[] = [colHeader];
    const maxCol = Math.max(colaboradores.length, 6);
    for (let i = 0; i < maxCol; i++) {
        const p = colaboradores[i];
        colRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: colWidths[0], type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(String(p?.nombre ?? ""), { size: 18 })],
                    }),
                    signatureTableCell(p?.firma_data_uri || p?.firma, colWidths[1]),
                    new TableCell({
                        width: { size: colWidths[2], type: WidthType.PERCENTAGE },
                        borders: thinBorder,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [centeredParagraph(String(p?.cedula ?? ""), { size: 18 })],
                    }),
                ],
            }),
        );
    }

    const doc = new Document({
        sections: [
            {
                children: [
                    headerTable,
                    ...puestosSection,
                    fechaRow,
                    new Paragraph({ spacing: { after: 160 } }),
                    temasTable,
                    new Paragraph({ spacing: { after: 200 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 80 },
                        children: [new TextRun({ text: "Firma de capacitador:", bold: true, font: DOC_FONT, size: 20 })],
                    }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: capRows }),
                    new Paragraph({ spacing: { after: 200 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 80 },
                        children: [new TextRun({ text: "Firma de colaborador:", bold: true, font: DOC_FONT, size: 20 })],
                    }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: colRows }),
                ],
            },
        ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
}

function zipBuffers(files: { name: string; buf: Buffer }[]): Promise<Buffer> {
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

export async function buildRegistroInduccionGeneralIndividualZip(rows: any[], reportNombre: string): Promise<Buffer> {
    const files: { name: string; buf: Buffer }[] = [];
    let idx = 0;
    for (const r of rows) {
        idx += 1;
        const nameSafe = `Induccion_general_${r.id}_${idx}.docx`.replace(/[/\\?%*:|"<>]/g, "_");
        const buf = await buildRegistroInduccionGeneralDocxBuffer(r, reportNombre);
        files.push({ name: nameSafe, buf });
    }
    if (!files.length) {
        const empty = await buildRegistroInduccionGeneralDocxBuffer(
            {
                id: 0,
                empresa_id: 9,
                division_id: 5,
                division: "Aseo y limpieza",
                fecha_txt: "",
                temas_a_tratar: "{}",
                colaboradores: "[]",
                capacitadores: "[]",
            },
            reportNombre,
        );
        files.push({ name: "Induccion_general_vacio.docx", buf: empty });
    }
    return zipBuffers(files);
}
