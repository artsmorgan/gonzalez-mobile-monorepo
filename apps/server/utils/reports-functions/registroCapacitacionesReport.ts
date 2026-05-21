/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";

export type RegistroCapacitacionesModuleFilters = ActaEntregaModuleFilters & {
    tipoCapacitacion?: "todos" | "Presencial" | "Virtual" | null;
    capacitacionEmpleadoIds?: number[] | null;
    capacitacionPuestoIds?: number[] | null;
    responsableIds?: number[] | null;
};

export type RegistroCapacitacionesOrderKey =
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

function toDateOnly(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function fmtDate(d: Date | null | undefined): string {
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function puestoDisplayName(p: { codigo: string | null; nombre: string }): string {
    return p.codigo ? `${p.codigo} - ${p.nombre}` : p.nombre;
}

const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};
const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

export function normalizeRegistroCapacitacionesFilters(raw: unknown): RegistroCapacitacionesModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const tipoRaw = String(o.tipoCapacitacion ?? "todos").trim();
    const tipoCapacitacion =
        tipoRaw === "Presencial" || tipoRaw === "Virtual" ? (tipoRaw as "Presencial" | "Virtual") : "todos";
    const capEmp = toValidIds(o.capacitacionEmpleadoIds);
    const capPto = toValidIds(o.capacitacionPuestoIds);
    const resp = toValidIds(o.responsableIds);
    return {
        ...base,
        tipoCapacitacion,
        ...(capEmp.length ? { capacitacionEmpleadoIds: capEmp } : {}),
        ...(capPto.length ? { capacitacionPuestoIds: capPto } : {}),
        ...(resp.length ? { responsableIds: resp } : {}),
    };
}

export function hasRegistroCapacitacionesListModuleFiltersContent(f: RegistroCapacitacionesModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.tipoCapacitacion && f.tipoCapacitacion !== "todos") return true;
    if (f.capacitacionEmpleadoIds?.length || f.capacitacionPuestoIds?.length) return true;
    if (f.responsableIds?.length) return true;
    return false;
}

export function filtersMatchRegistroCapacitacionesListQuery(
    parsedRowFilters: any,
    listModuleFilters?: RegistroCapacitacionesModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeRegistroCapacitacionesFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.capacitacionEmpleadoIds ?? undefined, saved.capacitacionEmpleadoIds ?? undefined))
        return false;
    if (!overlaps(listModuleFilters.capacitacionPuestoIds ?? undefined, saved.capacitacionPuestoIds ?? undefined))
        return false;
    if (!overlaps(listModuleFilters.responsableIds ?? undefined, saved.responsableIds ?? undefined)) return false;
    const lt = listModuleFilters.tipoCapacitacion ?? "todos";
    const st = saved.tipoCapacitacion ?? "todos";
    if (lt !== "todos" && lt !== st) return false;
    return true;
}

function buildWhere(filters: RegistroCapacitacionesModuleFilters): any {
    const where: any = { isActive: true };
    const desde = parseNaiveDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseNaiveDateTime(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = toDateOnly(desde);
        if (hasta) where.fecha.lte = toDateOnly(hasta);
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.tipoCapacitacion && filters.tipoCapacitacion !== "todos") {
        where.tipo = filters.tipoCapacitacion;
    }
    if (filters.capacitacionEmpleadoIds?.length) {
        where.e_capacitacion_empleado = { some: { empleado_id: { in: filters.capacitacionEmpleadoIds } } };
    }
    if (filters.capacitacionPuestoIds?.length) {
        where.e_capacitacion_puesto = { some: { puesto_id: { in: filters.capacitacionPuestoIds } } };
    }
    if (filters.responsableIds?.length) {
        where.responsable_id = { in: filters.responsableIds };
    }
    return where;
}

