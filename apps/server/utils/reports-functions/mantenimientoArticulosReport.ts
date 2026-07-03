/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";
import { resolveManualReportPuestoIds } from "./manualesPuestoReport";
import {
    collectArticuloLinksFromBatch,
    loadArticulosDataByPuesto,
    type ArticuloLink,
} from "./articulosPuestoBatchData";

export type MantenimientoArticulosModuleFilters = ActaEntregaModuleFilters & {
    estados?: string[] | null;
    tiposAccion?: string[] | null;
    solucionadoDesde?: string | null;
    solucionadoHasta?: string | null;
};

export type MantenimientoArticulosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id";

function toValidStrings(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const out = raw
        .map((x) => String(x ?? "").trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== "todos");
    return [...new Set(out)];
}

export function normalizeMantenimientoArticulosFilters(raw: unknown): MantenimientoArticulosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: MantenimientoArticulosModuleFilters = { ...base };
    const estados = toValidStrings(o.estados);
    const tiposAccion = toValidStrings(o.tiposAccion);
    if (estados.length) next.estados = estados;
    if (tiposAccion.length) next.tiposAccion = tiposAccion;
    if (o.solucionadoDesde != null && String(o.solucionadoDesde).trim() !== "") {
        next.solucionadoDesde = String(o.solucionadoDesde);
    }
    if (o.solucionadoHasta != null && String(o.solucionadoHasta).trim() !== "") {
        next.solucionadoHasta = String(o.solucionadoHasta);
    }
    return next;
}

export function hasMantenimientoArticulosListModuleFiltersContent(f: MantenimientoArticulosModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds?.length) return true;
    if (f.clienteIds?.length) return true;
    if (f.divisionIds?.length) return true;
    if (f.contratoIds?.length) return true;
    if (f.corpoIds?.length) return true;
    if (f.puestoIds?.length) return true;
    if (f.estados?.length) return true;
    if (f.tiposAccion?.length) return true;
    if (f.solucionadoDesde) return true;
    if (f.solucionadoHasta) return true;
    return false;
}

function overlapsStrings(left?: string[] | null, right?: string[] | null): boolean {
    if (!left || left.length === 0) return true;
    if (!right || right.length === 0) return false;
    return left.some((x) => right.includes(x));
}

export function filtersMatchMantenimientoArticulosListQuery(
    parsedRowFilters: any,
    listModuleFilters?: MantenimientoArticulosModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeMantenimientoArticulosFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) {
        return false;
    }
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) {
        return false;
    }
    if (listModuleFilters.solucionadoDesde && String(saved.solucionadoDesde || "") !== String(listModuleFilters.solucionadoDesde)) {
        return false;
    }
    if (listModuleFilters.solucionadoHasta && String(saved.solucionadoHasta || "") !== String(listModuleFilters.solucionadoHasta)) {
        return false;
    }
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlapsStrings(listModuleFilters.estados ?? undefined, saved.estados ?? undefined)) return false;
    if (!overlapsStrings(listModuleFilters.tiposAccion ?? undefined, saved.tiposAccion ?? undefined)) return false;
    return true;
}

const MAIN_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

