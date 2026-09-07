/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";
import { resolveManualReportPuestoIds } from "./manualesPuestoReport";
import {
    loadArticulosDataByPuesto,
    loadComboNamesById,
    loadNomencladorById,
    type ArticuloPuestoBatchSlice,
} from "./articulosPuestoBatchData";

export type ArticulosPuestoModuleFilters = ActaEntregaModuleFilters;
export type ArticulosPuestoOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id";

export const normalizeArticulosPuestoFilters = normalizeActaEntregaFilters;

export function hasArticulosPuestoListModuleFiltersContent(f: ArticulosPuestoModuleFilters): boolean {
    if (f.empresaIds?.length) return true;
    if (f.clienteIds?.length) return true;
    if (f.divisionIds?.length) return true;
    if (f.contratoIds?.length) return true;
    if (f.corpoIds?.length) return true;
    if (f.puestoIds?.length) return true;
    return false;
}

export function filtersMatchArticulosPuestoListQuery(
    parsedRowFilters: any,
    listModuleFilters?: ArticulosPuestoModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeArticulosPuestoFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    return true;
}

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const ART_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;
const MOV_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

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

function fmtDate(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function fmtTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function normalizeSignatureDataUri(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureDataForExcel(dataUriOrBase64: unknown): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        return { extension: m[1].toLowerCase() === "png" ? "png" : "jpeg", base64: String(m[2]).replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/^data:image\/\w+;base64,/, "").replace(/\s+/g, "") };
}

function articuloMovKey(origen: string, registroId: number): string {
    return origen === "Asignado" ? `a:${registroId}` : `p:${registroId}`;
}

type MovimientoArticuloRow = {
    id: number;
    nombre_persona_recibe: string;
    nombre_persona_entrega: string;
    departamento: string;
    telefono: string;
    entrega: string;
    recibe: string;
    fecha: Date;
    hora: Date;
    firma_entrega: string | null;
    firma_recibe: string | null;
    firma_responsable: string;
};

type ArticuloDetalleRow = {
    puesto_id: number;
    puesto_txt: string;
    origen: string;
    registro_id: number;
    articulo_nombre: string;
    cantidad: number | string;
    marca: string;
    modelo: string;
    serie: string;
    fecha_entrega: string;
    combo_nombre: string;
    nomenclador_nombre: string;
    movimientos_count: number;
    movimientos: MovimientoArticuloRow[];
};

type PuestoReportRow = {
    puesto_id: number;
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
    articulos_count: number;
    articulos: ArticuloDetalleRow[];
};

function buildArticulosDetalleFromSlice(
    puestoId: number,
    puestoTxt: string,
    slice: ArticuloPuestoBatchSlice,
    nomencladorById: Map<number, string>,
    comboById: Map<number, string>,
): ArticuloDetalleRow[] {
    const out: ArticuloDetalleRow[] = [];
    const { combo, comboPlans, directPlans, entregas } = slice;

    for (const art of comboPlans) {
        out.push({
            puesto_id: puestoId,
            puesto_txt: puestoTxt,
            origen: "Plan (combo)",
            registro_id: art.id,
            articulo_nombre: "",
            cantidad: art.cantidad ?? 0,
            marca: "",
            modelo: "",
            serie: "",
            fecha_entrega: "",
            combo_nombre: combo?.nombre ?? "",
            nomenclador_nombre: "",
            movimientos_count: 0,
            movimientos: [],
        });
    }

    for (const art of directPlans) {
        out.push({
            puesto_id: puestoId,
            puesto_txt: puestoTxt,
            origen: "Plan",
            registro_id: art.id,
            articulo_nombre: "",
            cantidad: art.cantidad ?? 0,
            marca: "",
            modelo: "",
            serie: "",
            fecha_entrega: "",
            combo_nombre: "",
            nomenclador_nombre: "",
            movimientos_count: 0,
            movimientos: [],
        });
    }

    for (const art of entregas) {
        out.push({
            puesto_id: puestoId,
            puesto_txt: puestoTxt,
            origen: "Asignado",
            registro_id: art.id,
            articulo_nombre: "",
            cantidad: 1,
            marca: art.marca ?? "",
            modelo: art.modelo ?? "",
            serie: art.serie ?? "",
            fecha_entrega: fmtDateTime(art.fechaEntrega),
            combo_nombre: "",
            nomenclador_nombre: "",
            movimientos_count: 0,
            movimientos: [],
        });
    }

    const planById = new Map([...comboPlans, ...directPlans].map((p) => [p.id, p]));
    for (const row of out) {
        if (row.origen === "Plan" || row.origen === "Plan (combo)") {
            const planRow = planById.get(row.registro_id);
            const nomId = planRow?.articuloCP_id;
            if (nomId) row.nomenclador_nombre = nomencladorById.get(nomId) ?? "";
            const comboId = planRow?.combo_id;
            if (comboId && !row.combo_nombre) row.combo_nombre = comboById.get(comboId) ?? "";
            row.articulo_nombre = row.nomenclador_nombre || "Artículo inidentificable";
        } else {
            const ent = entregas.find((e) => e.id === row.registro_id);
            const nomId = ent?.nomencladorArticuloCP_id;
            if (nomId) row.nomenclador_nombre = nomencladorById.get(nomId) ?? "";
            row.articulo_nombre = row.nomenclador_nombre || "Artículo inidentificable";
        }
    }

    return out;
}

