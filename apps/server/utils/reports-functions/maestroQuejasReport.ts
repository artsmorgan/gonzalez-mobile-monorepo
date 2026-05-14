/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

/** Filtros de fecha usan `creadoDesde` / `creadoHasta` (string sin TZ) aplicados a `created_at` del registro (equivalente operativo a “fecha reporte” hasta existir columna dedicada). */
export type MaestroQuejasModuleFilters = ActaEntregaModuleFilters & {
    medioRecepcionQueja?: string | null;
    tipoQueja?: string | null;
    nivelQueja?: string | null;
};

export type MaestroQuejasOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha_queja";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown, max = 32767): string {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) : s;
}

function fmtDateTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
}

/** `c_maestro_quejas.created_by` guarda el id de `c_empleado` como texto. */
function parseEmpleadoIdFromCreatedBy(raw: unknown): number | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function empleadoDisplayName(e: { codigo: string; nombre: string | null; primer_apellido: string | null; segundo_apellido: string | null }): string {
    const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    return full ? `${e.codigo} - ${full}` : e.codigo;
}

function parseIds(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

export function normalizeMaestroQuejasFilters(raw: unknown): MaestroQuejasModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const medio = String(o.medioRecepcionQueja ?? "").trim();
    const tipoQ = String(o.tipoQueja ?? "").trim();
    const nivel = String(o.nivelQueja ?? "").trim();
    return {
        ...base,
        medioRecepcionQueja: medio && medio !== "todos" ? medio : null,
        tipoQueja: tipoQ && tipoQ !== "todos" ? tipoQ : null,
        nivelQueja: nivel && nivel !== "todos" ? nivel : null,
    };
}

export function hasMaestroQuejasListModuleFiltersContent(f: MaestroQuejasModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.medioRecepcionQueja) return true;
    if (f.tipoQueja) return true;
    if (f.nivelQueja) return true;
    return false;
}

export function filtersMatchMaestroQuejasListQuery(parsedRowFilters: any, listModuleFilters?: MaestroQuejasModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeMaestroQuejasFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (listModuleFilters.medioRecepcionQueja && String(saved.medioRecepcionQueja || "") !== String(listModuleFilters.medioRecepcionQueja))
        return false;
    if (listModuleFilters.tipoQueja && String(saved.tipoQueja || "") !== String(listModuleFilters.tipoQueja)) return false;
    if (listModuleFilters.nivelQueja && String(saved.nivelQueja || "") !== String(listModuleFilters.nivelQueja)) return false;
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

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
    try {
        const buf = await fs.readFile(filePath);
        if (
            buf.length >= 24 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47
        ) {
            const width = buf.readUInt32BE(16);
            const height = buf.readUInt32BE(20);
            if (width > 0 && height > 0) return { width, height };
        }
    } catch {
        /* ignore */
    }
    return null;
}

export async function queryMaestroQuejasRows(prisma: PrismaClient, filters: MaestroQuejasModuleFilters, orderKey: MaestroQuejasOrderKey) {
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
    if (filters.medioRecepcionQueja) where.medio_recepcion_queja = filters.medioRecepcionQueja;
    if (filters.tipoQueja) where.tipo_queja = filters.tipoQueja;
    if (filters.nivelQueja) where.nivel_queja = filters.nivelQueja;

    const rows = await prisma.c_maestro_quejas.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const empresaIds = parseIds(rows.map((x) => x.empresa_id));
    const clienteIds = parseIds(rows.map((x) => x.cliente_id));
    const divisionIds = parseIds(rows.map((x) => x.division_id));
    const contratoIds = parseIds(rows.map((x) => x.contrato_id));
    const corpoIds = parseIds(rows.map((x) => x.corpo_id));
    const puestoIds = parseIds(rows.map((x) => x.puesto_id));
    const plazaIds = parseIds(rows.map((x) => x.plaza_id));
    const creadoPorEmpleadoIds = [...new Set(rows.map((x) => parseEmpleadoIdFromCreatedBy(x.created_by)).filter((n): n is number => n != null))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos, plazas, creadores] = await Promise.all([
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
        plazaIds.length
            ? prisma.e_estructura_plazas.findMany({
                  where: { id: { in: plazaIds } },
                  select: { id: true, nombre: true, codigo_plaza: true, nro_plaza: true },
              })
            : [],
        creadoPorEmpleadoIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: creadoPorEmpleadoIds } },
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
    const creadorById = new Map(creadores.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const plaza = plazaById.get(Number(r.plaza_id));
        const nroPlazaStr = plaza?.nro_plaza != null && String(plaza.nro_plaza).trim() !== "" ? String(plaza.nro_plaza) : "";
        const plazaNombreParts = plaza
            ? [nroPlazaStr || null, plaza.codigo_plaza?.trim() || null, plaza.nombre?.trim() || null].filter((x): x is string => !!x && String(x).trim() !== "")
            : [];
        const empCreadorId = parseEmpleadoIdFromCreatedBy(r.created_by);
        const creador = empCreadorId != null ? creadorById.get(empCreadorId) : undefined;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            plaza_nombre: plazaNombreParts.length > 0 ? plazaNombreParts.join(" - ") : String(r.plaza_id ?? ""),
            creado_por_nombre: creador ? empleadoDisplayName(creador) : excelCellString(r.created_by),
        };
    });

    return sortMaestroQuejasRows(enriched, orderKey);
}

