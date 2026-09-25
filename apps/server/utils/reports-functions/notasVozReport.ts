/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import {
    addMainRow,
    applyConsolidadoReportBanner,
    formatDateOnlyDMY,
    formatTimeOnlyHMS,
    type ConsolidadoBannerMeta,
} from "./reportConsolidadoBanner";

export type NotasVozModuleFilters = ActaEntregaModuleFilters;

export type NotasVozOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

function parseNaiveDateTime(s: string | undefined | null): Date | null {
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

export function normalizeNotasVozFilters(raw: unknown): NotasVozModuleFilters {
    return normalizeActaEntregaFilters(raw);
}

export function hasNotasVozListModuleFiltersContent(f: NotasVozModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchNotasVozListQuery(parsedRowFilters: any, listModuleFilters?: NotasVozModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeNotasVozFilters((parsedRowFilters?.moduleFilters || {}) as any);
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

export async function queryNotasVozRows(
    prisma: ReportDataAccess,
    filters: NotasVozModuleFilters,
    orderKey: NotasVozOrderKey,
) {
    const where: any = { isActive: true };
    const desde = parseNaiveDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseNaiveDateTime(filters.creadoHasta ?? undefined);
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
    if (filters.puestoIds?.length) {
        where.puesto_id = { in: filters.puestoIds };
    }

    const rows = await prisma.c_notas_voz.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds, creatorIds] = [
        ids(rows.map((x) => x.empresa_id)),
        ids(rows.map((x) => x.cliente_id)),
        ids(rows.map((x) => x.division_id)),
        ids(rows.map((x) => x.contrato_id)),
        ids(rows.map((x) => x.corpo_id)),
        ids(rows.map((x) => x.puesto_id).filter((id) => id != null)),
        ids(rows.map((x) => x.created_by)),
    ];
    const [empresas, clientes, divisiones, contratos, corpos, puestos, empleados] = await Promise.all([
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
        creatorIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: creatorIds } },
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
    const empleadoById = new Map(empleados.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const pid = r.puesto_id != null ? Number(r.puesto_id) : null;
        const puesto = pid != null && pid > 0 ? puestoById.get(pid) : null;
        const emp = empleadoById.get(Number(r.created_by));
        const creatorNombre = emp
            ? [emp.codigo, emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(" ").trim()
            : String(r.created_by);
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : pid != null ? String(pid) : "—",
            creador_nombre: creatorNombre,
            audio_relpath: r.path ? `voice-notes/${r.id}/${path.basename(String(r.path))}` : "",
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

export async function buildNotasVozExcelConsolidado(
    rows: any[],
    reportDb: ReportDataAccess,
    bannerMeta: ConsolidadoBannerMeta,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Notas de voz");
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const headers = [
        "ID",
        "Fecha",
        "Hora",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Título",
        "Descripción",
        "Transcripción",
        "Archivo",
        "Creado por",
    ];

    applyConsolidadoReportBanner(ws, bannerMeta, { headerFillArgb: "FFD9EAF7", mainColumnCount: headers.length });

    addMainRow(ws, headers);
    const h = ws.getRow(12);
    h.font = { bold: true };
    for (let c = 2; c <= headers.length + 1; c++) {
        const cell = h.getCell(c);
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    // Fondo blanco en todo el documento: se oculta la cuadrícula de Excel, así solo se ven los bordes que dibujamos manualmente.
    ws.views = [{ showGridLines: false }];
    ws.columns = [
        { width: 3 },
        { width: 8 },
        { width: 14 },
        { width: 12 },
        { width: 26 },
        { width: 24 },
        { width: 20 },
        { width: 22 },
        { width: 22 },
        { width: 20 },
        { width: 28 },
        { width: 36 },
        { width: 40 },
        { width: 28 },
        { width: 24 },
    ];

    for (const r of rows) {
        const row = addMainRow(ws, [
            r.id,
            formatDateOnlyDMY(r.created_at),
            formatTimeOnlyHMS(r.created_at),
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            excelCellString(r.titulo),
            excelCellString(r.descripcion),
            excelCellString(r.transcripcion),
            excelCellString(r.path ? path.basename(String(r.path)) : ""),
            r.creador_nombre,
        ]);
        row.eachCell((cell, colNumber) => {
            if (colNumber === 1) return;
            cell.border = border;
            cell.alignment = { vertical: "top", wrapText: true };
        });
    }

    ws.autoFilter = {
        from: { row: 12, column: 2 },
        to: { row: Math.max(12, rows.length + 12), column: headers.length + 1 },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}