async function enrichArticulosDetalleWithMovCounts(
    prisma: ReportDataAccess,
    articulosByPuesto: ArticuloDetalleRow[][],
): Promise<void> {
    const all = articulosByPuesto.flat();
    await attachMovimientosCounts(prisma, all);
}


async function attachMovimientosCounts(prisma: ReportDataAccess, articulos: ArticuloDetalleRow[]): Promise<void> {
    if (!articulos.length) return;
    const planIds = new Set<number>();
    const asignadoIds = new Set<number>();
    for (const a of articulos) {
        if (a.origen === "Asignado") asignadoIds.add(a.registro_id);
        else planIds.add(a.registro_id);
    }
    const or: Array<{ articulo_plan_id?: { in: number[] }; articulo_asignado_id?: { in: number[] } }> = [];
    if (planIds.size) or.push({ articulo_plan_id: { in: [...planIds] } });
    if (asignadoIds.size) or.push({ articulo_asignado_id: { in: [...asignadoIds] } });
    if (!or.length) return;

    const movs = await prisma.c_movimientos_articulo_mantenimiento.findMany({
        where: { OR: or },
        select: { id: true, articulo_plan_id: true, articulo_asignado_id: true },
    });

    const countByPlan = new Map<number, number>();
    const countByAsignado = new Map<number, number>();
    for (const m of movs) {
        if (m.articulo_plan_id) countByPlan.set(m.articulo_plan_id, (countByPlan.get(m.articulo_plan_id) ?? 0) + 1);
        if (m.articulo_asignado_id) {
            countByAsignado.set(m.articulo_asignado_id, (countByAsignado.get(m.articulo_asignado_id) ?? 0) + 1);
        }
    }

    for (const a of articulos) {
        a.movimientos_count =
            a.origen === "Asignado"
                ? (countByAsignado.get(a.registro_id) ?? 0)
                : (countByPlan.get(a.registro_id) ?? 0);
        a.movimientos = [];
    }
}

