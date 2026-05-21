/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";

export type RegistroVehiculosCorporativosModuleFilters = ActaEntregaModuleFilters & {
    tiposVehiculo?: string[] | null;
    placas?: string[] | null;
    placaContains?: string | null;
    anno?: number | null;
    modeloContains?: string | null;
    tiposAutoria?: string[] | null;
};

export type RegistroVehiculosCorporativosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const USO_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;
const MANT_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

function toValidStrings(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const out = raw
        .map((x) => String(x ?? "").trim())
        .filter((s) => s.length > 0);
    return [...new Set(out)];
}

function parseAnno(raw: unknown): number | null {
    if (raw == null || String(raw).trim() === "") return null;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : null;
}

export function normalizeRegistroVehiculosCorporativosFilters(raw: unknown): RegistroVehiculosCorporativosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: RegistroVehiculosCorporativosModuleFilters = { ...base };
    const tiposVehiculo = toValidStrings(o.tiposVehiculo);
    const placas = toValidStrings(o.placas);
    const tiposAutoria = toValidStrings(o.tiposAutoria);
    if (tiposVehiculo.length) next.tiposVehiculo = tiposVehiculo;
    if (placas.length) next.placas = placas;
    if (tiposAutoria.length) next.tiposAutoria = tiposAutoria;
    if (o.placaContains != null && String(o.placaContains).trim() !== "") {
        next.placaContains = String(o.placaContains).trim();
    }
    if (o.modeloContains != null && String(o.modeloContains).trim() !== "") {
        next.modeloContains = String(o.modeloContains).trim();
    }
    const anno = parseAnno(o.anno);
    if (anno != null) next.anno = anno;
    return next;
}

export function hasRegistroVehiculosCorporativosListModuleFiltersContent(
    f: RegistroVehiculosCorporativosModuleFilters,
): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds?.length) return true;
    if (f.clienteIds?.length) return true;
    if (f.divisionIds?.length) return true;
    if (f.contratoIds?.length) return true;
    if (f.corpoIds?.length) return true;
    if (f.puestoIds?.length) return true;
    if (f.tiposVehiculo?.length) return true;
    if (f.placas?.length) return true;
    if (f.placaContains) return true;
    if (f.anno != null) return true;
    if (f.modeloContains) return true;
    if (f.tiposAutoria?.length) return true;
    return false;
}

function overlapsStrings(left?: string[] | null, right?: string[] | null): boolean {
    if (!left || left.length === 0) return true;
    if (!right || right.length === 0) return false;
    return left.some((x) => right.includes(x));
}

export function filtersMatchRegistroVehiculosCorporativosListQuery(
    parsedRowFilters: any,
    listModuleFilters?: RegistroVehiculosCorporativosModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeRegistroVehiculosCorporativosFilters(parsedRowFilters?.moduleFilters || {});
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
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlapsStrings(listModuleFilters.tiposVehiculo ?? undefined, saved.tiposVehiculo ?? undefined)) return false;
    if (!overlapsStrings(listModuleFilters.placas ?? undefined, saved.placas ?? undefined)) return false;
    if (
        listModuleFilters.placaContains &&
        String(saved.placaContains || "").toLowerCase() !== String(listModuleFilters.placaContains).toLowerCase()
    ) {
        return false;
    }
    if (listModuleFilters.anno != null && saved.anno !== listModuleFilters.anno) return false;
    if (
        listModuleFilters.modeloContains &&
        String(saved.modeloContains || "").toLowerCase() !== String(listModuleFilters.modeloContains).toLowerCase()
    ) {
        return false;
    }
    if (!overlapsStrings(listModuleFilters.tiposAutoria ?? undefined, saved.tiposAutoria ?? undefined)) return false;
    return true;
}

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

function applyDataRow(row: ExcelJS.Row, cols: number) {
    row.eachCell((cell, col) => {
        if (col <= cols) {
            cell.border = borderThin;
            cell.alignment = { wrapText: true, vertical: "top" };
        }
    });
}

