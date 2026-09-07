/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../hydratePreexistentIncludes";

const SOLICITUDES_PERMISO_INCLUDE = {
    c_empleado: {
        select: {
            id: true,
            codigo: true,
            nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
        },
    },
};

export type SolicitudesPermisoModuleFilters = ActaEntregaModuleFilters & {
    empleadoIds?: number[] | null;
    ejecutivoCuentaIds?: number[] | null;
    tiposTurno?: string[] | null;
    tipoSalario?: "todos" | "Con goce" | "Sin goce" | null;
    estado?: "pendiente" | "aprobado" | "rechazado" | null;
};

export type SolicitudesPermisoOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

function parseLocalDateTime(s: string | null | undefined): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(t);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const sec = m[6] != null ? Number(m[6]) : 0;
    const dt = new Date(y, mo, d, h, mi, sec);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtDateTimeCol(d: Date | string | null | undefined): string {
    if (d == null) return "";
    if (d instanceof Date) return d.toISOString().replace("T", " ").slice(0, 19);
    const s = String(d).trim();
    if (!s) return "";
    return s.length >= 19 ? s.slice(0, 19).replace("T", " ") : s;
}

function fmtDateOnly(d: Date | string | null | undefined): string {
    if (d == null) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeSignatureDataUri(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureForExcel(dataUriOrBase64: unknown): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        return { extension: m[1].toLowerCase() === "png" ? "png" : "jpeg", base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/\s+/g, "") };
}

export function safeParseTurnos(raw: unknown): any[] {
    if (!raw) return [];
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeTipoTurnoKey(raw: unknown): string {
    const s = String(raw ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (s.includes("nocturn")) return "nocturno";
    if (s.includes("mixt")) return "mixto";
    if (s.includes("diurn")) return "diurno";
    return s;
}

function recordMatchesTiposTurno(turnosRaw: string | null | undefined, wanted: string[]): boolean {
    if (!wanted.length) return true;
    const wantedKeys = new Set(wanted.map((w) => normalizeTipoTurnoKey(w)));
    const turnos = safeParseTurnos(turnosRaw);
    return turnos.some((t) => wantedKeys.has(normalizeTipoTurnoKey(t?.tipo_turno)));
}

function diffDaysInclusive(inicio: Date, fin: Date): number {
    const a = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const b = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const ms = b.getTime() - a.getTime();
    if (ms < 0) return 0;
    return Math.floor(ms / 86400000) + 1;
}

export function normalizeSolicitudesPermisoFilters(raw: unknown): SolicitudesPermisoModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const emp = toValidIds(o.empleadoIds);
    const eje = toValidIds(o.ejecutivoCuentaIds);
    const tt = Array.isArray(o.tiposTurno)
        ? [...new Set(o.tiposTurno.map((x) => String(x ?? "").trim()).filter(Boolean))]
        : [];
    const tipoRaw = String(o.tipoSalario ?? "todos").trim();
    const tipoSalario =
        tipoRaw === "Con goce" || tipoRaw === "Sin goce" ? (tipoRaw as "Con goce" | "Sin goce") : "todos";
    const estRaw = String(o.estado ?? "").trim().toLowerCase();
    const estado =
        estRaw === "pendiente" || estRaw === "aprobado" || estRaw === "rechazado"
            ? (estRaw as "pendiente" | "aprobado" | "rechazado")
            : null;
    return {
        ...base,
        ...(emp.length ? { empleadoIds: emp } : {}),
        ...(eje.length ? { ejecutivoCuentaIds: eje } : {}),
        ...(tt.length ? { tiposTurno: tt } : {}),
        tipoSalario,
        estado,
    };
}

export function hasSolicitudesPermisoListModuleFiltersContent(f: SolicitudesPermisoModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.empleadoIds?.length || f.ejecutivoCuentaIds?.length) return true;
    if (f.tiposTurno?.length) return true;
    if (f.tipoSalario && f.tipoSalario !== "todos") return true;
    if (f.estado) return true;
    return false;
}