async function attachMovimientosToArticulos(prisma: ReportDataAccess, articulos: ArticuloDetalleRow[]): Promise<void> {
    if (!articulos.length) return;
    const planIds = new Set<number>();
    const asignadoIds = new Set<number>();
    for (const a of articulos) {
        if (a.origen === "Asignado") asignadoIds.add(a.registro_id);
        else planIds.add(a.registro_id);
    }
    const or: Array<{ articulo_plan_id?: { in: number[] }; articulo_asignado_id?: { in: number[] } }> = [];
    if (planIds.size) or.push({ articulo_plan_id: { in: [...planIds] } });
    if (asignadoIds.size) or.push({ articulo_asignado_id: { in: [...asignadoIds] } });
    if (!or.length) return;

    const movs = await prisma.c_movimientos_articulo_mantenimiento.findMany({
        where: { OR: or },
        orderBy: { id: "asc" },
    });

    const byPlan = new Map<number, MovimientoArticuloRow[]>();
    const byAsignado = new Map<number, MovimientoArticuloRow[]>();
    for (const m of movs) {
        const row: MovimientoArticuloRow = {
            id: m.id,
            nombre_persona_recibe: m.nombre_persona_recibe,
            nombre_persona_entrega: m.nombre_persona_entrega,
            departamento: m.departamento,
            telefono: m.telefono,
            entrega: m.entrega,
            recibe: m.recibe,
            fecha: m.fecha,
            hora: m.hora,
            firma_entrega: m.firma_entrega,
            firma_recibe: m.firma_recibe,
            firma_responsable: m.firma_responsable,
        };
        if (m.articulo_plan_id) {
            const list = byPlan.get(m.articulo_plan_id) ?? [];
            list.push(row);
            byPlan.set(m.articulo_plan_id, list);
        }
        if (m.articulo_asignado_id) {
            const list = byAsignado.get(m.articulo_asignado_id) ?? [];
            list.push(row);
            byAsignado.set(m.articulo_asignado_id, list);
        }
    }

    for (const a of articulos) {
        const list =
            a.origen === "Asignado" ? (byAsignado.get(a.registro_id) ?? []) : (byPlan.get(a.registro_id) ?? []);
        a.movimientos = list;
        a.movimientos_count = list.length;
    }
}

