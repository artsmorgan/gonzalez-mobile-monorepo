/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type AperturaCierrePuestoModuleFilters = ActaEntregaModuleFilters & {
    createdByIds?: number[] | null;
    tipo?: "todos" | "apertura" | "cierre";
};

export type AperturaCierrePuestoOrderKey =
    | "created_by"
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
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

export function normalizeAperturaCierrePuestoFilters(raw: unknown): AperturaCierrePuestoModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const cids = toValidIds(o.createdByIds);
    const tRaw = String(o.tipo ?? "todos").toLowerCase().trim();
    const tipo: AperturaCierrePuestoModuleFilters["tipo"] =
        tRaw === "apertura" || tRaw === "cierre" ? (tRaw as "apertura" | "cierre") : "todos";
    return {
        ...base,
        createdByIds: cids.length > 0 ? cids : undefined,
        tipo,
    };
}

export function hasAperturaCierreListModuleFiltersContent(f: AperturaCierrePuestoModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.createdByIds && f.createdByIds.length > 0) return true;
    if (f.empresaIds && f.empresaIds.length > 0) return true;
    if (f.clienteIds && f.clienteIds.length > 0) return true;
    if (f.divisionIds && f.divisionIds.length > 0) return true;
    if (f.contratoIds && f.contratoIds.length > 0) return true;
    if (f.corpoIds && f.corpoIds.length > 0) return true;
    if (f.puestoIds && f.puestoIds.length > 0) return true;
    if (f.tipo && f.tipo !== "todos") return true;
    return false;
}