export async function queryRegistroCapacitacionesRows(
    prisma: PrismaClient,
    filters: RegistroCapacitacionesModuleFilters,
    orderKey: RegistroCapacitacionesOrderKey,
) {
    const rows = await prisma.e_registro_capacitaciones.findMany({
        where: buildWhere(filters),
        orderBy: { id: "desc" },
        take: 50_000,
        include: {
            e_capacitacion_empleado: {
                include: {
                    c_empleado: {
                        select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true },
                    },
                },
            },
            e_capacitacion_puesto: {
                include: {
                    e_estructura_puesto: { select: { id: true, codigo: true, nombre: true } },
                },
            },
        },
    });

    const empresaIds = [...new Set(rows.map((r) => r.empresa_id).filter((n) => n > 0))];
    const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter((n) => n > 0))];
    const divisionIds = [...new Set(rows.map((r) => r.division_id).filter((n) => n > 0))];
    const contratoIds = [...new Set(rows.map((r) => r.contrato_id).filter((n) => n > 0))];
    const corpoIds = [...new Set(rows.map((r) => r.corpo_id).filter((n) => n > 0))];
    const puestoIds = [...new Set(rows.map((r) => r.puesto_id).filter((n) => n > 0))];
    const responsableIds = [...new Set(rows.map((r) => r.responsable_id).filter((n) => n > 0))];

    const [empresas, clientes, divisiones, contratos, corpos, puestos, responsables] = await Promise.all([
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
        responsableIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: responsableIds } },
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
    const responsableById = new Map(responsables.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(r.empresa_id);
        const cliente = clienteById.get(r.cliente_id);
        const division = divisionById.get(r.division_id);
        const contrato = contratoById.get(r.contrato_id);
        const corpo = corpoById.get(r.corpo_id);
        const puesto = puestoById.get(r.puesto_id);
        const resp = responsableById.get(r.responsable_id);
        const fecha = r.fecha instanceof Date ? r.fecha : new Date(String(r.fecha));
        const empleadosCap = (r.e_capacitacion_empleado || []).map((link) => {
            const e = link.c_empleado;
            return e
                ? {
                      id: e.id,
                      label: empleadoDisplayName(e),
                      cedula: e.cedula ?? "",
                  }
                : { id: link.empleado_id, label: String(link.empleado_id), cedula: "" };
        });
        const puestosCap = (r.e_capacitacion_puesto || []).map((link) => {
            const p = link.e_estructura_puesto;
            return p
                ? { id: p.id, label: puestoDisplayName(p) }
                : { id: link.puesto_id, label: String(link.puesto_id) };
        });
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : "—",
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : "—",
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? puestoDisplayName(puesto) : r.puesto_id > 0 ? String(r.puesto_id) : "—",
            responsable_nombre: resp ? empleadoDisplayName(resp) : excelCellString(r.nombre_responsable),
            fecha_txt: fmtDate(fecha),
            empleados_cap_txt: empleadosCap.map((x) => x.label).join("; "),
            puestos_cap_txt: puestosCap.map((x) => x.label).join("; "),
            empleados_cap: empleadosCap,
            puestos_cap: puestosCap,
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
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }
    });
}