function sortMaestroQuejasRows(rows: any[], orderKey: MaestroQuejasOrderKey): any[] {
    const copy = [...rows];
    copy.sort((a, b) => {
        if (orderKey === "fecha_queja") {
            return String(a.fecha_queja ?? "").localeCompare(String(b.fecha_queja ?? ""));
        }
        const av = a[orderKey];
        const bv = b[orderKey];
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return copy;
}

export async function buildMaestroQuejasExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Maestro de quejas");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;

    const headers = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Plaza",
        "Creado (servidor)",
        "Sociedad",
        "Nombre quien recibió la queja",
        "Cliente (texto formulario)",
        "Empresa que puso la queja",
        "Persona que puso la queja",
        "Medio recepción",
        "Tipo cliente",
        "Tipo queja",
        "Ubicación",
        "Nivel queja",
        "Fecha queja",
        "Motivo",
        "Descripción",
        "Estimación daño",
        "Fecha de atención",
        "Fecha de realización",
        "Resolución",
        "Acción correctiva / preventiva",
        "Estado",
        "Creado por",
        "Firma responsable",
    ];

    const h = wsMain.addRow(headers);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    const colWidths = [
        8, 26, 22, 18, 24, 24, 22, 22, 18, 14, 22, 18, 20, 20, 14, 14, 14, 16, 12, 14, 24, 40, 18, 14, 14, 32, 28, 12, 28, 36,
    ];
    wsMain.columns = colWidths.map((w) => ({ width: w, outlineLevel: 1 }));

    for (const r of rows) {
        const desc =
            excelCellString(r.descripcion_queja).length > 1200
                ? `${excelCellString(r.descripcion_queja).slice(0, 1200)}…`
                : excelCellString(r.descripcion_queja);
        const resol =
            excelCellString(r.resolucion_queja).length > 800
                ? `${excelCellString(r.resolucion_queja).slice(0, 800)}…`
                : excelCellString(r.resolucion_queja);

        const row = wsMain.addRow([
            String(r.id),
            excelCellString(r.empresa_nombre),
            excelCellString(r.cliente_nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.corpo_nombre),
            excelCellString(r.puesto_nombre),
            excelCellString(r.plaza_nombre ?? ""),
            fmtDateTime(r.created_at),
            excelCellString(r.sociedad),
            excelCellString(r.nombre_realiza_queja),
            excelCellString(r.cliente),
            excelCellString(r.empresa_presenta_queja),
            excelCellString(r.persona_presenta_queja),
            excelCellString(r.medio_recepcion_queja),
            excelCellString(r.tipo_cliente),
            excelCellString(r.tipo_queja ?? ""),
            excelCellString(r.ubicacion),
            excelCellString(r.nivel_queja),
            excelCellString(r.fecha_queja),
            excelCellString(r.motivo_queja),
            desc,
            excelCellString(r.estimacion_dannio ?? ""),
            excelCellString(r.fecha_inicio),
            excelCellString(r.fecha_revision),
            resol,
            excelCellString(r.accion_correctiva_preventiva),
            excelCellString(r.estado),
            excelCellString(r.creado_por_nombre ?? r.created_by),
            excelCellString(r.firma_responsable),
        ]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };
    return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Plantilla tipo formulario ESC-F-004: fila 1 (A1:C1 logo proporcional, D1:O1 título, P1:Q1 nombre del reporte), fila 2 en blanco, headers en fila 3, datos desde fila 4. */
export async function buildMaestroQuejasExcelIndividual(rows: any[], reportNombre?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Maestro quejas");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
    };
    const borderMedium: Partial<ExcelJS.Borders> = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;
    const fillWhite = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;

    /** A–Q; columnas L, P y Q más anchas para descripción, resolución y acción correctiva. */
    ws.columns = [5, 14, 22, 18, 18, 16, 14, 14, 14, 12, 12, 40, 32, 16, 14, 28, 52].map((w) => ({ width: w }));

    const first = rows[0];
    const registroNombreTop = reportNombre ? String(reportNombre).trim() : "";

    ws.mergeCells("A1:C1");
    ws.mergeCells("D1:O1");
    ws.mergeCells("P1:Q1");
    ws.mergeCells("A2:Q2");

    ws.getCell("A1").fill = fillWhite;
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

    ws.getCell("D1").value = "MAESTRO DE QUEJAS Y RECLAMOS";
    ws.getCell("D1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getCell("D1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getCell("D1").fill = hdrFill;

    ws.getCell("P1").value = excelCellString(registroNombreTop);
    ws.getCell("P1").font = { bold: true, size: 12 };
    ws.getCell("P1").fill = fillWhite;
    ws.getCell("P1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.getCell("A2").value = "";
    ws.getCell("A2").fill = fillWhite;
    ws.getCell("A2").alignment = { vertical: "middle" };

    ws.getRow(1).height = 62;
    ws.getRow(2).height = 22;

    // Cuadrícula de bordes negros sobre toda la zona de encabezado (filas 1-2)
    for (let r = 1; r <= 2; r++) {
        for (let c = 1; c <= 17; c++) {
            const cell = ws.getCell(r, c);
            const isTop = r === 1;
            const isBottom = r === 2;
            const isLeft = c === 1;
            const isRight = c === 17;
            cell.border = {
                top: isTop ? borderMedium.top : borderThin.top,
                bottom: isBottom ? borderMedium.bottom : borderThin.bottom,
                left: isLeft ? borderMedium.left : borderThin.left,
                right: isRight ? borderMedium.right : borderThin.right,
            };
        }
    }

    const eid = Number(first?.empresa_id || 0);
    const logo = await resolveLogoPathByEmpresaId(eid);
    if (logo) {
        try {
            const ext = path.extname(logo).toLowerCase() === ".png" ? "png" : "jpeg";
            const imgId = wb.addImage({ filename: logo, extension: ext as "png" | "jpeg" });
            const original = await getImageDimensions(logo);
            const originalW = original?.width ?? 300;
            const originalH = original?.height ?? 120;
            /** Cabe en A1:C1 sin deformar: una sola escala (no agranda). */
            const maxW = 248;
            const maxH = 78;
            const scale = Math.min(maxW / originalW, maxH / originalH, 1);
            const drawW = Math.max(1, Math.round(originalW * scale));
            const drawH = Math.max(1, Math.round(originalH * scale));
            ws.addImage(imgId, {
                tl: { col: 0.12, row: 0.08 },
                ext: { width: drawW, height: drawH },
                editAs: "oneCell",
            });
        } catch {
            /* ignore */
        }
    }

    const headerRow = 3;
    const headerLabels = [
        "N°",
        "Sociedad",
        "Nombre de quien recibió la queja",
        "Empresa que puso queja",
        "Persona que puso queja",
        "Medio Recepción Queja",
        "Tipo de cliente",
        "Ubicación",
        "Nivel Queja",
        "Fecha de queja",
        "Motivo de la queja",
        "Descripción de la queja",
        "Estimación Daño (si aplica)",
        "Fecha de atención",
        "Fecha de realización",
        "Resolución de la queja",
        "Acción correctiva/ preventiva relacionada (indique el número de acción correctiva relacionada)",
    ];
    const hRow = ws.getRow(headerRow);
    headerLabels.forEach((label, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = label;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = hdrFill;
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    hRow.height = 44;

    let idx = 1;
    for (const r of rows) {
        const tipoQuejaStr = excelCellString(r.tipo_queja ?? "");
        const motivoConTipo = `${excelCellString(r.motivo_queja)}${tipoQuejaStr ? `\n(Tipo queja: ${tipoQuejaStr})` : ""}`;
        const row = ws.addRow([
            String(idx),
            excelCellString(r.sociedad),
            excelCellString(r.nombre_realiza_queja),
            excelCellString(r.empresa_presenta_queja),
            excelCellString(r.persona_presenta_queja),
            excelCellString(r.medio_recepcion_queja),
            excelCellString(r.tipo_cliente),
            excelCellString(r.ubicacion),
            excelCellString(r.nivel_queja),
            excelCellString(r.fecha_queja),
            motivoConTipo,
            excelCellString(r.descripcion_queja),
            excelCellString(r.estimacion_dannio ?? ""),
            excelCellString(r.fecha_inicio),
            excelCellString(r.fecha_revision),
            excelCellString(r.resolucion_queja),
            excelCellString(r.accion_correctiva_preventiva),
        ]);
        row.eachCell((cell) => {
            cell.border = borderThin;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        idx += 1;
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
