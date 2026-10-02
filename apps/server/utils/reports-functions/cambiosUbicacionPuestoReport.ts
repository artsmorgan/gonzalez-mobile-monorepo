/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";
import { resolvePuestoIdsForActividades } from "./actividadesReport";
import {
    addMainRow,
    applyConsolidadoReportBanner,
    formatDateOnlyDMY,
    formatTimeOnlyHMS,
    type ConsolidadoBannerMeta,
} from "./reportConsolidadoBanner";

export type CambiosUbicacionPuestoModuleFilters = ActaEntregaModuleFilters & {
    responsableIds?: number[] | null;
};

export type CambiosUbicacionPuestoOrderKey =
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

function empleadoDisplayName(e: {
    codigo: string;
    nombre: string | null;
    primer_apellido: string | null;
    segundo_apellido: string | null;
}): string {
    const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    return full ? `${e.codigo} - ${full}` : e.codigo;
}

export function normalizeCambiosUbicacionPuestoFilters(raw: unknown): CambiosUbicacionPuestoModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const resp = toValidIds(o.responsableIds);
    return {
        ...base,
        ...(resp.length ? { responsableIds: resp } : {}),
    };
}

export function hasCambiosUbicacionPuestoListModuleFiltersContent(f: CambiosUbicacionPuestoModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.responsableIds?.length) return true;
    return false;
}

export function filtersMatchCambiosUbicacionPuestoListQuery(
    parsedRowFilters: any,
    listModuleFilters?: CambiosUbicacionPuestoModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeCambiosUbicacionPuestoFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.responsableIds ?? undefined, saved.responsableIds ?? undefined)) return false;
    return true;
}

type PuestoChain = {
    puesto_id: number;
    empresa_id: number;
    cliente_id: number;
    division_id: number;
    contrato_id: number;
    corpo_id: number;
};