export function filtersMatchSolicitudesPermisoListQuery(
    parsedRowFilters: any,
    listModuleFilters?: SolicitudesPermisoModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeSolicitudesPermisoFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.empleadoIds ?? undefined, saved.empleadoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.ejecutivoCuentaIds ?? undefined, saved.ejecutivoCuentaIds ?? undefined)) return false;
    const lt = listModuleFilters.tiposTurno ?? [];
    const st = saved.tiposTurno ?? [];
    if (lt.length) {
        if (!st.length) return false;
        const setS = new Set(st.map((x) => normalizeTipoTurnoKey(x)));
        for (const t of lt) {
            if (!setS.has(normalizeTipoTurnoKey(t))) return false;
        }
    }
    const lTipo = listModuleFilters.tipoSalario ?? "todos";
    const sTipo = saved.tipoSalario ?? "todos";
    if (lTipo !== "todos" && lTipo !== sTipo) return false;
    if (listModuleFilters.estado && listModuleFilters.estado !== saved.estado) return false;
    return true;
}

function empleadoNombre(e: {
    codigo: string;
    nombre: string | null;
    primer_apellido: string | null;
    segundo_apellido: string | null;
}): string {
    const parts = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean);
    const name = parts.join(" ").trim();
    return name || e.codigo;
}