async function vehicleIdsForField(
    prisma: PrismaClient,
    field: "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "sucursal_id" | "puesto_id",
    ids: number[],
): Promise<Set<number>> {
    const rows = await prisma.c_vehiculos_corporativos.findMany({
        where: { [field]: { in: ids } },
        select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
}

async function resolveVehicleIdsFromStructure(
    prisma: PrismaClient,
    f: RegistroVehiculosCorporativosModuleFilters,
): Promise<Set<number> | undefined> {
    const sets: Set<number>[] = [];
    if (f.empresaIds?.length) sets.push(await vehicleIdsForField(prisma, "empresa_id", f.empresaIds));
    if (f.clienteIds?.length) sets.push(await vehicleIdsForField(prisma, "cliente_id", f.clienteIds));
    if (f.divisionIds?.length) sets.push(await vehicleIdsForField(prisma, "division_id", f.divisionIds));
    if (f.contratoIds?.length) sets.push(await vehicleIdsForField(prisma, "contrato_id", f.contratoIds));
    if (f.corpoIds?.length) sets.push(await vehicleIdsForField(prisma, "sucursal_id", f.corpoIds));
    if (f.puestoIds?.length) sets.push(await vehicleIdsForField(prisma, "puesto_id", f.puestoIds));
    if (sets.length === 0) return undefined;
    let acc = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
        const next = new Set<number>();
        for (const id of acc) {
            if (sets[i].has(id)) next.add(id);
        }
        acc = next;
    }
    return acc;
}

type UsoRow = {
    id: number;
    vehiculo_id: number;
    nombre_conductor: string;
    codigo_conductor: string;
    fecha_txt: string;
    inicio_txt: string;
    fin_txt: string;
    km_inicio: number;
    km_fin: number;
    motivo: string;
    combustible_inicio: string;
    combustible_fin: string;
};

type MantenimientoRow = {
    id: number;
    vehiculo_id: number;
    fecha_txt: string;
    tipo: string;
    mantenimiento: string;
    diagnostico: string;
    kilometraje_siguiente_revision: number;
    nombre_mecanico: string;
    created_at_txt: string;
};

export type RegistroVehiculoCorporativoReportRow = {
    id: number;
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
    placa: string;
    tipo: string;
    marca: string;
    modelo: string;
    anno: number | null;
    kilometraje: number | null;
    prox_cambio_aceite: number | null;
    estado: string;
    tipo_autoria: string;
    descripcion: string;
    titulo_propiedad_txt: string;
    rtv_txt: string;
    marchamo_txt: string;
    activo_txt: string;
    created_at_txt: string;
    usos_count: number;
    mantenimientos_count: number;
    usos: UsoRow[];
    mantenimientos: MantenimientoRow[];
};

async function loadHierarchyMaps(
    prisma: PrismaClient,
    empresaIds: number[],
    clienteIds: number[],
    divisionIds: number[],
    contratoIds: number[],
    sucursalIds: number[],
    puestoIds: number[],
) {
    const [empresas, clientes, divisiones, contratos, sucursales, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({
                  where: { id: { in: empresaIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({
                  where: { id: { in: clienteIds } },
                  select: { id: true, nombre: true },
              })
            : [],
        divisionIds.length
            ? prisma.n_division.findMany({
                  where: { id: { in: divisionIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({
                  where: { id: { in: contratoIds } },
                  select: { id: true, nombre: true, nro_contrato: true },
              })
            : [],
        sucursalIds.length
            ? prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: sucursalIds } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
            : [],
        puestoIds.length
            ? prisma.e_estructura_puesto.findMany({
                  where: { id: { in: puestoIds }, deleted: null },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
    ]);
    return {
        empresaById: new Map(empresas.map((e) => [e.id, e])),
        clienteById: new Map(clientes.map((c) => [c.id, c])),
        divisionById: new Map(divisiones.map((d) => [d.id, d])),
        contratoById: new Map(contratos.map((c) => [c.id, c])),
        sucursalById: new Map(sucursales.map((s) => [s.id, s])),
        puestoById: new Map(puestos.map((p) => [p.id, p])),
    };
}

function hierarchyTxt(
    v: {
        empresa_id: number;
        cliente_id: number;
        division_id: number;
        contrato_id: number;
        sucursal_id: number;
        puesto_id: number;
    },
    maps: Awaited<ReturnType<typeof loadHierarchyMaps>>,
) {
    const emp = maps.empresaById.get(v.empresa_id);
    const cli = maps.clienteById.get(v.cliente_id);
    const div = maps.divisionById.get(v.division_id);
    const con = maps.contratoById.get(v.contrato_id);
    const suc = maps.sucursalById.get(v.sucursal_id);
    const puesto = maps.puestoById.get(v.puesto_id);
    return {
        empresa_txt: emp ? `${emp.codigo ? `${emp.codigo} - ` : ""}${emp.nombre}` : "",
        cliente_txt: cli?.nombre ?? "",
        division_txt: div ? `${div.codigo ? `${div.codigo} - ` : ""}${div.nombre}` : "",
        contrato_txt: con ? `${con.nro_contrato ? `${con.nro_contrato} - ` : ""}${con.nombre}` : "",
        corpo_txt: suc ? `${suc.nro_sucursal ? `${suc.nro_sucursal} - ` : ""}${suc.nombre}` : "",
        puesto_txt: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : "",
    };
}

function sortVehicleRows(
    rows: RegistroVehiculoCorporativoReportRow[],
    orderKey: RegistroVehiculosCorporativosOrderKey,
): RegistroVehiculoCorporativoReportRow[] {
    const keyMap: Record<RegistroVehiculosCorporativosOrderKey, keyof RegistroVehiculoCorporativoReportRow> = {
        empresa_id: "empresa_txt",
        cliente_id: "cliente_txt",
        division_id: "division_txt",
        contrato_id: "contrato_txt",
        corpo_id: "corpo_txt",
        puesto_id: "puesto_txt",
        created_at: "created_at_txt",
    };
    const field = keyMap[orderKey] ?? "puesto_txt";
    return [...rows].sort((a, b) => {
        const c = String(a[field]).localeCompare(String(b[field]), "es");
        if (c !== 0) return c;
        return a.id - b.id;
    });
}

export async function queryRegistroVehiculosCorporativosRows(
    prisma: PrismaClient,
    filters: RegistroVehiculosCorporativosModuleFilters,
    orderKey: RegistroVehiculosCorporativosOrderKey,
): Promise<RegistroVehiculoCorporativoReportRow[]> {
    const vehicleSet = await resolveVehicleIdsFromStructure(prisma, filters);
    if (vehicleSet !== undefined && vehicleSet.size === 0) return [];

    const where: any = {};
    if (vehicleSet !== undefined) where.id = { in: [...vehicleSet] };

    const cDesde = parseBoundaryDateTime(filters.creadoDesde);
    const cHasta = parseBoundaryDateTime(filters.creadoHasta);
    if (cDesde || cHasta) {
        where.created_at = {};
        if (cDesde) where.created_at.gte = cDesde;
        if (cHasta) where.created_at.lte = cHasta;
    }
    if (filters.tiposVehiculo?.length) where.tipo = { in: filters.tiposVehiculo };
    if (filters.tiposAutoria?.length) where.tipo_autoria = { in: filters.tiposAutoria };
    if (filters.placas?.length) {
        where.placa = { in: filters.placas };
    } else if (filters.placaContains) {
        where.placa = { contains: filters.placaContains };
    }
    if (filters.anno != null) where.anno = filters.anno;
    if (filters.modeloContains) where.modelo = { contains: filters.modeloContains };

    const vehiculos = await prisma.c_vehiculos_corporativos.findMany({
        where,
        orderBy: { id: "asc" },
        include: {
            c_usos_vehiculos_corporativos: { orderBy: { id: "asc" } },
            c_mantenimiento_vehiculos_corporativos: { orderBy: { id: "asc" } },
        },
        take: 5000,
    });
    if (!vehiculos.length) return [];

    const empresaIds = [...new Set(vehiculos.map((v) => v.empresa_id).filter((id) => id > 0))];
    const clienteIds = [...new Set(vehiculos.map((v) => v.cliente_id).filter((id) => id > 0))];
    const divisionIds = [...new Set(vehiculos.map((v) => v.division_id).filter((id) => id > 0))];
    const contratoIds = [...new Set(vehiculos.map((v) => v.contrato_id).filter((id) => id > 0))];
    const sucursalIds = [...new Set(vehiculos.map((v) => v.sucursal_id).filter((id) => id > 0))];
    const puestoIds = [...new Set(vehiculos.map((v) => v.puesto_id).filter((id) => id > 0))];
    const maps = await loadHierarchyMaps(
        prisma,
        empresaIds,
        clienteIds,
        divisionIds,
        contratoIds,
        sucursalIds,
        puestoIds,
    );

    const out: RegistroVehiculoCorporativoReportRow[] = [];
    for (const v of vehiculos) {
        const h = hierarchyTxt(v, maps);
        const usos: UsoRow[] = v.c_usos_vehiculos_corporativos.map((u) => ({
            id: u.id,
            vehiculo_id: u.vehiculo_id,
            nombre_conductor: u.nombre_conductor,
            codigo_conductor: u.codigo_conductor,
            fecha_txt: fmtDateTime(u.fecha),
            inicio_txt: fmtDateTime(u.inicio),
            fin_txt: fmtDateTime(u.fin),
            km_inicio: u.km_inicio,
            km_fin: u.km_fin,
            motivo: u.motivo,
            combustible_inicio: u.combustible_inicio,
            combustible_fin: u.combustible_fin,
        }));
        const mantenimientos: MantenimientoRow[] = v.c_mantenimiento_vehiculos_corporativos.map((m) => ({
            id: m.id,
            vehiculo_id: m.vehiculo_id,
            fecha_txt: fmtDateTime(m.fecha),
            tipo: m.tipo,
            mantenimiento: m.mantenimiento,
            diagnostico: m.diagnostico,
            kilometraje_siguiente_revision: m.kilometraje_siguiente_revision,
            nombre_mecanico: m.nombre_mecanico,
            created_at_txt: fmtDateTime(m.created_at),
        }));
        out.push({
            id: v.id,
            empresa_id: v.empresa_id,
            cliente_id: v.cliente_id,
            division_id: v.division_id,
            contrato_id: v.contrato_id,
            corpo_id: v.sucursal_id,
            puesto_id: v.puesto_id,
            ...h,
            placa: v.placa ?? "",
            tipo: v.tipo,
            marca: v.marca,
            modelo: v.modelo ?? "",
            anno: v.anno,
            kilometraje: v.kilometraje,
            prox_cambio_aceite: v.prox_cambio_aceite,
            estado: v.estado,
            tipo_autoria: v.tipo_autoria,
            descripcion: v.descripcion ?? "",
            titulo_propiedad_txt: fmtBool(v.titulo_propiedad),
            rtv_txt: fmtBool(v.rtv),
            marchamo_txt: fmtBool(v.marchamo),
            activo_txt: fmtBool(v.isActive),
            created_at_txt: fmtDateTime(v.created_at),
            usos_count: usos.length,
            mantenimientos_count: mantenimientos.length,
            usos,
            mantenimientos,
        });
    }

    return sortVehicleRows(out, orderKey);
}

const USO_HEADERS = [
    "ID uso",
    "ID vehículo",
    "Nombre conductor",
    "Código conductor",
    "Fecha",
    "Inicio",
    "Fin",
    "KM inicio",
    "KM fin",
    "Motivo",
    "Combustible inicio",
    "Combustible fin",
];

const MANT_HEADERS = [
    "ID mantenimiento",
    "ID vehículo",
    "Fecha",
    "Tipo",
    "Mantenimiento",
    "Diagnóstico",
    "KM siguiente revisión",
    "Nombre mecánico",
    "Fecha de creación",
];

export async function buildRegistroVehiculosCorporativosExcelConsolidado(
    rows: RegistroVehiculoCorporativoReportRow[],
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Vehículos");
    const wsDet = wb.addWorksheet("Detalles");

    const usoAnchorByVehiculoId = new Map<number, number>();
    const mantAnchorByVehiculoId = new Map<number, number>();

    for (const r of rows) {
        const vehLabel = excelCellString(
            `${r.puesto_txt} | ${r.placa || "Sin placa"} | ${r.tipo} | ID ${r.id}`,
        );

        if (r.usos.length) {
            const startU = wsDet.rowCount + 1;
            usoAnchorByVehiculoId.set(r.id, startU);
            wsDet.mergeCells(startU, 1, startU, USO_HEADERS.length);
            const titleU = wsDet.getCell(startU, 1);
            titleU.value = `${vehLabel} — Usos (${r.usos_count})`;
            titleU.font = { bold: true };
            titleU.fill = USO_HDR;
            for (let c = 1; c <= USO_HEADERS.length; c++) wsDet.getCell(startU, c).border = borderThin;
            const hU = wsDet.addRow(USO_HEADERS);
            applyHeaderRow(hU, USO_HEADERS.length, USO_HDR);
            for (const u of r.usos) {
                const dr = wsDet.addRow([
                    u.id,
                    u.vehiculo_id,
                    excelCellString(u.nombre_conductor),
                    excelCellString(u.codigo_conductor),
                    u.fecha_txt,
                    u.inicio_txt,
                    u.fin_txt,
                    u.km_inicio,
                    u.km_fin,
                    excelCellString(u.motivo),
                    excelCellString(u.combustible_inicio),
                    excelCellString(u.combustible_fin),
                ]);
                applyDataRow(dr, USO_HEADERS.length);
            }
            wsDet.addRow([]);
        }

        if (r.mantenimientos.length) {
            const startM = wsDet.rowCount + 1;
            mantAnchorByVehiculoId.set(r.id, startM);
            wsDet.mergeCells(startM, 1, startM, MANT_HEADERS.length);
            const titleM = wsDet.getCell(startM, 1);
            titleM.value = `${vehLabel} — Mantenimientos (${r.mantenimientos_count})`;
            titleM.font = { bold: true };
            titleM.fill = MANT_HDR;
            for (let c = 1; c <= MANT_HEADERS.length; c++) wsDet.getCell(startM, c).border = borderThin;
            const hM = wsDet.addRow(MANT_HEADERS);
            applyHeaderRow(hM, MANT_HEADERS.length, MANT_HDR);
            for (const m of r.mantenimientos) {
                const dr = wsDet.addRow([
                    m.id,
                    m.vehiculo_id,
                    m.fecha_txt,
                    excelCellString(m.tipo),
                    excelCellString(m.mantenimiento),
                    excelCellString(m.diagnostico),
                    m.kilometraje_siguiente_revision,
                    excelCellString(m.nombre_mecanico),
                    m.created_at_txt,
                ]);
                applyDataRow(dr, MANT_HEADERS.length);
            }
            wsDet.addRow([]);
        }
    }

    const mainHeaders = [
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "ID vehículo",
        "Placa",
        "Tipo de vehículo",
        "Marca",
        "Modelo",
        "Año",
        "Kilometraje",
        "Próximo cambio de aceite",
        "Estado",
        "Tipo de autoría",
        "Descripción",
        "Título de propiedad",
        "RTV",
        "Marchamo",
        "Activo",
        "Fecha de creación",
        "Usos",
        "Mantenimientos",
    ];
    wsMain.addRow(mainHeaders);
    applyHeaderRow(wsMain.getRow(1), mainHeaders.length, GRP_HDR);

    const colUsos = mainHeaders.indexOf("Usos") + 1;
    const colMant = mainHeaders.indexOf("Mantenimientos") + 1;

    for (const r of rows) {
        const usoLink = r.usos_count > 0 ? `Ver usos (${r.usos_count})` : "";
        const mantLink = r.mantenimientos_count > 0 ? `Ver mantenimientos (${r.mantenimientos_count})` : "";
        const row = wsMain.addRow([
            r.empresa_txt,
            r.cliente_txt,
            r.division_txt,
            r.contrato_txt,
            r.corpo_txt,
            r.puesto_txt,
            r.id,
            excelCellString(r.placa),
            r.tipo,
            excelCellString(r.marca),
            excelCellString(r.modelo),
            fmtInt(r.anno),
            fmtInt(r.kilometraje),
            fmtInt(r.prox_cambio_aceite),
            r.estado,
            r.tipo_autoria,
            excelCellString(r.descripcion),
            r.titulo_propiedad_txt,
            r.rtv_txt,
            r.marchamo_txt,
            r.activo_txt,
            r.created_at_txt,
            usoLink,
            mantLink,
        ]);
        applyDataRow(row, mainHeaders.length);
        const usoAnchor = usoAnchorByVehiculoId.get(r.id);
        if (usoAnchor && r.usos_count > 0) {
            const cell = row.getCell(colUsos);
            cell.value = { text: usoLink, hyperlink: `#'Detalles'!A${usoAnchor}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        const mantAnchor = mantAnchorByVehiculoId.get(r.id);
        if (mantAnchor && r.mantenimientos_count > 0) {
            const cell = row.getCell(colMant);
            cell.value = { text: mantLink, hyperlink: `#'Detalles'!A${mantAnchor}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: mainHeaders.length },
    };

    wsMain.columns = [28, 24, 22, 28, 24, 28, 10, 14, 14, 14, 16, 8, 12, 14, 12, 14, 24, 12, 8, 10, 8, 20, 18, 22].map(
        (w) => ({ width: w }),
    );
    wsDet.columns = [12, 12, 22, 14, 20, 20, 20, 10, 10, 28, 16, 16].map((w) => ({ width: w }));

    return Buffer.from(await wb.xlsx.writeBuffer());
}