function appendDetalleCapacitacionBlocks(
    wsDet: ExcelJS.Worksheet,
    r: any,
): { rowEmpleados: number; rowPuestos: number } {
    const maxCol = 4;
    const titleRow = wsDet.rowCount + 1;
    wsDet.mergeCells(titleRow, 1, titleRow, maxCol);
    wsDet.getCell(titleRow, 1).value = `Capacitación #${r.id} — ${excelCellString(r.titulo)}`;
    wsDet.getCell(titleRow, 1).font = { bold: true, size: 12 };
    wsDet.getCell(titleRow, 1).fill = GRP_HDR;
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(titleRow, c).border = borderThin;

    const rowEmpTitle = wsDet.rowCount + 1;
    wsDet.mergeCells(rowEmpTitle, 1, rowEmpTitle, maxCol);
    wsDet.getCell(rowEmpTitle, 1).value = "Empleados de la capacitación";
    wsDet.getCell(rowEmpTitle, 1).font = { bold: true };
    wsDet.getCell(rowEmpTitle, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rowEmpTitle, c).border = borderThin;

    const eh = wsDet.addRow(["ID vínculo", "ID empleado", "Código / nombre", "Cédula"]);
    eh.font = { bold: true };
    eh.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    for (const link of r.e_capacitacion_empleado || []) {
        const e = link.c_empleado;
        const row = wsDet.addRow([
            link.id,
            link.empleado_id,
            e ? empleadoDisplayName(e) : String(link.empleado_id),
            e?.cedula ?? "",
        ]);
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "top", wrapText: true };
        });
    }
    if (!(r.e_capacitacion_empleado || []).length) {
        const empty = wsDet.addRow(["—", "—", "Sin empleados vinculados", ""]);
        empty.eachCell((c) => {
            c.border = borderThin;
        });
    }

    const rowPtoTitle = wsDet.rowCount + 1;
    wsDet.mergeCells(rowPtoTitle, 1, rowPtoTitle, maxCol);
    wsDet.getCell(rowPtoTitle, 1).value = "Puestos de la capacitación";
    wsDet.getCell(rowPtoTitle, 1).font = { bold: true };
    wsDet.getCell(rowPtoTitle, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
    for (let c = 1; c <= maxCol; c++) wsDet.getCell(rowPtoTitle, c).border = borderThin;

    const ph = wsDet.addRow(["ID vínculo", "ID puesto", "Código / nombre", ""]);
    ph.font = { bold: true };
    ph.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    for (const link of r.e_capacitacion_puesto || []) {
        const p = link.e_estructura_puesto;
        const row = wsDet.addRow([
            link.id,
            link.puesto_id,
            p ? puestoDisplayName(p) : String(link.puesto_id),
            "",
        ]);
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "top", wrapText: true };
        });
    }
    if (!(r.e_capacitacion_puesto || []).length) {
        const empty = wsDet.addRow(["—", "—", "Sin puestos vinculados", ""]);
        empty.eachCell((c) => {
            c.border = borderThin;
        });
    }

    wsDet.addRow([]);
    return { rowEmpleados: rowEmpTitle, rowPuestos: rowPtoTitle };
}

export async function buildRegistroCapacitacionesExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Registro capacitaciones");
    const wsDet = wb.addWorksheet("Detalles");
    const anchorEmp = new Map<number, number>();
    const anchorPto = new Map<number, number>();

    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        const a = appendDetalleCapacitacionBlocks(wsDet, r);
        anchorEmp.set(Number(r.id), a.rowEmpleados);
        anchorPto.set(Number(r.id), a.rowPuestos);
    }

    const headers = [
        "ID",
        "Fecha",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Título",
        "Tipo",
        "Resultado",
        "Responsable",
        "Empleados de la capacitación",
        "Puestos de la capacitación",
    ];
    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 8 },
        { width: 14 },
        { width: 26 },
        { width: 24 },
        { width: 20 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 32 },
        { width: 14 },
        { width: 14 },
        { width: 24 },
        { width: 28, outlineLevel: 1 },
        { width: 28, outlineLevel: 1 },
    ];

    const colEmp = headers.length - 1;
    const colPto = headers.length;

    for (const r of rows) {
        const re = anchorEmp.get(Number(r.id)) ?? 1;
        const rp = anchorPto.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id,
            r.fecha_txt,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            excelCellString(r.titulo),
            excelCellString(r.tipo),
            excelCellString(r.resultado ?? ""),
            r.responsable_nombre,
            "",
            "",
        ]);
        row.getCell(colEmp).value = { text: "Ver empleados", hyperlink: `#'Detalles'!A${re}` };
        row.getCell(colEmp).font = { color: { argb: "FF0563C1" }, underline: true };
        row.getCell(colPto).value = { text: "Ver puestos", hyperlink: `#'Detalles'!A${rp}` };
        row.getCell(colPto).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell, col) => {
            cell.border = borderThin;
            if (col !== colEmp && col !== colPto) {
                cell.alignment = { vertical: "top", wrapText: true };
            }
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };

    wsDet.columns = [{ width: 14 }, { width: 14 }, { width: 42 }, { width: 18 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
}