export function filtersMatchAperturaCierreListQuery(
    parsedRowFilters: any,
    listModuleFilters?: AperturaCierrePuestoModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeAperturaCierrePuestoFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (!overlaps(listModuleFilters.createdByIds ?? undefined, saved.createdByIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    const wantTipo = listModuleFilters.tipo ?? "todos";
    const savedTipo = saved.tipo ?? "todos";
    if (wantTipo !== "todos" && savedTipo !== wantTipo) return false;
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

async function readOpeningClosingPhotoCandidates(aperturaId: number, imageNames: string[]): Promise<Buffer[]> {
    const out: Buffer[] = [];
    const base = path.resolve(process.cwd(), "public", "uploads", "opening-closing-position", String(aperturaId));
    for (const n of imageNames) {
        const clean = String(n || "").trim();
        if (!clean) continue;
        const candidates = [clean, `${clean}.jpg`, `${clean}.jpeg`, `${clean}.png`, `${clean}.webp`];
        let found: Buffer | null = null;
        for (const cand of candidates) {
            try {
                found = await fs.readFile(path.join(base, cand));
                break;
            } catch {
                /* keep trying */
            }
        }
        if (found) out.push(found);
    }
    return out;
}

export async function queryAperturaCierrePuestoRows(
    prisma: PrismaClient,
    filters: AperturaCierrePuestoModuleFilters,
    orderKey: AperturaCierrePuestoOrderKey,
): Promise<any[]> {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.createdByIds?.length) where.created_by = { in: filters.createdByIds };
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.tipo && filters.tipo !== "todos") {
        where.tipo = { equals: filters.tipo, mode: "insensitive" };
    }

    const rows = await prisma.c_apertura_cierre_puesto.findMany({
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
    const creadorIds = [...new Set(rows.map((x) => Number(x.created_by)).filter((n) => Number.isFinite(n) && n > 0))];
    const aperturaIds = rows.map((x) => Number(x.id));

    const [empresas, clientes, divisiones, contratos, corpos, puestos, creadores, imagenes] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
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
        creadorIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: creadorIds }, NOT: [{ cedula: { contains: "@" } }] },
                  select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
              })
            : [],
        aperturaIds.length
            ? prisma.c_imagenes_apertura_cierre_puesto.findMany({
                  where: { apetura_cierre_id: { in: aperturaIds } },
                  select: { apetura_cierre_id: true, name: true, original_name: true },
              })
            : [],
    ]);

    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));
    const creadorById = new Map(
        creadores.map((x) => [x.id, `${x.codigo ?? ""} - ${[x.nombre, x.primer_apellido, x.segundo_apellido].filter(Boolean).join(" ").trim()}`]),
    );
    const imageNamesByAperturaId = new Map<number, string[]>();
    for (const img of imagenes) {
        const key = Number(img.apetura_cierre_id);
        const list = imageNamesByAperturaId.get(key) ?? [];
        list.push(String(img.name || img.original_name || ""));
        imageNamesByAperturaId.set(key, list);
    }

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(r.empresa_id);
        const cliente = clienteById.get(r.cliente_id);
        const division = divisionById.get(r.division_id);
        const contrato = contratoById.get(r.contrato_id);
        const corpo = corpoById.get(r.corpo_id);
        const puesto = puestoById.get(r.puesto_id);
        const creador = creadorById.get(Number(r.created_by));
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            creador_nombre: creador ?? String(r.created_by),
            tipo_txt: String(r.tipo ?? "").trim(),
            firma_responsable_data_uri: normalizeSignatureDataUri(r.firma_responsable),
            firma_representante_cliente_data_uri: normalizeSignatureDataUri(r.firma_representante_cliente),
            firma_representante_empresa_saliente_data_uri: normalizeSignatureDataUri(r.firma_representante_empresa_saliente),
            firma_representante_empresa_entrante_data_uri: normalizeSignatureDataUri(r.firma_representante_empresa_entrante),
            imagenes_names: imageNamesByAperturaId.get(Number(r.id)) ?? [],
        };
    });

    return [...enriched].sort((a, b) => {
        switch (orderKey) {
            case "created_by":
                return a.creador_nombre.localeCompare(b.creador_nombre, "es");
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

export async function buildAperturaCierrePuestoExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const workbook = new ExcelJS.Workbook();
    const main = workbook.addWorksheet("Apertura-Cierre");
    const details = workbook.addWorksheet("Detalles");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const headers = [
        "ID",
        "Creador",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Fecha",
        "Tipo",
        "Actividades",
        "Inventario",
        "Observaciones",
    ];
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
        { width: 30, outlineLevel: 1 },
        { width: 26, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 30, outlineLevel: 1 },
        { width: 28, outlineLevel: 1 },
        { width: 30, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 14, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 34, outlineLevel: 1 },
    ];

    const detailsStartById = new Map<number, number>();
    let dRow = 1;
    const rowsDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of rowsDesc) {
        const start = dRow;
        detailsStartById.set(Number(r.id), start);
        details.getCell(`A${dRow}`).value = `Registro #${r.id} - ${r.tipo_txt}`;
        details.getCell(`A${dRow}`).font = { bold: true, size: 12 };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        dRow += 1;

        details.getCell(`A${dRow}`).value = "Actividades";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        dRow += 1;
        const ah = details.getRow(dRow);
        ah.values = ["Pregunta", "Respuesta", "Observaciones"];
        ah.font = { bold: true, color: { argb: "FFFFFFFF" } };
        ah.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            c.border = borderThin;
        });
        dRow += 1;
        for (const a of parseArrayJSON(r.actividades)) {
            const rr = details.getRow(dRow);
            rr.values = [String(a.pregunta ?? ""), String(a.respuesta ?? ""), String(a.observaciones ?? "")];
            rr.eachCell((c) => (c.border = borderThin));
            dRow += 1;
        }

        details.getCell(`A${dRow}`).value = "Inventario de activos / equipos";
        details.getCell(`A${dRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
        details.getCell(`A${dRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        dRow += 1;
        const ih = details.getRow(dRow);
        ih.values = ["Activos o equipos", "Tipo", "# Activo", "Número de serie", "Marca", "Modelo", "Descripción"];
        ih.font = { bold: true, color: { argb: "FFFFFFFF" } };
        ih.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            c.border = borderThin;
        });
        dRow += 1;
        for (const inv of parseArrayJSON(r.inventario)) {
            const rr = details.getRow(dRow);
            rr.values = [
                String(inv.activos_equipos ?? ""),
                String(inv.tipo_nombre ?? ""),
                String(inv.numero_activo ?? ""),
                String(inv.numero_serie ?? ""),
                String(inv.marca ?? ""),
                String(inv.modelo ?? ""),
                String(inv.descripcion ?? ""),
            ];
            rr.eachCell((c) => (c.border = borderThin));
            dRow += 1;
        }
        dRow += 1;
    }
    details.columns = [{ width: 36 }, { width: 20 }, { width: 24 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 36 }];

    for (const r of rows) {
        const detailRow = detailsStartById.get(Number(r.id)) ?? 1;
        const row = main.addRow([
            r.id,
            r.creador_nombre,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""),
            r.tipo_txt,
            "Ver actividades",
            "Ver inventario",
            r.otras_observaciones ?? "",
        ]);
        row.getCell(11).value = { text: "Ver actividades", hyperlink: `#'Detalles'!A${detailRow}` };
        row.getCell(12).value = { text: "Ver inventario", hyperlink: `#'Detalles'!A${detailRow}` };
        row.getCell(11).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(12).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
    }
    main.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildAperturaCierrePuestoExcelIndividual(rows: any[], reportNombre: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const borderBlue: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF1F3A5F" } },
        left: { style: "thin", color: { argb: "FF1F3A5F" } },
        bottom: { style: "thin", color: { argb: "FF1F3A5F" } },
        right: { style: "thin", color: { argb: "FF1F3A5F" } },
    };

    const applyOuterBorder = (ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, blue = false) => {
        const b = blue ? borderBlue : borderThin;
        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                const cell = ws.getCell(r, c);
                const cur: Partial<ExcelJS.Borders> = cell.border || {};
                cell.border = {
                    top: r === r1 ? b.top : cur.top,
                    bottom: r === r2 ? b.bottom : cur.bottom,
                    left: c === c1 ? b.left : cur.left,
                    right: c === c2 ? b.right : cur.right,
                };
            }
        }
    };

    for (const r of rows) {
        const ws = workbook.addWorksheet(`R${r.id}`.slice(0, 31));
        ws.views = [{ showGridLines: false }];
        ws.columns = [{ width: 14 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }];

        const line = (v: unknown) => (String(v ?? "").trim() ? String(v) : "____________________________");

        ws.mergeCells("A1:A3");
        ws.mergeCells("B1:E3");
        ws.mergeCells("F1:F3");
        ws.getCell("C1").value = "Apertura/Cierre del Puesto";
        ws.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell("C1").font = { bold: true, color: { argb: "FFFFFFFF" } };
        ws.getCell("C1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
        ws.getCell("F1").value = String(r.nombre ?? r.titulo ?? reportNombre ?? "");
        ws.getCell("F1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell("F1").font = { bold: true, size: 10 };
        applyOuterBorder(ws, 1, 1, 3, 6, true);

        const logo = await resolveLogoBuffer(Number(r.empresa_id));
        if (logo) {
            try {
                const logoId = workbook.addImage({ base64: logo.toString("base64"), extension: "png" });
                ws.addImage(logoId, { tl: { col: 0.12, row: 0.15 }, ext: { width: 62, height: 56 } });
            } catch {
                /* ignore */
            }
        }

        ws.mergeCells("A5:A5");
        ws.mergeCells("B5:C5");
        ws.mergeCells("D5:D5");
        ws.mergeCells("E5:F5");
        ws.getCell("A5").value = "Cliente:";
        ws.getCell("B5").value = line(r.cliente_nombre);
        ws.getCell("D5").value = "Nombre del Corpo:";
        ws.getCell("E5").value = line(r.corpo_nombre);

        ws.mergeCells("A6:A6");
        ws.mergeCells("B6:C6");
        ws.mergeCells("D6:D6");
        ws.mergeCells("E6:F6");
        ws.getCell("A6").value = "Número de Puesto:";
        ws.getCell("B6").value = line(r.puesto_nombre);
        ws.getCell("D6").value = "Nombre del Puesto:";
        ws.getCell("E6").value = line(r.puesto_nombre);

        ws.mergeCells("A7:A7");
        ws.mergeCells("B7:C7");
        ws.mergeCells("D7:D7");
        ws.mergeCells("E7:F7");
        ws.getCell("A7").value = "Fecha en que se realizó:";
        ws.getCell("B7").value = line(r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha ?? ""));
        const tipoTxt = String(r.tipo_txt ?? "").toLowerCase();
        const markA = tipoTxt.includes("apertura") ? "X" : " ";
        const markC = tipoTxt.includes("cierre") ? "X" : " ";
        ws.getCell("D7").value = "Tipo:";
        ws.getCell("E7").value = `( ${markA} ) Apertura    ( ${markC} ) Cierre`;

        ws.mergeCells("E8:F8");
        ws.getCell("E8").value = "Marque con un (✓) check";
        ws.getCell("E8").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
        ws.getCell("E8").font = { bold: true, color: { argb: "FFFFFFFF" } };
        ws.getCell("E8").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell("E8").border = borderThin;

        // Líneas de entrada: sin cuadros interiores gruesos.
        for (let rr = 5; rr <= 7; rr++) {
            for (let cc = 1; cc <= 6; cc++) {
                ws.getCell(rr, cc).alignment = { vertical: "middle", horizontal: cc === 1 || cc === 4 ? "right" : "left", wrapText: true };
                ws.getCell(rr, cc).border = {};
            }
            ws.getCell(rr, 2).border = { bottom: borderThin.bottom };
            ws.getCell(rr, 3).border = { bottom: borderThin.bottom };
            ws.getCell(rr, 5).border = { bottom: borderThin.bottom };
            ws.getCell(rr, 6).border = { bottom: borderThin.bottom };
        }

        ws.mergeCells("A9:A10");
        ws.mergeCells("B9:C10");
        ws.mergeCells("D9:D10");
        ws.mergeCells("E9:E9");
        ws.mergeCells("F9:F9");
        ws.getCell("A9").value = "Complete con OK o NA";
        ws.getCell("B9").value = "Actividad";
        ws.getCell("D9").value = "Observaciones";
        ws.getCell("E9").value = "Representante del cliente";
        ws.getCell("F9").value = "Representante de empresa saliente";
        ws.getCell("E10").value = "Participan";
        ws.getCell("F10").value = "Participan";
        for (let rr = 9; rr <= 10; rr++) {
            for (let cc = 1; cc <= 6; cc++) {
                ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF234575" } };
                ws.getCell(rr, cc).font = { bold: true, color: { argb: "FFFFFFFF" } };
                ws.getCell(rr, cc).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                ws.getCell(rr, cc).border = borderThin;
            }
        }

        let rowPtr = 11;
        const actividades = parseArrayJSON(r.actividades);
        const maxAct = Math.max(actividades.length, 10);
        for (let i = 0; i < maxAct; i++) {
            const act = actividades[i] ?? {};
            ws.mergeCells(`B${rowPtr}:C${rowPtr}`);
            const resp = String(act.respuesta ?? "").trim().toLowerCase();
            const okMark = resp === "ok" ? "( X )" : resp === "n/a" || resp === "na" ? "N/A" : "(   )";
            ws.getCell(`A${rowPtr}`).value = okMark;
            ws.getCell(`B${rowPtr}`).value = String(act.pregunta ?? "");
            ws.getCell(`D${rowPtr}`).value = String(act.observaciones ?? "");
            ws.getCell(`E${rowPtr}`).value = String(r.nombre_representante_cliente ?? "");
            ws.getCell(`F${rowPtr}`).value = String(r.nombre_representante_empresa_saliente ?? "");
            for (let cc = 1; cc <= 6; cc++) {
                ws.getCell(rowPtr, cc).border = borderThin;
                ws.getCell(rowPtr, cc).alignment = { horizontal: cc === 1 ? "center" : "left", vertical: "middle", wrapText: true };
            }
            ws.getRow(rowPtr).height = 26;
            rowPtr += 1;
        }

        ws.mergeCells(`A${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "*Tome fotografías de las instalaciones estado de recibido/entrega.";
        ws.getCell(`A${rowPtr}`).font = { bold: true };
        ws.getCell(`A${rowPtr}`).border = borderThin;
        rowPtr += 1;

        const photos = await readOpeningClosingPhotoCandidates(Number(r.id), r.imagenes_names ?? []);
        let pCol = 1;
        let pRow = rowPtr;
        let maxPhotoBottom = rowPtr;
        for (const photo of photos) {
            try {
                const imageId = workbook.addImage({ base64: photo.toString("base64"), extension: "jpeg" });
                ws.addImage(imageId, { tl: { col: pCol - 1 + 0.1, row: pRow - 1 + 0.1 }, ext: { width: 130, height: 100 } });
                ws.mergeCells(pRow, pCol, pRow + 3, pCol + 2);
                for (let rr = pRow; rr <= pRow + 3; rr++) {
                    for (let cc = pCol; cc <= pCol + 2; cc++) ws.getCell(rr, cc).border = borderThin;
                }
                pCol += 3;
                if (pCol > 4) {
                    pCol = 1;
                    pRow += 4;
                }
                maxPhotoBottom = Math.max(maxPhotoBottom, pRow + 3);
            } catch {
                /* ignore broken image */
            }
        }
        rowPtr = Math.max(rowPtr + 4, maxPhotoBottom + 1);

        ws.mergeCells(`A${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Inventario de activos y/o Equipos";
        ws.getCell(`A${rowPtr}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF234575" } };
        ws.getCell(`A${rowPtr}`).font = { color: { argb: "FFFFFFFF" }, bold: true };
        ws.getCell(`A${rowPtr}`).alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell(`A${rowPtr}`).border = borderThin;
        rowPtr += 1;

        const invHeaders = ["Activos o equipos", "Tipo", "# de Activo", "Número de Serie", "Marca", "Modelo"];
        ws.getRow(rowPtr).values = invHeaders;
        for (let cc = 1; cc <= invHeaders.length; cc++) {
            ws.getCell(rowPtr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
            ws.getCell(rowPtr, cc).font = { color: { argb: "FFFFFFFF" }, bold: true };
            ws.getCell(rowPtr, cc).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            ws.getCell(rowPtr, cc).border = borderThin;
        }
        rowPtr += 1;
        for (const inv of parseArrayJSON(r.inventario)) {
            ws.getRow(rowPtr).values = [
                String(inv.activos_equipos ?? ""),
                String(inv.tipo_nombre ?? ""),
                String(inv.numero_activo ?? ""),
                String(inv.numero_serie ?? ""),
                String(inv.marca ?? ""),
                String(inv.modelo ?? ""),
            ];
            for (let cc = 1; cc <= invHeaders.length; cc++) {
                ws.getCell(rowPtr, cc).border = borderThin;
                ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
            }
            rowPtr += 1;
        }

        ws.mergeCells(`A${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Otras Observaciones";
        ws.getCell(`A${rowPtr}`).font = { bold: true };
        ws.getCell(`A${rowPtr}`).border = borderThin;
        rowPtr += 1;
        ws.mergeCells(`A${rowPtr}:F${rowPtr + 4}`);
        ws.getCell(`A${rowPtr}`).value = String(r.otras_observaciones ?? "");
        ws.getCell(`A${rowPtr}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
        for (let rr = rowPtr; rr <= rowPtr + 4; rr++) for (let cc = 1; cc <= 6; cc++) ws.getCell(rr, cc).border = borderThin;
        rowPtr += 6;

        ws.mergeCells(`B${rowPtr}:D${rowPtr}`);
        ws.mergeCells(`E${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Nombre representante del cliente:";
        ws.getCell(`B${rowPtr}`).value = String(r.nombre_representante_cliente ?? "");
        ws.getCell(`E${rowPtr}`).value = "Firma Cliente:";
        ws.getRow(rowPtr).height = 46;
        for (let cc = 1; cc <= 6; cc++) {
            ws.getCell(rowPtr, cc).border = borderThin;
            ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: cc === 5 ? "left" : "left", wrapText: true };
        }
        rowPtr += 1;

        ws.mergeCells(`B${rowPtr}:D${rowPtr}`);
        ws.mergeCells(`E${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Nombre representante empresa saliente:";
        ws.getCell(`B${rowPtr}`).value = String(r.nombre_representante_empresa_saliente ?? "");
        ws.getCell(`E${rowPtr}`).value = "Firma Saliente:";
        ws.getRow(rowPtr).height = 46;
        for (let cc = 1; cc <= 6; cc++) {
            ws.getCell(rowPtr, cc).border = borderThin;
            ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: cc === 5 ? "left" : "left", wrapText: true };
        }
        rowPtr += 1;

        ws.mergeCells(`B${rowPtr}:D${rowPtr}`);
        ws.mergeCells(`E${rowPtr}:F${rowPtr}`);
        ws.getCell(`A${rowPtr}`).value = "Nombre representante empresa entrante:";
        ws.getCell(`B${rowPtr}`).value = String(r.nombre_representante_empresa_entrante ?? "");
        ws.getCell(`E${rowPtr}`).value = "Firma Entrante:";
        ws.getRow(rowPtr).height = 46;
        for (let cc = 1; cc <= 6; cc++) {
            ws.getCell(rowPtr, cc).border = borderThin;
            ws.getCell(rowPtr, cc).alignment = { vertical: "middle", horizontal: cc === 5 ? "left" : "left", wrapText: true };
        }
        const repsStartRow = rowPtr - 2;

        const sigCliente = parseDataUri(r.firma_representante_cliente_data_uri ?? null);
        const sigSaliente = parseDataUri(r.firma_representante_empresa_saliente_data_uri ?? null);
        const sigEntrante = parseDataUri(r.firma_representante_empresa_entrante_data_uri ?? null);
        const sigPositions: Array<{ sig: any; row: number }> = [
            { sig: sigCliente, row: repsStartRow },
            { sig: sigSaliente, row: repsStartRow + 1 },
            { sig: sigEntrante, row: repsStartRow + 2 },
        ];
        for (const sp of sigPositions) {
            if (!sp.sig) continue;
            try {
                const imgId = workbook.addImage({ base64: sp.sig.base64, extension: sp.sig.extension });
                // Firmas ancladas hacia la derecha de su casilla (E:F) sin comprimir su altura.
                ws.addImage(imgId, { tl: { col: 5.08, row: sp.row - 1 + 0.12 }, ext: { width: 95, height: 34 } });
            } catch {
                /* ignore */
            }
        }

        // Borde exterior azul como en la plantilla.
        applyOuterBorder(ws, 1, 1, repsStartRow + 2, 6, true);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
}