async function loadHierarchyForPuestos(prisma: ReportDataAccess, puestoIds: number[]) {
    const puestos = await prisma.e_estructura_puesto.findMany({
        where: { id: { in: puestoIds }, deleted: null },
        select: { id: true, nombre: true, codigo: true, sucursal_id: true, comboArticulosCP_id: true },
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
        puestos,
        sucursalById: new Map(sucursales.map((s) => [s.id, s])),
        contratoById: new Map(contratos.map((c) => [c.id, c])),
        clienteById: new Map(clientes.map((c) => [c.id, c])),
        divisionById: new Map(divisiones.map((d) => [d.id, d])),
        empresaById: new Map(empresas.map((e) => [e.id, e])),
    };
}

function sortPuestoRows(rows: PuestoReportRow[], orderKey: ArticulosPuestoOrderKey): PuestoReportRow[] {
    const keyMap: Record<ArticulosPuestoOrderKey, keyof PuestoReportRow> = {
        empresa_id: "empresa_txt",
        cliente_id: "cliente_txt",
        division_id: "division_txt",
        contrato_id: "contrato_txt",
        corpo_id: "corpo_txt",
        puesto_id: "puesto_txt",
    };
    const field = keyMap[orderKey] ?? "empresa_txt";
    return [...rows].sort((a, b) => String(a[field]).localeCompare(String(b[field]), "es"));
}

export async function queryArticulosPuestoRows(
    prisma: ReportDataAccess,
    filters: ArticulosPuestoModuleFilters,
    orderKey: ArticulosPuestoOrderKey,
): Promise<PuestoReportRow[]> {
    const puestoSet = await resolveManualReportPuestoIds(prisma, filters);
    if (puestoSet !== undefined && puestoSet.size === 0) return [];

    const puestoWhere: any = { deleted: null };
    if (puestoSet !== undefined) puestoWhere.id = { in: [...puestoSet] };

    const puestoIds = (
        await prisma.e_estructura_puesto.findMany({
            where: puestoWhere,
            select: { id: true },
            take: 5000,
        })
    ).map((p) => p.id);

    if (!puestoIds.length) return [];

    const { puestos, sucursalById, contratoById, clienteById, divisionById, empresaById } =
        await loadHierarchyForPuestos(prisma, puestoIds);

    const batch = await loadArticulosDataByPuesto(prisma, puestos);

    const nomencladorIds = new Set<number>();
    const comboIds = new Set<number>();
    for (const slice of batch.values()) {
        for (const plan of [...slice.comboPlans, ...slice.directPlans]) {
            if (plan.articuloCP_id) nomencladorIds.add(plan.articuloCP_id);
            if (plan.combo_id) comboIds.add(plan.combo_id);
        }
        for (const ent of slice.entregas) {
            if (ent.nomencladorArticuloCP_id) nomencladorIds.add(ent.nomencladorArticuloCP_id);
        }
        if (slice.combo) comboIds.add(slice.combo.id);
    }

    const [nomencladorById, comboById] = await Promise.all([
        loadNomencladorById(prisma, nomencladorIds),
        loadComboNamesById(prisma, comboIds),
    ]);

    const rows: PuestoReportRow[] = [];
    const articulosByPuesto: ArticuloDetalleRow[][] = [];
    for (const puesto of puestos) {
        const puestoTxt = `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}`;
        const suc = puesto.sucursal_id ? sucursalById.get(puesto.sucursal_id) : undefined;
        const con = suc?.contrato_id ? contratoById.get(suc.contrato_id) : undefined;
        const cli = con?.cliente_id ? clienteById.get(con.cliente_id) : undefined;
        const div = con?.division_id ? divisionById.get(con.division_id) : undefined;
        const emp = con?.empresa_id ? empresaById.get(con.empresa_id) : undefined;
        const slice = batch.get(puesto.id);
        const articulos = slice
            ? buildArticulosDetalleFromSlice(puesto.id, puestoTxt, slice, nomencladorById, comboById)
            : [];
        articulosByPuesto.push(articulos);
        rows.push({
            puesto_id: puesto.id,
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
            articulos_count: articulos.length,
            articulos,
        });
    }

    await enrichArticulosDetalleWithMovCounts(prisma, articulosByPuesto);

    return sortPuestoRows(rows, orderKey);
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

function addMovimientoDataRow(
    wb: ExcelJS.Workbook,
    wsMov: ExcelJS.Worksheet,
    m: MovimientoArticuloRow,
): ExcelJS.Row {
    const row = wsMov.addRow([
        String(m.id),
        excelCellString(m.nombre_persona_entrega),
        excelCellString(m.nombre_persona_recibe),
        excelCellString(m.departamento),
        excelCellString(m.telefono),
        excelCellString(m.entrega),
        excelCellString(m.recibe),
        fmtDate(m.fecha),
        fmtTime(m.hora),
        "",
        "",
        excelCellString(m.firma_responsable),
    ]);
    row.eachCell((cell) => {
        cell.border = borderThin;
    });
    row.height = 44;
    const sigEntrega = parseSignatureDataForExcel(m.firma_entrega);
    const sigRecibe = parseSignatureDataForExcel(m.firma_recibe);
    if (sigEntrega) {
        try {
            const imgId = wb.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
            wsMov.addImage(imgId, {
                tl: { col: 9 + 0.08, row: row.number - 1 + 0.06 },
                ext: { width: 110, height: 36 },
                editAs: "oneCell",
            });
        } catch {
            wsMov.getCell(row.number, 10).value = "Inválida";
        }
    }
    if (sigRecibe) {
        try {
            const imgId = wb.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
            wsMov.addImage(imgId, {
                tl: { col: 10 + 0.08, row: row.number - 1 + 0.06 },
                ext: { width: 110, height: 36 },
                editAs: "oneCell",
            });
        } catch {
            wsMov.getCell(row.number, 11).value = "Inválida";
        }
    }
    return row;
}

export async function buildArticulosPuestoExcelConsolidado(
    prisma: ReportDataAccess,
    rows: PuestoReportRow[],
): Promise<Buffer> {
    const allArticulos = rows.flatMap((r) => r.articulos);
    if (allArticulos.length) await attachMovimientosToArticulos(prisma, allArticulos);

    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Puestos");
    const wsArt = wb.addWorksheet("Artículos");
    const wsMov = wb.addWorksheet("Movimientos");

    const movAnchorByKey = new Map<string, number>();
    const movSectionsDone = new Set<string>();

    for (const r of rows) {
        for (const a of r.articulos) {
            if (!a.movimientos.length) continue;
            const key = articuloMovKey(a.origen, a.registro_id);
            if (movSectionsDone.has(key)) continue;
            movSectionsDone.add(key);

            const startMov = wsMov.rowCount + 1;
            movAnchorByKey.set(key, startMov);
            wsMov.mergeCells(startMov, 1, startMov, 12);
            wsMov.getCell(startMov, 1).value = excelCellString(
                `${a.puesto_txt} | ${a.origen} | Registro #${a.registro_id} | ${a.articulo_nombre}`,
            );
            wsMov.getCell(startMov, 1).font = { bold: true };
            wsMov.getCell(startMov, 1).fill = MOV_HDR;
            for (let c = 1; c <= 12; c++) wsMov.getCell(startMov, c).border = borderThin;

            const h = wsMov.addRow([
                "ID movimiento",
                "Persona entrega",
                "Persona recibe",
                "Departamento",
                "Teléfono",
                "Entrega",
                "Recibe",
                "Fecha",
                "Hora",
                "Firma entrega",
                "Firma recibe",
                "Firma responsable",
            ]);
            applyHeaderRow(h, 12, MOV_HDR);

            for (const m of a.movimientos) {
                addMovimientoDataRow(wb, wsMov, m);
            }
            wsMov.addRow([]);
        }
    }

    /** Cuadrícula jerárquica: Puesto (nivel 0) → Artículo (nivel 1, de tablas de plan/asignación) → Movimiento (nivel 2, de `c_movimientos_articulo_mantenimiento`). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const mainHeaders = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Puesto",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Ver artículos",
        "Origen (artículo)",
        "ID registro (artículo)",
        "Artículo",
        "Cantidad",
        "Marca (artículo)",
        "Modelo (artículo)",
        "Serie (artículo)",
        "Fecha entrega (artículo)",
        "Combo",
        "Nomenclador",
        "Ver movimientos",
        "Persona entrega (movimiento)",
        "Persona recibe (movimiento)",
        "Departamento (movimiento)",
        "Teléfono (movimiento)",
        "Entrega (movimiento)",
        "Recibe (movimiento)",
        "Fecha (movimiento)",
        "Hora (movimiento)",
        "Tiene firma entrega (movimiento)",
        "Tiene firma recibe (movimiento)",
    ];
    const COL_VER_ARTICULOS = 12;
    const COL_VER_MOVIMIENTOS = 23;
    wsMain.addRow(mainHeaders);
    applyHeaderRow(wsMain.getRow(1), mainHeaders.length, GRP_HDR);

    const artHeaders = [
        "Puesto",
        "Origen",
        "ID registro",
        "Artículo",
        "Cantidad",
        "Marca",
        "Modelo",
        "Serie",
        "Fecha entrega",
        "Combo",
        "Nomenclador",
        "Movimientos",
    ];
    wsArt.addRow(artHeaders);
    applyHeaderRow(wsArt.getRow(1), artHeaders.length, ART_HDR);

    const artAnchorByPuestoId = new Map<number, number>();
    const linkMovCol = artHeaders.length;
    let artRow = 2;
    for (const r of rows) {
        if (r.articulos.length) artAnchorByPuestoId.set(r.puesto_id, artRow);
        for (const a of r.articulos) {
            const movKey = articuloMovKey(a.origen, a.registro_id);
            const movAnchor = movAnchorByKey.get(movKey);
            const movCount = a.movimientos_count ?? 0;
            const movLinkText = movCount > 0 ? `Ver movimientos (${movCount})` : "";
            const rr = wsArt.addRow([
                a.puesto_txt,
                a.origen,
                a.registro_id,
                a.articulo_nombre,
                a.cantidad,
                a.marca,
                a.modelo,
                a.serie,
                a.fecha_entrega,
                a.combo_nombre,
                a.nomenclador_nombre,
                movLinkText,
            ]);
            rr.eachCell((c) => {
                c.border = borderThin;
                c.alignment = { wrapText: true, vertical: "top" };
            });
            if (movAnchor && movCount > 0) {
                const cell = rr.getCell(linkMovCol);
                cell.value = { text: movLinkText, hyperlink: `#'Movimientos'!A${movAnchor}` };
                cell.font = { color: { argb: "FF0563C1" }, underline: true };
            }
            artRow += 1;
        }
        if (r.articulos.length) {
            artRow += 1;
        }
    }

    const blank = (n: number) => Array.from({ length: n }, () => "");
    const origenCode = (origen: string): string =>
        origen === "Asignado" ? "as" : origen === "Plan (combo)" ? "pc" : "pl";

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { wrapText: true, vertical: "top" };
        });
        row.getCell(4).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(4).font = { bold: true };
    };

    let totalDataRows = 0;
    for (const r of rows) {
        const anchor = artAnchorByPuestoId.get(r.puesto_id);
        const linkText = r.articulos_count > 0 ? `Ver artículos (${r.articulos_count})` : "Sin artículos";
        const general = [String(r.puesto_id), r.empresa_txt, r.cliente_txt, r.division_txt, r.contrato_txt, r.corpo_txt, r.puesto_txt];

        const rootRow = wsMain.addRow([
            String(r.puesto_id),
            "",
            0,
            "Puesto",
            ...general,
            linkText,
            ...blank(21),
        ]);
        if (anchor && r.articulos_count > 0) {
            const cell = rootRow.getCell(COL_VER_ARTICULOS);
            cell.value = { text: linkText, hyperlink: `#'Artículos'!A${anchor}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        styleDataRow(rootRow, 0);
        totalDataRows += 1;

        for (const a of r.articulos) {
            const artId = `p${r.puesto_id}.${origenCode(a.origen)}${a.registro_id}`;
            const movKey = articuloMovKey(a.origen, a.registro_id);
            const movAnchor = movAnchorByKey.get(movKey);
            const movCount = a.movimientos_count ?? 0;
            const movLinkText = movCount > 0 ? `Ver movimientos (${movCount})` : "";

            const artRowMain = wsMain.addRow([
                artId,
                String(r.puesto_id),
                1,
                "Artículo",
                ...general,
                "",
                a.origen,
                String(a.registro_id),
                a.articulo_nombre,
                String(a.cantidad ?? ""),
                a.marca,
                a.modelo,
                a.serie,
                a.fecha_entrega,
                a.combo_nombre,
                a.nomenclador_nombre,
                movLinkText,
                ...blank(10),
            ]);
            if (movAnchor && movCount > 0) {
                const cell = artRowMain.getCell(COL_VER_MOVIMIENTOS);
                cell.value = { text: movLinkText, hyperlink: `#'Movimientos'!A${movAnchor}` };
                cell.font = { color: { argb: "FF0563C1" }, underline: true };
            }
            styleDataRow(artRowMain, 1);
            totalDataRows += 1;

            for (const m of a.movimientos) {
                const movRow = wsMain.addRow([
                    String(m.id),
                    artId,
                    2,
                    "Movimiento",
                    ...general,
                    "",
                    ...blank(10),
                    "",
                    excelCellString(m.nombre_persona_entrega),
                    excelCellString(m.nombre_persona_recibe),
                    excelCellString(m.departamento),
                    excelCellString(m.telefono),
                    excelCellString(m.entrega),
                    excelCellString(m.recibe),
                    fmtDate(m.fecha),
                    fmtTime(m.hora),
                    m.firma_entrega ? "Sí" : "No",
                    m.firma_recibe ? "Sí" : "No",
                ]);
                styleDataRow(movRow, 2);
                totalDataRows += 1;
            }
        }
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, totalDataRows + 1), column: mainHeaders.length },
    };

    wsMain.columns = [
        { width: 14 }, { width: 16 }, { width: 8 }, { width: 20 }, { width: 10 },
        { width: 28 }, { width: 24 }, { width: 22 }, { width: 28 }, { width: 24 }, { width: 28 },
        { width: 18 },
        { width: 16 }, { width: 14 }, { width: 28 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 22 }, { width: 28 }, { width: 20 },
        { width: 18 },
        { width: 22 }, { width: 22 }, { width: 20 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 18 }, { width: 18 },
    ];
    wsArt.columns = [
        { width: 28 },
        { width: 14 },
        { width: 12 },
        { width: 28 },
        { width: 10 },
        { width: 14 },
        { width: 14 },
        { width: 20 },
        { width: 22 },
        { width: 28 },
        { width: 20 },
    ];
    wsMov.columns = [12, 22, 22, 20, 16, 18, 18, 14, 12, 18, 18, 22].map((w) => ({ width: w }));

    return Buffer.from(await wb.xlsx.writeBuffer());
}