function parseBoundaryDateTime(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function fmtDateTime(v: unknown): string {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtBool(v: boolean | null | undefined): string {
    if (v === true) return "Sí";
    if (v === false) return "No";
    return "";
}

function fmtInt(v: number | null | undefined): string | number {
    if (v == null) return "";
    return v;
}

function applyHeaderRow(row: ExcelJS.Row, cols: number, fill: ExcelJS.Fill) {
    row.font = { bold: true };
    for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        cell.fill = fill;
        cell.border = borderThin as ExcelJS.Borders;
        cell.alignment = { vertical: "middle", wrapText: true };
    }
}

export type MantenimientoArticuloReportRow = {
    empresa_id: number;
    cliente_id: number;
    division_id: number;
    contrato_id: number;
    corpo_id: number;
    puesto_id: number;
    empresa_txt: string;
    cliente_txt: string;
    division_txt: string;
    contrato_txt: string;
    corpo_txt: string;
    puesto_txt: string;
    origen: string;
    articulo_registro_id: number;
    articulo_nombre: string;
    id: number;
    articulo_plan_id: number | null;
    articulo_asignado_id: number | null;
    estado: string;
    cantidad_necesaria: number;
    cantidad_real: number;
    observaciones: string;
    fecha_solucion_txt: string;
    accion: string;
    fecha_inicio_txt: string;
    numero_boleta_proveeduria: string;
    tipo: string;
    marca: string;
    modelo: string;
    serie_placa: string;
    marca_nuevo: string;
    modelo_nuevo: string;
    serie_placa_nuevo: string;
    categoria: string;
    tipo_mantenimiento_art: string;
    fecha_salida_txt: string;
    fecha_entrada_txt: string;
    kilometraje: number | null;
    mant_armas_form: string;
    categoria_mantinimiento: string;
    detalle: string;
    numero_fc: string;
    proveedor: string;
    costo_mo: number | null;
    costo_i: number | null;
    iva: number | null;
    costo_total: number | null;
    fecha_fin_txt: string;
    reincidencia_treinta_dias_txt: string;
    tipo_mant_art_reincid: string;
    created_at_txt: string;
    updated_at_txt: string;
    archivos_adjuntos_count: number;
};

type ExcelColumnDef = { header: string; width: number; value: (r: MantenimientoArticuloReportRow) => string | number };

const MANTENIMIENTO_EXCEL_COLUMNS: ExcelColumnDef[] = [
    { header: "Empresa", width: 28, value: (r) => r.empresa_txt },
    { header: "Cliente", width: 24, value: (r) => r.cliente_txt },
    { header: "División", width: 22, value: (r) => r.division_txt },
    { header: "Contrato", width: 28, value: (r) => r.contrato_txt },
    { header: "Sucursal", width: 24, value: (r) => r.corpo_txt },
    { header: "Puesto", width: 28, value: (r) => r.puesto_txt },
    { header: "Origen del artículo", width: 14, value: (r) => r.origen },
    { header: "ID registro artículo", width: 12, value: (r) => r.articulo_registro_id },
    { header: "Nombre del artículo", width: 28, value: (r) => r.articulo_nombre },
    { header: "ID mantenimiento", width: 12, value: (r) => r.id },
    { header: "ID artículo en plan", width: 12, value: (r) => r.articulo_plan_id ?? "" },
    { header: "ID artículo asignado", width: 12, value: (r) => r.articulo_asignado_id ?? "" },
    { header: "Estado", width: 12, value: (r) => r.estado },
    { header: "Cantidad necesaria", width: 12, value: (r) => r.cantidad_necesaria },
    { header: "Cantidad real", width: 12, value: (r) => r.cantidad_real },
    { header: "Observaciones", width: 36, value: (r) => excelCellString(r.observaciones) },
    { header: "Fecha de solución", width: 20, value: (r) => r.fecha_solucion_txt },
    { header: "Tipo de acción", width: 18, value: (r) => r.accion },
    { header: "Fecha de inicio", width: 20, value: (r) => r.fecha_inicio_txt },
    { header: "Número boleta proveeduría", width: 22, value: (r) => excelCellString(r.numero_boleta_proveeduria) },
    { header: "Tipo", width: 16, value: (r) => excelCellString(r.tipo) },
    { header: "Marca", width: 16, value: (r) => excelCellString(r.marca) },
    { header: "Modelo", width: 16, value: (r) => excelCellString(r.modelo) },
    { header: "Serie o placa", width: 16, value: (r) => excelCellString(r.serie_placa) },
    { header: "Marca (equipo nuevo)", width: 16, value: (r) => excelCellString(r.marca_nuevo) },
    { header: "Modelo (equipo nuevo)", width: 16, value: (r) => excelCellString(r.modelo_nuevo) },
    { header: "Serie o placa (equipo nuevo)", width: 18, value: (r) => excelCellString(r.serie_placa_nuevo) },
    { header: "Categoría", width: 16, value: (r) => excelCellString(r.categoria) },
    { header: "Tipo de mantenimiento del artículo", width: 24, value: (r) => excelCellString(r.tipo_mantenimiento_art) },
    { header: "Fecha de salida", width: 20, value: (r) => r.fecha_salida_txt },
    { header: "Fecha de entrada", width: 20, value: (r) => r.fecha_entrada_txt },
    { header: "Kilometraje", width: 12, value: (r) => fmtInt(r.kilometraje) },
    { header: "Formulario mantenimiento de armas", width: 28, value: (r) => excelCellString(r.mant_armas_form) },
    { header: "Categoría de mantenimiento", width: 22, value: (r) => excelCellString(r.categoria_mantinimiento) },
    { header: "Detalle", width: 28, value: (r) => excelCellString(r.detalle) },
    { header: "Número FC", width: 16, value: (r) => excelCellString(r.numero_fc) },
    { header: "Proveedor", width: 20, value: (r) => excelCellString(r.proveedor) },
    { header: "Costo mano de obra", width: 14, value: (r) => fmtInt(r.costo_mo) },
    { header: "Costo insumos", width: 14, value: (r) => fmtInt(r.costo_i) },
    { header: "IVA", width: 12, value: (r) => fmtInt(r.iva) },
    { header: "Costo total", width: 14, value: (r) => fmtInt(r.costo_total) },
    { header: "Fecha de fin", width: 20, value: (r) => r.fecha_fin_txt },
    { header: "Reincidencia en 30 días", width: 14, value: (r) => r.reincidencia_treinta_dias_txt },
    { header: "Tipo mantenimiento (reincidencia)", width: 24, value: (r) => excelCellString(r.tipo_mant_art_reincid) },
    { header: "Fecha de creación", width: 20, value: (r) => r.created_at_txt },
    { header: "Fecha de actualización", width: 20, value: (r) => r.updated_at_txt },
    { header: "Cantidad de archivos adjuntos", width: 14, value: (r) => r.archivos_adjuntos_count },
];

type ArticuloLinkRef = ArticuloLink;

async function collectArticuloLinksForPuestos(
    prisma: ReportDataAccess,
    puestos: { id: number; sucursal_id: number | null; comboArticulosCP_id: number | null }[],
): Promise<ArticuloLinkRef[]> {
    const batch = await loadArticulosDataByPuesto(prisma, puestos);
    return collectArticuloLinksFromBatch(puestos, batch);
}

async function loadHierarchyMaps(prisma: ReportDataAccess, puestoIds: number[]) {
    const puestos = await prisma.e_estructura_puesto.findMany({
        where: { id: { in: puestoIds }, deleted: null },
        select: { id: true, nombre: true, codigo: true, sucursal_id: true },
    });
    const sucursalIds = [...new Set(puestos.map((p) => p.sucursal_id).filter((id): id is number => id != null && id > 0))];
    const sucursales = sucursalIds.length
        ? await prisma.e_estructura_sucursal.findMany({
              where: { id: { in: sucursalIds } },
              select: { id: true, nombre: true, nro_sucursal: true, contrato_id: true },
          })
        : [];
    const contratoIds = [...new Set(sucursales.map((s) => s.contrato_id).filter((id): id is number => id != null && id > 0))];
    const contratos = contratoIds.length
        ? await prisma.e_estructura_contrato.findMany({
              where: { id: { in: contratoIds } },
              select: { id: true, nombre: true, nro_contrato: true, cliente_id: true, division_id: true, empresa_id: true },
          })
        : [];
    const clienteIds = [...new Set(contratos.map((c) => c.cliente_id).filter((id): id is number => id != null && id > 0))];
    const divisionIds = [...new Set(contratos.map((c) => c.division_id).filter((id): id is number => id != null && id > 0))];
    const empresaIds = [...new Set(contratos.map((c) => c.empresa_id).filter((id): id is number => id != null && id > 0))];
    const [clientes, divisiones, empresas] = await Promise.all([
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } })
            : [],
        divisionIds.length
            ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({
                  where: { id: { in: empresaIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
    ]);
    return {
        puestoById: new Map(puestos.map((p) => [p.id, p])),
        sucursalById: new Map(sucursales.map((s) => [s.id, s])),
        contratoById: new Map(contratos.map((c) => [c.id, c])),
        clienteById: new Map(clientes.map((c) => [c.id, c])),
        divisionById: new Map(divisiones.map((d) => [d.id, d])),
        empresaById: new Map(empresas.map((e) => [e.id, e])),
    };
}

function hierarchyLabelsForPuesto(
    puestoId: number,
    maps: Awaited<ReturnType<typeof loadHierarchyMaps>>,
): {
    empresa_id: number;
    cliente_id: number;
    division_id: number;
    contrato_id: number;
    corpo_id: number;
    empresa_txt: string;
    cliente_txt: string;
    division_txt: string;
    contrato_txt: string;
    corpo_txt: string;
    puesto_txt: string;
} {
    const puesto = maps.puestoById.get(puestoId);
    const puestoTxt = puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : "";
    const suc = puesto?.sucursal_id ? maps.sucursalById.get(puesto.sucursal_id) : undefined;
    const con = suc?.contrato_id ? maps.contratoById.get(suc.contrato_id) : undefined;
    const cli = con?.cliente_id ? maps.clienteById.get(con.cliente_id) : undefined;
    const div = con?.division_id ? maps.divisionById.get(con.division_id) : undefined;
    const emp = con?.empresa_id ? maps.empresaById.get(con.empresa_id) : undefined;
    return {
        empresa_id: emp?.id ?? 0,
        cliente_id: cli?.id ?? 0,
        division_id: div?.id ?? 0,
        contrato_id: con?.id ?? 0,
        corpo_id: suc?.id ?? 0,
        empresa_txt: emp ? `${emp.codigo ? `${emp.codigo} - ` : ""}${emp.nombre}` : "",
        cliente_txt: cli?.nombre ?? "",
        division_txt: div ? `${div.codigo ? `${div.codigo} - ` : ""}${div.nombre}` : "",
        contrato_txt: con ? `${con.nro_contrato ? `${con.nro_contrato} - ` : ""}${con.nombre}` : "",
        corpo_txt: suc ? `${suc.nro_sucursal ? `${suc.nro_sucursal} - ` : ""}${suc.nombre}` : "",
        puesto_txt: puestoTxt,
    };
}

function sortMantenimientoRows(rows: MantenimientoArticuloReportRow[], orderKey: MantenimientoArticulosOrderKey): MantenimientoArticuloReportRow[] {
    const keyMap: Record<MantenimientoArticulosOrderKey, keyof MantenimientoArticuloReportRow> = {
        empresa_id: "empresa_txt",
        cliente_id: "cliente_txt",
        division_id: "division_txt",
        contrato_id: "contrato_txt",
        corpo_id: "corpo_txt",
        puesto_id: "puesto_txt",
    };
    const field = keyMap[orderKey] ?? "puesto_txt";
    return [...rows].sort((a, b) => {
        const c = String(a[field]).localeCompare(String(b[field]), "es");
        if (c !== 0) return c;
        return a.id - b.id;
    });
}

export async function queryMantenimientoArticulosRows(
    prisma: ReportDataAccess,
    filters: MantenimientoArticulosModuleFilters,
    orderKey: MantenimientoArticulosOrderKey,
): Promise<MantenimientoArticuloReportRow[]> {
    const puestoSet = await resolveManualReportPuestoIds(prisma, filters);
    if (puestoSet !== undefined && puestoSet.size === 0) return [];

    const puestoWhere: any = { deleted: null };
    if (puestoSet !== undefined) puestoWhere.id = { in: [...puestoSet] };

    const puestos = await prisma.e_estructura_puesto.findMany({
        where: puestoWhere,
        select: { id: true, nombre: true, codigo: true, sucursal_id: true, comboArticulosCP_id: true },
        take: 5000,
    });
    if (!puestos.length) return [];

    const links = await collectArticuloLinksForPuestos(prisma, puestos);
    if (!links.length) return [];

    const planIds = links.filter((l) => l.origen === "Plan").map((l) => l.registro_id);
    const entregaIds = links.filter((l) => l.origen === "Asignado").map((l) => l.registro_id);
    const or: Array<{ articulo_plan_id?: { in: number[] }; articulo_asignado_id?: { in: number[] } }> = [];
    if (planIds.length) or.push({ articulo_plan_id: { in: planIds } });
    if (entregaIds.length) or.push({ articulo_asignado_id: { in: entregaIds } });
    if (!or.length) return [];

    const mantWhere: any = { OR: or };
    const cDesde = parseBoundaryDateTime(filters.creadoDesde);
    const cHasta = parseBoundaryDateTime(filters.creadoHasta);
    if (cDesde || cHasta) {
        mantWhere.created_at = {};
        if (cDesde) mantWhere.created_at.gte = cDesde;
        if (cHasta) mantWhere.created_at.lte = cHasta;
    }
    const sDesde = parseBoundaryDateTime(filters.solucionadoDesde);
    const sHasta = parseBoundaryDateTime(filters.solucionadoHasta);
    if (sDesde || sHasta) {
        mantWhere.fecha_solucion = {};
        if (sDesde) mantWhere.fecha_solucion.gte = sDesde;
        if (sHasta) mantWhere.fecha_solucion.lte = sHasta;
    }
    if (filters.estados?.length) mantWhere.estado = { in: filters.estados };
    if (filters.tiposAccion?.length) mantWhere.accion = { in: filters.tiposAccion };

    const mantenimientos = await prisma.c_articulo_mantenimiento.findMany({
        where: mantWhere,
        orderBy: { id: "asc" },
        include: {
            _count: { select: { c_archivos_adjuntos_articulo_mantenimiento: true } },
        },
    });
    if (!mantenimientos.length) return [];

    const linkByPlan = new Map(links.filter((l) => l.origen === "Plan").map((l) => [l.registro_id, l]));
    const linkByEntrega = new Map(links.filter((l) => l.origen === "Asignado").map((l) => [l.registro_id, l]));

    const puestoIdsUsed = new Set<number>();
    for (const m of mantenimientos) {
        const link =
            m.articulo_plan_id != null
                ? linkByPlan.get(m.articulo_plan_id)
                : m.articulo_asignado_id != null
                  ? linkByEntrega.get(m.articulo_asignado_id)
                  : undefined;
        if (link) puestoIdsUsed.add(link.puesto_id);
    }

    const maps = await loadHierarchyMaps(prisma, [...puestoIdsUsed]);

    const nomencladorIds = new Set<number>();
    for (const l of links) {
        if (l.nomenclador_id) nomencladorIds.add(l.nomenclador_id);
    }
    const nomencladorById = new Map<number, string>();
    if (nomencladorIds.size) {
        const rows = await prisma.n_articulo_corpo_puesto.findMany({
            where: { id: { in: [...nomencladorIds] } },
            select: { id: true, nombre: true },
        });
        for (const r of rows) nomencladorById.set(r.id, r.nombre);
    }

    const out: MantenimientoArticuloReportRow[] = [];
    for (const m of mantenimientos) {
        const isPlan = m.articulo_plan_id != null;
        const link = isPlan ? linkByPlan.get(m.articulo_plan_id!) : linkByEntrega.get(m.articulo_asignado_id!);
        if (!link) continue;
        const h = hierarchyLabelsForPuesto(link.puesto_id, maps);
        const nomName = link.nomenclador_id ? (nomencladorById.get(link.nomenclador_id) ?? "") : "";
        out.push({
            ...h,
            puesto_id: link.puesto_id,
            origen: link.origen,
            articulo_registro_id: link.registro_id,
            articulo_nombre: nomName || "Artículo inidentificable",
            id: m.id,
            articulo_plan_id: m.articulo_plan_id,
            articulo_asignado_id: m.articulo_asignado_id,
            estado: m.estado,
            cantidad_necesaria: m.cantidad_necesaria,
            cantidad_real: m.cantidad_real,
            observaciones: m.observaciones,
            fecha_solucion_txt: fmtDateTime(m.fecha_solucion),
            accion: m.accion ?? "",
            fecha_inicio_txt: fmtDateTime(m.fecha_inicio),
            numero_boleta_proveeduria: m.numero_boleta_proveeduria ?? "",
            tipo: m.tipo ?? "",
            marca: m.marca ?? "",
            modelo: m.modelo ?? "",
            serie_placa: m.serie_placa ?? "",
            marca_nuevo: m.marca_nuevo ?? "",
            modelo_nuevo: m.modelo_nuevo ?? "",
            serie_placa_nuevo: m.serie_placa_nuevo ?? "",
            categoria: m.categoria ?? "",
            tipo_mantenimiento_art: m.tipo_mantenimiento_art ?? "",
            fecha_salida_txt: fmtDateTime(m.fecha_salida),
            fecha_entrada_txt: fmtDateTime(m.fecha_entrada),
            kilometraje: m.kilometraje,
            mant_armas_form: m.mant_armas_form ?? "",
            categoria_mantinimiento: m.categoria_mantinimiento ?? "",
            detalle: m.detalle ?? "",
            numero_fc: m.numero_fc ?? "",
            proveedor: m.proveedor ?? "",
            costo_mo: m.costo_mo,
            costo_i: m.costo_i,
            iva: m.iva,
            costo_total: m.costo_total,
            fecha_fin_txt: fmtDateTime(m.fecha_fin),
            reincidencia_treinta_dias_txt: fmtBool(m.reincidencia_treinta_dias),
            tipo_mant_art_reincid: m.tipo_mant_art_reincid ?? "",
            created_at_txt: fmtDateTime(m.created_at),
            updated_at_txt: fmtDateTime(m.updated_at),
            archivos_adjuntos_count: m._count.c_archivos_adjuntos_articulo_mantenimiento,
        });
    }

    return sortMantenimientoRows(out, orderKey);
}

export async function buildMantenimientoArticulosExcelConsolidado(rows: MantenimientoArticuloReportRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Mantenimiento");

    const headers = MANTENIMIENTO_EXCEL_COLUMNS.map((c) => c.header);
    ws.addRow(headers);
    applyHeaderRow(ws.getRow(1), headers.length, MAIN_HDR);

    for (const r of rows) {
        const row = ws.addRow(MANTENIMIENTO_EXCEL_COLUMNS.map((c) => c.value(r)));
        row.eachCell((cell) => {
            cell.border = borderThin;
            cell.alignment = { wrapText: true, vertical: "top" };
        });
    }

    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };

    ws.columns = MANTENIMIENTO_EXCEL_COLUMNS.map((c) => ({ width: c.width }));

    return Buffer.from(await wb.xlsx.writeBuffer());
}