async function loadPuestoChains(prisma: ReportDataAccess, puestoIds: number[]): Promise<Map<number, PuestoChain>> {
    const map = new Map<number, PuestoChain>();
    if (!puestoIds.length) return map;

    const puestos = await prisma.e_estructura_puesto.findMany({
        where: { id: { in: puestoIds } },
        select: { id: true, sucursal_id: true },
    });
    const sucursalIds = [...new Set(puestos.map((p) => Number(p.sucursal_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const sucursales = sucursalIds.length
        ? await prisma.e_estructura_sucursal.findMany({
              where: { id: { in: sucursalIds } },
              select: { id: true, contrato_id: true },
          })
        : [];
    const sucById = new Map(sucursales.map((s) => [s.id, s]));
    const contratoIds = [...new Set(sucursales.map((s) => Number(s.contrato_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const contratos = contratoIds.length
        ? await prisma.e_estructura_contrato.findMany({
              where: { id: { in: contratoIds } },
              select: { id: true, empresa_id: true, cliente_id: true, division_id: true },
          })
        : [];
    const ctrById = new Map(contratos.map((c) => [c.id, c]));

    for (const p of puestos) {
        const sid = Number(p.sucursal_id);
        const suc = Number.isFinite(sid) && sid > 0 ? sucById.get(sid) : undefined;
        const cid = suc ? Number(suc.contrato_id) : NaN;
        const ctr = Number.isFinite(cid) && cid > 0 ? ctrById.get(cid) : undefined;
        map.set(p.id, {
            puesto_id: p.id,
            corpo_id: Number.isFinite(sid) && sid > 0 ? sid : 0,
            contrato_id: ctr?.id ?? 0,
            empresa_id: Number(ctr?.empresa_id) || 0,
            cliente_id: Number(ctr?.cliente_id) || 0,
            division_id: Number(ctr?.division_id) || 0,
        });
    }
    return map;
}

export async function queryCambiosUbicacionPuestoRows(
    prisma: ReportDataAccess,
    filters: CambiosUbicacionPuestoModuleFilters,
    orderKey: CambiosUbicacionPuestoOrderKey,
) {
    const structural: ActaEntregaModuleFilters = {
        creadoDesde: filters.creadoDesde,
        creadoHasta: filters.creadoHasta,
        empresaIds: filters.empresaIds,
        clienteIds: filters.clienteIds,
        divisionIds: filters.divisionIds,
        contratoIds: filters.contratoIds,
        corpoIds: filters.corpoIds,
        puestoIds: filters.puestoIds,
    };
    const resolvedPuestoIds = await resolvePuestoIdsForActividades(prisma, structural);
    if (resolvedPuestoIds !== undefined && resolvedPuestoIds.length === 0) return [];

    const where: any = {};
    const desde = parseNaiveDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseNaiveDateTime(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (resolvedPuestoIds !== undefined) {
        where.puesto_id = { in: resolvedPuestoIds };
    }
    if (filters.responsableIds?.length) {
        where.created_by = { in: filters.responsableIds };
    }

    const rows = await prisma.c_ubicacion_puesto_registro_cambios.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });
    if (!rows.length) return [];

    const puestoIds = [...new Set(rows.map((r) => r.puesto_id).filter((id) => id > 0))];
    const chainByPuesto = await loadPuestoChains(prisma, puestoIds);

    const empresaIds = [...new Set([...chainByPuesto.values()].map((c) => c.empresa_id).filter((n) => n > 0))];
    const clienteIds = [...new Set([...chainByPuesto.values()].map((c) => c.cliente_id).filter((n) => n > 0))];
    const divisionIds = [...new Set([...chainByPuesto.values()].map((c) => c.division_id).filter((n) => n > 0))];
    const contratoIds = [...new Set([...chainByPuesto.values()].map((c) => c.contrato_id).filter((n) => n > 0))];
    const corpoIds = [...new Set([...chainByPuesto.values()].map((c) => c.corpo_id).filter((n) => n > 0))];
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((id) => id > 0))];

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
        const chain = chainByPuesto.get(r.puesto_id);
        const empresa = chain ? empresaById.get(chain.empresa_id) : undefined;
        const cliente = chain ? clienteById.get(chain.cliente_id) : undefined;
        const division = chain ? divisionById.get(chain.division_id) : undefined;
        const contrato = chain ? contratoById.get(chain.contrato_id) : undefined;
        const corpo = chain ? corpoById.get(chain.corpo_id) : undefined;
        const puesto = puestoById.get(r.puesto_id);
        const emp = empleadoById.get(r.created_by);
        return {
            ...r,
            empresa_id: chain?.empresa_id ?? 0,
            cliente_id: chain?.cliente_id ?? 0,
            division_id: chain?.division_id ?? 0,
            contrato_id: chain?.contrato_id ?? 0,
            corpo_id: chain?.corpo_id ?? 0,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : "—",
            cliente_nombre: cliente?.nombre ?? "—",
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : "—",
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : "—",
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : "—",
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            responsable_nombre: emp ? empleadoDisplayName(emp) : String(r.created_by),
            latitud_anterior_txt: excelCellString(r.latitud_anterior ?? ""),
            longitud_anterior_txt: excelCellString(r.longitud_anterior ?? ""),
            latitud_nueva_txt: excelCellString(r.latitud_nueva ?? ""),
            longitud_nueva_txt: excelCellString(r.longitud_nueva ?? ""),
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

export async function buildCambiosUbicacionPuestoExcelConsolidado(
    rows: any[],
    reportDb: ReportDataAccess,
    bannerMeta: ConsolidadoBannerMeta,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cambios ubicación puesto");
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
        "Latitud anterior",
        "Longitud anterior",
        "Latitud nueva",
        "Longitud nueva",
        "Responsable",
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
    // Fondo blanco: se oculta la cuadrícula de Excel para que solo se vean los bordes dibujados manualmente.
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
        { width: 22 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
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
            r.latitud_anterior_txt,
            r.longitud_anterior_txt,
            r.latitud_nueva_txt,
            r.longitud_nueva_txt,
            r.responsable_nombre,
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