export async function querySolicitudesPermisoRows(
    prisma: ReportDataAccess,
    filters: SolicitudesPermisoModuleFilters,
    orderKey: SolicitudesPermisoOrderKey,
) {
    const where: any = { isActive: true };
    const desde = parseLocalDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseLocalDateTime(filters.creadoHasta ?? undefined);
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
    if (filters.empleadoIds?.length) where.empleado_id = { in: filters.empleadoIds };
    if (filters.ejecutivoCuentaIds?.length) where.ejecutivo_cuenta = { in: filters.ejecutivoCuentaIds };
    if (filters.tipoSalario && filters.tipoSalario !== "todos") where.tipo = filters.tipoSalario;
    if (filters.estado) where.estado = filters.estado;

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(SOLICITUDES_PERMISO_INCLUDE);

    let rows = await prisma.c_solicitud_permiso.findMany({
        where,
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
        orderBy: { id: "desc" },
        take: 50_000,
    });
    await hydratePreexistentRelations(rows, preexistentSpecs);

    const tiposTurno = filters.tiposTurno ?? [];
    if (tiposTurno.length) {
        rows = rows.filter((r) => recordMatchesTiposTurno(r.turnos, tiposTurno));
    }

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds, ejecutivoIds, reemplazoIds] = [
        ids(rows.map((x) => x.empresa_id)),
        ids(rows.map((x) => x.cliente_id)),
        ids(rows.map((x) => x.division_id)),
        ids(rows.map((x) => x.contrato_id)),
        ids(rows.map((x) => x.corpo_id)),
        ids(rows.map((x) => x.puesto_id)),
        ids(rows.map((x) => x.ejecutivo_cuenta)),
        ids(
            rows.flatMap((r) =>
                safeParseTurnos(r.turnos)
                    .map((t) => Number(t?.reemplazo_id))
                    .filter((n) => Number.isFinite(n) && n > 0),
            ),
        ),
    ];

    const [empresas, clientes, divisiones, contratos, corpos, puestos, ejecutivos, reemplazos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } })
            : [],
        divisionIds.length
            ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
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
        ejecutivoIds.length
            ? prisma.n_ejecutivo_cuenta.findMany({ where: { id: { in: ejecutivoIds } }, select: { id: true, nombre: true } })
            : [],
        reemplazoIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: reemplazoIds } },
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
    const ejecutivoById = new Map(ejecutivos.map((x) => [x.id, x]));
    const reemplazoById = new Map(reemplazos.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const ejecutivo = ejecutivoById.get(Number(r.ejecutivo_cuenta));
        const emp = r.c_empleado;
        const turnos = safeParseTurnos(r.turnos).map((t) => {
            const rid = Number(t?.reemplazo_id);
            const rep = Number.isFinite(rid) && rid > 0 ? reemplazoById.get(rid) : null;
            return {
                ...t,
                reemplazo_nombre: rep ? empleadoNombre(rep) : "",
            };
        });
        const fi = r.fecha_inicio instanceof Date ? r.fecha_inicio : new Date(r.fecha_inicio);
        const ff = r.fecha_fin instanceof Date ? r.fecha_fin : new Date(r.fecha_fin);
        const dias =
            !Number.isNaN(fi.getTime()) && !Number.isNaN(ff.getTime()) ? diffDaysInclusive(fi, ff) : 0;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato
                ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}`
                : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            ejecutivo_cuenta_nombre: ejecutivo?.nombre ?? String(r.ejecutivo_cuenta),
            empleado_nombre: emp ? empleadoNombre(emp) : String(r.empleado_id),
            empleado_codigo: emp?.codigo ?? "",
            created_at_txt: fmtDateTimeCol(r.created_at),
            fecha_inicio_txt: fmtDateOnly(r.fecha_inicio),
            fecha_fin_txt: fmtDateOnly(r.fecha_fin),
            dias_permiso: dias,
            turnos_list: turnos,
            motivo_txt: String(r.motivo ?? "").trim(),
            observaciones_txt: String(r.observaciones ?? "").trim(),
            firma_empleado_manual_data_uri: normalizeSignatureDataUri(r.firma_empleado_manual),
            firma_ejecutivo_manual_data_uri: normalizeSignatureDataUri(r.firma_ejecutivo_cuenta_manual),
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

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const DET_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;
const TITLE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};

type DetalleAnchors = { turnosRow: number; firmaEmpleadoRow: number; firmaEjecutivoRow: number };

function appendSignatureBlock(wsDet: ExcelJS.Worksheet, label: string, sigSource: unknown): number {
    const firmaTitle = wsDet.addRow([label]);
    firmaTitle.font = { bold: true };
    firmaTitle.getCell(1).fill = DET_HDR;
    firmaTitle.getCell(1).border = borderThin;
    const firmaAnchor = firmaTitle.number + 1;

    const firmaRow = wsDet.addRow([""]);
    firmaRow.height = 72;
    const sig = parseSignatureForExcel(sigSource);
    const fCell = firmaRow.getCell(1);
    fCell.border = borderThin;
    if (sig) {
        const imgId = wsDet.workbook.addImage({
            base64: sig.base64,
            extension: sig.extension,
        });
        wsDet.addImage(imgId, {
            tl: { col: 0, row: firmaRow.number - 1 },
            ext: { width: 220, height: 64 },
        });
    } else {
        fCell.value = "Sin firma";
        fCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    wsDet.addRow([]);
    return firmaAnchor;
}

function appendDetalleBlock(wsDet: ExcelJS.Worksheet, r: any): DetalleAnchors {
    const titleRow = wsDet.addRow([`Registro #${r.id}`, String(r.empleado_nombre || ""), `Estado: ${r.estado || ""}`]);
    titleRow.font = { bold: true };
    titleRow.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { vertical: "middle", wrapText: true };
    });

    const motivoRow = wsDet.addRow(["Motivo", String(r.motivo_txt ?? r.motivo ?? "")]);
    motivoRow.getCell(1).font = { bold: true };
    motivoRow.eachCell((c) => {
        c.border = borderThin;
        c.alignment = { vertical: "top", wrapText: true };
    });

    const obsRow = wsDet.addRow(["Observaciones", String(r.observaciones_txt ?? r.observaciones ?? "")]);
    obsRow.getCell(1).font = { bold: true };
    obsRow.eachCell((c) => {
        c.border = borderThin;
        c.alignment = { vertical: "top", wrapText: true };
    });

    wsDet.addRow([]);

    const turnosHdr = wsDet.addRow([
        "Puesto",
        "Hora inicio",
        "Hora fin",
        "Tipo turno",
        "Horas duración",
        "Reemplazo",
    ]);
    turnosHdr.font = { bold: true };
    turnosHdr.eachCell((c) => {
        c.fill = DET_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    const turnosAnchor = turnosHdr.number;

    const turnos: any[] = r.turnos_list?.length ? r.turnos_list : safeParseTurnos(r.turnos);
    if (!turnos.length) {
        const empty = wsDet.addRow(["—", "—", "—", "—", "—", "Sin turnos"]);
        empty.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { wrapText: true };
        });
    } else {
        for (const t of turnos) {
            const row = wsDet.addRow([
                String(t.puesto ?? ""),
                String(t.hora_inicio ?? ""),
                String(t.hora_fin ?? ""),
                String(t.tipo_turno ?? ""),
                String(t.horas_duracion ?? ""),
                String(t.reemplazo_nombre ?? t.reemplazo_id ?? ""),
            ]);
            row.eachCell((c) => {
                c.border = borderThin;
                c.alignment = { wrapText: true, vertical: "top" };
            });
        }
    }

    wsDet.addRow([]);
    const firmaEmpleadoAnchor = appendSignatureBlock(
        wsDet,
        "Firma manual del colaborador",
        r.firma_empleado_manual_data_uri || r.firma_empleado_manual,
    );
    const firmaEjecutivoAnchor = appendSignatureBlock(
        wsDet,
        "Firma manual del ejecutivo de cuenta",
        r.firma_ejecutivo_manual_data_uri || r.firma_ejecutivo_cuenta_manual,
    );

    wsDet.addRow([]);
    return { turnosRow: turnosAnchor, firmaEmpleadoRow: firmaEmpleadoAnchor, firmaEjecutivoRow: firmaEjecutivoAnchor };
}

export async function buildSolicitudesPermisoExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Solicitudes de permiso");
    const wsDet = wb.addWorksheet("Detalles");
    const anchorsById = new Map<number, DetalleAnchors>();

    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        anchorsById.set(Number(r.id), appendDetalleBlock(wsDet, r));
    }

    /** Cuadrícula jerárquica: Solicitud (nivel 0) → Turno (nivel 1, de `turnos`). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Solicitud",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Colaborador",
        "Cód. colaborador",
        "Ejecutivo de cuenta",
        "Tipo salario",
        "Estado",
        "Fecha inicio",
        "Fecha fin",
        "Días",
        "Creado",
        "Motivo",
        "Observaciones",
        "Ver turnos",
        "Firma empleado",
        "Firma ejecutivo",
        "Puesto (turno)",
        "Hora inicio (turno)",
        "Hora fin (turno)",
        "Tipo turno",
        "Horas duración (turno)",
        "Reemplazo (turno)",
    ];
    const colTurnos = headers.indexOf("Ver turnos") + 1;
    const colFirmaEmpleado = headers.indexOf("Firma empleado") + 1;
    const colFirmaEjecutivo = headers.indexOf("Firma ejecutivo") + 1;
    const linkCols = new Set([colTurnos, colFirmaEmpleado, colFirmaEjecutivo]);
    const COL_TIPO_FILA = headers.indexOf("Tipo de fila") + 1;

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = headers.map(() => ({ width: 18 }));

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell, col) => {
            cell.border = borderThin;
            if (!linkCols.has(col)) cell.alignment = { vertical: "top", wrapText: true };
        });
        row.getCell(COL_TIPO_FILA).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(COL_TIPO_FILA).font = { bold: true };
    };

    for (const r of rows) {
        const anchors = anchorsById.get(Number(r.id));
        const general: Record<number, unknown> = {
            [headers.indexOf("ID Solicitud") + 1]: r.id,
            [headers.indexOf("Empresa") + 1]: r.empresa_nombre,
            [headers.indexOf("Cliente") + 1]: r.cliente_nombre,
            [headers.indexOf("División") + 1]: r.division_nombre,
            [headers.indexOf("Contrato") + 1]: r.contrato_nombre,
            [headers.indexOf("Sucursal") + 1]: r.corpo_nombre,
            [headers.indexOf("Puesto") + 1]: r.puesto_nombre,
            [headers.indexOf("Colaborador") + 1]: r.empleado_nombre,
            [headers.indexOf("Cód. colaborador") + 1]: r.empleado_codigo,
            [headers.indexOf("Ejecutivo de cuenta") + 1]: r.ejecutivo_cuenta_nombre,
            [headers.indexOf("Tipo salario") + 1]: r.tipo,
            [headers.indexOf("Estado") + 1]: r.estado,
            [headers.indexOf("Fecha inicio") + 1]: r.fecha_inicio_txt,
            [headers.indexOf("Fecha fin") + 1]: r.fecha_fin_txt,
            [headers.indexOf("Días") + 1]: r.dias_permiso,
            [headers.indexOf("Creado") + 1]: r.created_at_txt,
            [headers.indexOf("Motivo") + 1]: String(r.motivo_txt ?? r.motivo ?? "").slice(0, 500),
            [headers.indexOf("Observaciones") + 1]: String(r.observaciones_txt ?? r.observaciones ?? "").slice(0, 500),
        };

        const rootValues = new Array(headers.length).fill("");
        rootValues[0] = String(r.id);
        rootValues[2] = 0;
        rootValues[3] = "Solicitud";
        for (const [col, val] of Object.entries(general)) rootValues[Number(col) - 1] = val;
        const rootRow = wsMain.addRow(rootValues);
        if (anchors) {
            rootRow.getCell(colTurnos).value = { text: "Ver turnos", hyperlink: `#'Detalles'!A${anchors.turnosRow}` };
            rootRow.getCell(colTurnos).font = { color: { argb: "FF0563C1" }, underline: true };
            rootRow.getCell(colFirmaEmpleado).value = {
                text: "Ver firma",
                hyperlink: `#'Detalles'!A${anchors.firmaEmpleadoRow}`,
            };
            rootRow.getCell(colFirmaEmpleado).font = { color: { argb: "FF0563C1" }, underline: true };
            rootRow.getCell(colFirmaEjecutivo).value = {
                text: "Ver firma",
                hyperlink: `#'Detalles'!A${anchors.firmaEjecutivoRow}`,
            };
            rootRow.getCell(colFirmaEjecutivo).font = { color: { argb: "FF0563C1" }, underline: true };
        }
        styleDataRow(rootRow, 0);

        const turnos: any[] = r.turnos_list?.length ? r.turnos_list : safeParseTurnos(r.turnos);
        turnos.forEach((t: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.turno${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Turno";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Puesto (turno)")] = String(t.puesto ?? "");
            values[headers.indexOf("Hora inicio (turno)")] = String(t.hora_inicio ?? "");
            values[headers.indexOf("Hora fin (turno)")] = String(t.hora_fin ?? "");
            values[headers.indexOf("Tipo turno")] = String(t.tipo_turno ?? "");
            values[headers.indexOf("Horas duración (turno)")] = String(t.horas_duracion ?? "");
            values[headers.indexOf("Reemplazo (turno)")] = String(t.reemplazo_nombre ?? t.reemplazo_id ?? "");
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, wsMain.rowCount), column: headers.length },
    };
    wsDet.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 28 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
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

async function readPngPixelSize(filePath: string): Promise<{ w: number; h: number } | null> {
    try {
        const buf = await fs.readFile(filePath);
        if (buf.length < 24) return null;
        if (buf[0] !== 0x89 || String.fromCharCode(buf[1], buf[2], buf[3]) !== "PNG") return null;
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    } catch {
        return null;
    }
}

function logoExtentForCellBox(natural: { w: number; h: number } | null, maxW: number, maxH: number) {
    if (!natural || natural.w <= 0 || natural.h <= 0) return { width: 72, height: 44 };
    const s = Math.min(maxW / natural.w, maxH / natural.h, 1);
    return { width: Math.max(1, Math.round(natural.w * s)), height: Math.max(1, Math.round(natural.h * s)) };
}

const borderBlack = { style: "thin" as const, color: { argb: "FF000000" } };
const fillWhite = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;

function applyRangeFill(
    ws: ExcelJS.Worksheet,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    fill: ExcelJS.Fill,
) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).fill = fill;
        }
    }
}

function applyRangeOuterBorder(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const prev = cell.border ?? {};
            cell.border = {
                top: r === r1 ? borderBlack : prev.top,
                bottom: r === r2 ? borderBlack : prev.bottom,
                left: c === c1 ? borderBlack : prev.left,
                right: c === c2 ? borderBlack : prev.right,
            };
        }
    }
}

function clearInteriorBottomBorders(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const prev = cell.border ?? {};
            cell.border = { top: prev.top, left: prev.left, right: prev.right };
        }
    }
}

function applyMergeBottomBorder(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number) {
    for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(row, c);
        const prev = cell.border ?? {};
        cell.border = { ...prev, bottom: borderBlack };
    }
}

function markPermisoParentesis(selected: boolean): string {
    return selected ? "( X )" : "(   )";
}

function setCell(
    ws: ExcelJS.Worksheet,
    row: number,
    col: number,
    value: ExcelJS.CellValue,
    align: Partial<ExcelJS.Alignment> = {},
) {
    const cell = ws.getCell(row, col);
    cell.value = value;
    cell.alignment = { vertical: "middle", wrapText: true, ...align };
}

/** Formulario SEG-F-039: una hoja por solicitud (columnas A–I). */
export async function buildSolicitudesPermisoExcelIndividual(rows: any[], reportNombre?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const nombreReporte = String(reportNombre ?? "").trim() || "Solicitud de permiso";

    for (const r of rows) {
        const safeName = `Permiso_${r.id}`.replace(/[^\w-]/g, "_").slice(0, 31);
        const ws = wb.addWorksheet(safeName);
        ws.columns = [
            { width: 12 }, // A
            { width: 20 }, // B
            { width: 14 }, // C
            { width: 14 }, // D
            { width: 14 }, // E
            { width: 14 }, // F
            { width: 20 }, // G
            { width: 14 }, // H
            { width: 8 }, // I
        ];

        const turnosArr: any[] = r.turnos_list?.length ? r.turnos_list : safeParseTurnos(r.turnos);
        const turnosCount = turnosArr.length;
        const conGoce = String(r.tipo || "").toLowerCase().includes("con goce");
        const sinGoce = String(r.tipo || "").toLowerCase().includes("sin goce");
        const rangoFechas = [r.fecha_inicio_txt, r.fecha_fin_txt].filter(Boolean).join(" — ");

        // Fila 1: encabezado
        ws.getRow(1).height = 52;
        ws.mergeCells(1, 1, 1, 2);
        ws.mergeCells(1, 3, 1, 6);
        ws.mergeCells(1, 7, 1, 9);

        const logoPath = await resolveLogoPathByEmpresaId(Number(r.empresa_id || 0));
        if (logoPath) {
            const nat = await readPngPixelSize(logoPath);
            const ext = logoExtentForCellBox(nat, 140, 46);
            const imgId = wb.addImage({ filename: logoPath, extension: "png" });
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext });
        }

        const titleCell = ws.getCell(1, 3);
        titleCell.value = "SOLICITUD DE PERMISOS";
        titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
        titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        for (let c = 3; c <= 6; c++) ws.getCell(1, c).fill = TITLE_FILL;

        setCell(ws, 1, 7, nombreReporte, { horizontal: "center" });
        ws.getCell(1, 7).font = { size: 9, bold: true };
        applyRangeOuterBorder(ws, 1, 1, 1, 9);

        // Cuerpo A2:I17
        applyRangeFill(ws, 2, 1, 17, 9, fillWhite);
        clearInteriorBottomBorders(ws, 2, 1, 17, 9);
        applyRangeOuterBorder(ws, 2, 1, 17, 9);

        // Fila 3: fecha
        setCell(ws, 3, 6, "Fecha:", { horizontal: "right" });
        ws.mergeCells(3, 7, 3, 8);
        setCell(ws, 3, 7, fmtDateOnly(r.created_at), { horizontal: "left" });
        applyMergeBottomBorder(ws, 3, 7, 8);

        // Fila 4: nombre + código
        ws.mergeCells(4, 1, 4, 2);
        setCell(ws, 4, 1, "Nombre del colaborador:", { horizontal: "right" });
        ws.mergeCells(4, 3, 4, 6);
        setCell(ws, 4, 3, String(r.empleado_nombre || ""), { horizontal: "left" });
        applyMergeBottomBorder(ws, 4, 3, 6);
        setCell(ws, 4, 7, "Cód. Colaborador:", { horizontal: "right" });
        setCell(ws, 4, 8, String(r.empleado_codigo || ""), { horizontal: "left" });
        applyMergeBottomBorder(ws, 4, 8, 8);

        // Fila 5: tipo de permiso
        ws.mergeCells(5, 1, 5, 3);
        setCell(ws, 5, 1, `Permiso con goce de salario ${markPermisoParentesis(conGoce)}`, { horizontal: "right" });
        ws.mergeCells(5, 4, 5, 6);
        setCell(ws, 5, 4, `Permiso sin goce de salario ${markPermisoParentesis(sinGoce)}`, { horizontal: "right" });

        // Filas 6–8: motivo
        ws.mergeCells(6, 1, 6, 2);
        setCell(ws, 6, 1, "Motivo de la solicitud:", { horizontal: "right", vertical: "top" });
        ws.mergeCells(6, 3, 8, 8);
        setCell(ws, 6, 3, String(r.motivo_txt ?? r.motivo ?? "").slice(0, 2000), {
            horizontal: "left",
            vertical: "top",
        });
        applyMergeBottomBorder(ws, 8, 3, 8);

        // Fila 9: cantidad de turnos
        ws.mergeCells(9, 1, 9, 3);
        setCell(ws, 9, 1, "Cantidad de días que requiere el permiso:", { horizontal: "right" });
        ws.mergeCells(9, 4, 9, 5);
        setCell(ws, 9, 4, turnosCount, { horizontal: "center" });
        applyMergeBottomBorder(ws, 9, 4, 5);
        setCell(ws, 9, 6, "días", { horizontal: "center" });
        applyMergeBottomBorder(ws, 9, 6, 6);

        // Fila 10: rango de fechas del permiso
        ws.mergeCells(10, 1, 10, 2);
        setCell(ws, 10, 1, "Fecha en las que requiere permiso:", { horizontal: "right" });
        ws.mergeCells(10, 3, 10, 6);
        setCell(ws, 10, 3, `Del: ${rangoFechas || "—"}`, { horizontal: "left" });
        applyMergeBottomBorder(ws, 10, 3, 6);

        // Filas 11–13: observaciones
        ws.mergeCells(11, 1, 11, 2);
        setCell(ws, 11, 1, "Observaciones:", { horizontal: "right", vertical: "top" });
        ws.mergeCells(12, 3, 13, 8);
        setCell(ws, 12, 3, String(r.observaciones_txt ?? r.observaciones ?? "").slice(0, 2000), {
            horizontal: "left",
            vertical: "top",
        });
        applyMergeBottomBorder(ws, 13, 3, 8);

        // Fila 14: firma colaborador
        ws.mergeCells(14, 1, 14, 3);
        setCell(ws, 14, 1, "Firma del colaborador:", { horizontal: "right" });
        ws.mergeCells(14, 4, 14, 7);
        const sigColab = parseSignatureForExcel(r.firma_empleado_manual_data_uri || r.firma_empleado_manual);
        if (sigColab) {
            const imgId = wb.addImage({ base64: sigColab.base64, extension: sigColab.extension });
            ws.addImage(imgId, { tl: { col: 3, row: 13 }, ext: { width: 220, height: 56 } });
        }
        applyMergeBottomBorder(ws, 14, 4, 7);

        // Fila 15: firma ejecutivo
        ws.mergeCells(15, 1, 15, 3);
        setCell(ws, 15, 1, "Firma del ejecutivo de Cuenta/Gerente:", { horizontal: "right" });
        ws.mergeCells(15, 4, 15, 7);
        const sigEjec = parseSignatureForExcel(r.firma_ejecutivo_manual_data_uri || r.firma_ejecutivo_cuenta_manual);
        if (sigEjec) {
            const imgId = wb.addImage({ base64: sigEjec.base64, extension: sigEjec.extension });
            ws.addImage(imgId, { tl: { col: 3, row: 14 }, ext: { width: 220, height: 56 } });
        }
        applyMergeBottomBorder(ws, 15, 4, 7);

        const bodyRowHeights: Record<number, number> = {
            2: 20,
            3: 26,
            4: 26,
            5: 26,
            6: 24,
            7: 28,
            8: 28,
            9: 26,
            10: 26,
            11: 24,
            12: 28,
            13: 28,
            14: 80,
            15: 80,
            16: 20,
            17: 20,
        };
        for (const [row, height] of Object.entries(bodyRowHeights)) {
            ws.getRow(Number(row)).height = height;
        }

        applyRangeOuterBorder(ws, 2, 1, 17, 9);
        applyRangeOuterBorder(ws, 1, 1, 1, 9);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
