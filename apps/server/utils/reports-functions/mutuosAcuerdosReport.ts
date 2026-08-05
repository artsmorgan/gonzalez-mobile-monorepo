/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma } from "@prisma/client";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { parseMarcaIdsArray, ymdFromFecha } from "../mutuosAcuerdosMarcas";

/** Valores de `e_mutuos_acuerdos.estado` al filtrar (incl. «completado» agrupado con aprobado en consulta). */
export type MutuoAcuerdoEstadoFiltro = "aprobado" | "rechazado" | "pendiente";

export type MutuosAcuerdosModuleFilters = {
    /** Combinación fecha+hora sin conversión de zona (se compara con `created_at` del registro). */
    fechaReporteDesde?: string | null;
    fechaReporteHasta?: string | null;
    empresaIds?: number[] | null;
    clienteIds?: number[] | null;
    divisionIds?: number[] | null;
    contratoIds?: number[] | null;
    corpoIds?: number[] | null;
    puestoIds?: number[] | null;
    empleadoAusenteIds?: number[] | null;
    empleadoReemplazaIds?: number[] | null;
    ejecutivoCuentaIds?: number[] | null;
    /** Filtro por columna `estado` (aprobado / rechazado / pendiente). */
    estado?: MutuoAcuerdoEstadoFiltro | null;
};

export type MutuosAcuerdosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

export function normalizeMutuosAcuerdosFilters(raw: unknown): MutuosAcuerdosModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: MutuosAcuerdosModuleFilters = {};
    const fd = o.fechaReporteDesde != null ? String(o.fechaReporteDesde).trim() : "";
    const fh = o.fechaReporteHasta != null ? String(o.fechaReporteHasta).trim() : "";
    if (fd) next.fechaReporteDesde = fd;
    if (fh) next.fechaReporteHasta = fh;
    const emp = toValidIds(o.empresaIds);
    const cli = toValidIds(o.clienteIds);
    const div = toValidIds(o.divisionIds);
    const con = toValidIds(o.contratoIds);
    const cor = toValidIds(o.corpoIds);
    const pue = toValidIds(o.puestoIds);
    const aus = toValidIds(o.empleadoAusenteIds);
    const rem = toValidIds(o.empleadoReemplazaIds);
    const eje = toValidIds(o.ejecutivoCuentaIds);
    if (emp.length) next.empresaIds = emp;
    if (cli.length) next.clienteIds = cli;
    if (div.length) next.divisionIds = div;
    if (con.length) next.contratoIds = con;
    if (cor.length) next.corpoIds = cor;
    if (pue.length) next.puestoIds = pue;
    if (aus.length) next.empleadoAusenteIds = aus;
    if (rem.length) next.empleadoReemplazaIds = rem;
    if (eje.length) next.ejecutivoCuentaIds = eje;
    const estRaw = o.estado != null ? String(o.estado).trim().toLowerCase() : "";
    if (estRaw === "aprobado" || estRaw === "rechazado" || estRaw === "pendiente") next.estado = estRaw;
    return next;
}

export function hasMutuosAcuerdosListModuleFiltersContent(f: MutuosAcuerdosModuleFilters): boolean {
    if (f.fechaReporteDesde || f.fechaReporteHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.empleadoAusenteIds?.length || f.empleadoReemplazaIds?.length || f.ejecutivoCuentaIds?.length) return true;
    if (f.estado) return true;
    return false;
}

function bucketMutuoEstadoDb(raw: string | null | undefined): MutuoAcuerdoEstadoFiltro {
    const estado = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (!estado || estado === "pendiente") return "pendiente";
    if (estado === "rechazado") return "rechazado";
    if (estado === "aprobado" || estado === "completado") return "aprobado";
    return "pendiente";
}

export function filtersMatchMutuosAcuerdosListQuery(parsedRowFilters: any, listModuleFilters?: MutuosAcuerdosModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeMutuosAcuerdosFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.fechaReporteDesde && String(saved.fechaReporteDesde || "") !== String(listModuleFilters.fechaReporteDesde)) return false;
    if (listModuleFilters.fechaReporteHasta && String(saved.fechaReporteHasta || "") !== String(listModuleFilters.fechaReporteHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empleadoAusenteIds ?? undefined, saved.empleadoAusenteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empleadoReemplazaIds ?? undefined, saved.empleadoReemplazaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.ejecutivoCuentaIds ?? undefined, saved.ejecutivoCuentaIds ?? undefined)) return false;
    if (listModuleFilters.estado) {
        if (bucketMutuoEstadoDb(saved.estado as string) !== listModuleFilters.estado) return false;
    }
    return true;
}

const activeOrNoInactiveDate = (): Prisma.e_estructura_contratoWhereInput[] => {
    const now = new Date();
    return [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: now } }];
};

async function plazaIdsForContratoIds(prisma: ReportDataAccess, contratoIds: number[]): Promise<number[]> {
    if (!contratoIds.length) return [];
    const rows = await prisma.e_estructura_plazas.findMany({
        where: {
            deleted: null,
            puesto_id: { not: null },
            e_estructura_puesto: {
                deleted: null,
                e_estructura_sucursal: {
                    deleted: null,
                    contrato_id: { in: contratoIds },
                },
            },
        },
        select: { id: true },
    });
    return rows.map((r) => r.id);
}

async function plazaIdsFromEmpresaIds(prisma: ReportDataAccess, empresaIds: number[]): Promise<number[]> {
    if (!empresaIds.length) return [];
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: {
            deleted: null,
            AND: [{ OR: activeOrNoInactiveDate() }],
            OR: [{ empresa_id: { in: empresaIds } }, { e_estructura_cliente: { empresa_id: { in: empresaIds } } }],
        },
        select: { id: true },
    });
    return plazaIdsForContratoIds(
        prisma,
        contratos.map((c) => c.id),
    );
}

async function plazaIdsFromClienteIds(prisma: ReportDataAccess, clienteIds: number[]): Promise<number[]> {
    if (!clienteIds.length) return [];
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { deleted: null, AND: [{ OR: activeOrNoInactiveDate() }], cliente_id: { in: clienteIds } },
        select: { id: true },
    });
    return plazaIdsForContratoIds(
        prisma,
        contratos.map((c) => c.id),
    );
}

async function plazaIdsFromDivisionIds(prisma: ReportDataAccess, divisionIds: number[]): Promise<number[]> {
    if (!divisionIds.length) return [];
    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { deleted: null, AND: [{ OR: activeOrNoInactiveDate() }], division_id: { in: divisionIds } },
        select: { id: true },
    });
    return plazaIdsForContratoIds(
        prisma,
        contratos.map((c) => c.id),
    );
}

async function plazaIdsFromCorpoIds(prisma: ReportDataAccess, corpoIds: number[]): Promise<number[]> {
    if (!corpoIds.length) return [];
    const puestos = await prisma.e_estructura_puesto.findMany({
        where: { deleted: null, sucursal_id: { in: corpoIds } },
        select: { id: true },
    });
    const pid = puestos.map((p) => p.id);
    if (!pid.length) return [];
    const plazas = await prisma.e_estructura_plazas.findMany({
        where: { deleted: null, puesto_id: { in: pid } },
        select: { id: true },
    });
    return plazas.map((p) => p.id);
}

async function plazaIdsFromPuestoIds(prisma: ReportDataAccess, puestoIds: number[]): Promise<number[]> {
    if (!puestoIds.length) return [];
    const plazas = await prisma.e_estructura_plazas.findMany({
        where: { deleted: null, puesto_id: { in: puestoIds } },
        select: { id: true },
    });
    return plazas.map((p) => p.id);
}

function intersectPlazaSets(sets: number[][]): number[] {
    const nonEmpty = sets.filter((s) => s.length > 0);
    if (nonEmpty.length === 0) return [];
    let acc = new Set(nonEmpty[0]);
    for (let i = 1; i < nonEmpty.length; i++) {
        const nx = new Set(nonEmpty[i]);
        acc = new Set([...acc].filter((x) => nx.has(x)));
    }
    return [...acc];
}

/** Si hay filtros de estructura, restringe por plazas obtenidas de la jerarquía (intersección). */
async function resolvePlazaIdsFromStructureFilters(prisma: ReportDataAccess, f: MutuosAcuerdosModuleFilters): Promise<number[] | null> {
    const sets: number[][] = [];
    if (f.empresaIds?.length) sets.push(await plazaIdsFromEmpresaIds(prisma, f.empresaIds));
    if (f.clienteIds?.length) sets.push(await plazaIdsFromClienteIds(prisma, f.clienteIds));
    if (f.divisionIds?.length) sets.push(await plazaIdsFromDivisionIds(prisma, f.divisionIds));
    if (f.contratoIds?.length) sets.push(await plazaIdsForContratoIds(prisma, f.contratoIds));
    if (f.corpoIds?.length) sets.push(await plazaIdsFromCorpoIds(prisma, f.corpoIds));
    if (f.puestoIds?.length) sets.push(await plazaIdsFromPuestoIds(prisma, f.puestoIds));
    if (sets.length === 0) return null;
    const inter = intersectPlazaSets(sets);
    return inter;
}

/** Interpreta "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm" como fecha local (sin UTC). */
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

function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureForExcel(dataUriOrBase64: string | null | undefined): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: m[2].replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/\s+/g, "") };
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

/** Lee ancho/alto desde el chunk IHDR de un PNG (sin dependencias extra). */
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

function logoExtentForCellBox(natural: { w: number; h: number } | null, maxW: number, maxH: number): { width: number; height: number } {
    if (!natural || natural.w <= 0 || natural.h <= 0) return { width: 72, height: 44 };
    const s = Math.min(maxW / natural.w, maxH / natural.h, 1);
    return {
        width: Math.max(1, Math.round(natural.w * s)),
        height: Math.max(1, Math.round(natural.h * s)),
    };
}

function fmtEmpleado(e: any): string {
    if (!e) return "";
    const parts = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean);
    const name = parts.join(" ").trim();
    const c = e.codigo ? String(e.codigo).trim() : "";
    return c ? `${c} — ${name}` : name;
}

function fmtMarcaRol(m: any): string {
    if (!m?.fecha) return "";
    const f = m.fecha instanceof Date ? m.fecha.toISOString().slice(0, 10) : String(m.fecha).slice(0, 10);
    const tt = m.tipo_turno != null ? String(m.tipo_turno).trim().toUpperCase() : "";
    return tt ? `${f} / ${tt}` : f;
}

function fmtMarcasRol(marcas: any[], fechaFallback: string | null): string {
    if (marcas.length === 0) return fechaFallback || "";
    return marcas.map((m) => fmtMarcaRol(m) || fechaFallback || "").filter(Boolean).join("; ");
}

function fmtDateTimeCol(d: Date | string | null | undefined): string {
    if (d == null) return "";
    if (d instanceof Date) return d.toISOString().replace("T", " ").slice(0, 19);
    const s = String(d).trim();
    if (!s) return "";
    return s.length >= 19 ? s.slice(0, 19).replace("T", " ") : s;
}

function fmtPlazaLite(p: { id: number; nombre: string; codigo_plaza: string | null; nro_plaza: unknown } | undefined): string {
    if (!p) return "";
    const cod = p.codigo_plaza != null ? String(p.codigo_plaza).trim() : "";
    const nom = String(p.nombre || "").trim();
    const base = cod && nom ? `${cod} — ${nom}` : cod || nom || `ID ${p.id}`;
    if (p.nro_plaza == null) return base;
    const nro = String(p.nro_plaza).trim();
    return nro && nro !== "" ? `${base} (N° plaza ${nro})` : base;
}

function fmtSiNo(b: boolean | null | undefined): string {
    if (b === true) return "Sí";
    if (b === false) return "No";
    return "";
}

export async function queryMutuosAcuerdosRows(prisma: ReportDataAccess, filters: MutuosAcuerdosModuleFilters, orderKey: MutuosAcuerdosOrderKey) {
    const plazaIds = await resolvePlazaIdsFromStructureFilters(prisma, filters);

    const and: Prisma.e_mutuos_acuerdosWhereInput[] = [{ isActive: true }];

    const desde = parseLocalDateTime(filters.fechaReporteDesde ?? undefined);
    const hasta = parseLocalDateTime(filters.fechaReporteHasta ?? undefined);
    if (desde || hasta) {
        const r: Prisma.DateTimeFilter = {};
        if (desde) r.gte = desde;
        if (hasta) r.lte = hasta;
        and.push({ created_at: r });
    }

    if (filters.empleadoAusenteIds?.length) and.push({ empleadoAusente_id: { in: filters.empleadoAusenteIds } });
    if (filters.empleadoReemplazaIds?.length) and.push({ empleadoReemplaza_id: { in: filters.empleadoReemplazaIds } });
    if (filters.ejecutivoCuentaIds?.length) and.push({ ejecutivo_cuenta: { in: filters.ejecutivoCuentaIds } });

    if (filters.estado === "aprobado") {
        and.push({ OR: [{ estado: "aprobado" }, { estado: "completado" }] });
    } else if (filters.estado === "rechazado") {
        and.push({ estado: "rechazado" });
    } else if (filters.estado === "pendiente") {
        and.push({
            OR: [{ estado: "pendiente" }, { estado: "" }],
        });
    }

    if (plazaIds !== null) {
        if (plazaIds.length === 0) {
            and.push({ id: { equals: -1 } });
        } else {
            and.push({
                OR: [{ plazaAusente_id: { in: plazaIds } }, { plazaReemplaza_id: { in: plazaIds } }],
            });
        }
    }

    const rows = await prisma.e_mutuos_acuerdos.findMany({
        where: { AND: and },
        orderBy: { created_at: "desc" },
        take: 50_000,
    });

    const marcaIds = [
        ...new Set(
            rows.flatMap((r) => [
                ...parseMarcaIdsArray((r as any).marcas_ausente ?? (r as any).marcaDiaAusente_id),
                ...parseMarcaIdsArray((r as any).marcas_reemplaza ?? (r as any).marcaDiaReemplaza_id),
            ]),
        ),
    ];
    const empIds = [...new Set(rows.flatMap((r) => [r.empleadoAusente_id, r.empleadoReemplaza_id, r.created_by]))];
    const ejeIds = [...new Set(rows.map((r) => r.ejecutivo_cuenta))];
    const plazaRowIds = [...new Set(rows.flatMap((r) => [Number(r.plazaAusente_id), Number(r.plazaReemplaza_id)]).filter((n) => Number.isFinite(n) && n > 0))];
    const structIds = (key: keyof (typeof rows)[0]) => [...new Set(rows.map((r) => Number((r as any)[key] || 0)).filter((n) => n > 0))];

    const [marcas, empleados, ejecutivos, empresas, clientes, divisiones, contratos, corpos, puestos, plazasRows] = await Promise.all([
        marcaIds.length ? prisma.c_marca_dia.findMany({ where: { id: { in: marcaIds } }, select: { id: true, fecha: true, tipo_turno: true } }) : [],
        empIds.length
            ? prisma.c_empleado.findMany({
                  where: { id: { in: empIds } },
                  select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
              })
            : [],
        ejeIds.length ? prisma.n_ejecutivo_cuenta.findMany({ where: { id: { in: ejeIds } }, select: { id: true, nombre: true } }) : [],
        structIds("empresa_id").length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: structIds("empresa_id") } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        structIds("cliente_id").length
            ? prisma.e_estructura_cliente.findMany({ where: { id: { in: structIds("cliente_id") } }, select: { id: true, nombre: true } })
            : [],
        structIds("division_id").length
            ? prisma.n_division.findMany({ where: { id: { in: structIds("division_id") } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        structIds("contrato_id").length
            ? prisma.e_estructura_contrato.findMany({
                  where: { id: { in: structIds("contrato_id") } },
                  select: { id: true, nombre: true, nro_contrato: true },
              })
            : [],
        structIds("corpo_id").length
            ? prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: structIds("corpo_id") } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
            : [],
        structIds("puesto_id").length
            ? prisma.e_estructura_puesto.findMany({ where: { id: { in: structIds("puesto_id") } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        plazaRowIds.length
            ? prisma.e_estructura_plazas.findMany({
                  where: { id: { in: plazaRowIds } },
                  select: { id: true, nombre: true, codigo_plaza: true, nro_plaza: true },
              })
            : [],
    ]);

    const marcaById = new Map(marcas.map((m) => [m.id, m]));
    const empById = new Map(empleados.map((e) => [e.id, e]));
    const ejeById = new Map(ejecutivos.map((e) => [e.id, e]));
    const empresaById = new Map(empresas.map((e) => [e.id, e]));
    const clienteById = new Map(clientes.map((c) => [c.id, c]));
    const divisionById = new Map(divisiones.map((d) => [d.id, d]));
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    const corpoById = new Map(corpos.map((c) => [c.id, c]));
    const puestoById = new Map(puestos.map((p) => [p.id, p]));
    const plazaById = new Map(plazasRows.map((p) => [p.id, p]));

    const enriched = rows.map((r) => {
        const idsAusente = parseMarcaIdsArray((r as any).marcas_ausente ?? (r as any).marcaDiaAusente_id);
        const idsReemplaza = parseMarcaIdsArray((r as any).marcas_reemplaza ?? (r as any).marcaDiaReemplaza_id);
        const marcasAusente = idsAusente.map((id) => marcaById.get(id)).filter(Boolean);
        const marcasReemplaza = idsReemplaza.map((id) => marcaById.get(id)).filter(Boolean);
        const fechaAusenteYmd = ymdFromFecha((r as any).fecha_ausente) || (marcasAusente[0] ? ymdFromFecha((marcasAusente[0] as any).fecha) : null);
        const fechaReemplazaYmd = ymdFromFecha((r as any).fecha_reemplaza) || (marcasReemplaza[0] ? ymdFromFecha((marcasReemplaza[0] as any).fecha) : null);
        const ea = empById.get(r.empleadoAusente_id);
        const er = empById.get(r.empleadoReemplaza_id);
        const creador = empById.get(r.created_by);
        const ej = ejeById.get(r.ejecutivo_cuenta);
        const emp = empresaById.get(Number(r.empresa_id));
        const cli = clienteById.get(Number(r.cliente_id));
        const div = divisionById.get(Number(r.division_id));
        const con = contratoById.get(Number(r.contrato_id));
        const cor = corpoById.get(Number(r.corpo_id));
        const pue = puestoById.get(Number(r.puesto_id));
        const plA = plazaById.get(Number(r.plazaAusente_id));
        const plR = plazaById.get(Number(r.plazaReemplaza_id));
        return {
            ...r,
            empresa_nombre: emp ? `${emp.codigo ? `${String(emp.codigo).trim()} — ` : ""}${emp.nombre}` : String(r.empresa_id),
            cliente_nombre: cli?.nombre ?? String(r.cliente_id),
            division_nombre: div ? `${div.codigo ? `${String(div.codigo).trim()} — ` : ""}${div.nombre}` : String(r.division_id),
            contrato_nombre: con ? `${con.nro_contrato ? `${String(con.nro_contrato).trim()} — ` : ""}${con.nombre}` : String(r.contrato_id),
            corpo_nombre: cor ? `${cor.nro_sucursal ? `${String(cor.nro_sucursal).trim()} — ` : ""}${cor.nombre}` : String(r.corpo_id),
            puesto_nombre: pue ? `${pue.codigo ? `${String(pue.codigo).trim()} — ` : ""}${pue.nombre}` : String(r.puesto_id),
            ejecutivo_nombre: ej?.nombre?.trim() || String(r.ejecutivo_cuenta),
            plaza_ausente_txt: fmtPlazaLite(plA) || String(r.plazaAusente_id),
            plaza_reemplaza_txt: fmtPlazaLite(plR) || String(r.plazaReemplaza_id),
            created_by_txt: fmtEmpleado(creador) || String(r.created_by),
            empleado_ausente_codigo: ea?.codigo != null ? String(ea.codigo).trim() : "",
            empleado_reemplaza_codigo: er?.codigo != null ? String(er.codigo).trim() : "",
            empleado_ausente_txt: fmtEmpleado(ea),
            empleado_reemplaza_txt: fmtEmpleado(er),
            marca_ausente_txt: fmtMarcasRol(marcasAusente, fechaAusenteYmd),
            marca_reemplaza_txt: fmtMarcasRol(marcasReemplaza, fechaReemplazaYmd),
            ausente_acepta_txt: fmtSiNo(r.ausente_acepta),
            reemplaza_acepta_txt: fmtSiNo(r.reemplaza_acepta),
            ausente_acepta_at_txt: fmtDateTimeCol(r.ausente_acepta_at as Date | null),
            reemplaza_acepta_at_txt: fmtDateTimeCol(r.reemplaza_acepta_at as Date | null),
            firma_digital_ejecutivo_txt: String(r.firma_ejecutivo_cuenta_digital || "").trim() !== "" ? "Sí" : "No",
            cambio_guardia_txt: r.cambio_guardia_id != null ? String(r.cambio_guardia_id) : "",
            motivo_txt: String(r.motivo ?? "").trim(),
            created_at_txt: r.created_at instanceof Date ? r.created_at.toISOString().replace("T", " ").slice(0, 19) : String(r.created_at ?? ""),
            firma_ejecutivo_manual_data_uri: normalizeSignatureDataUri(r.firma_ejecutivo_cuenta_manual),
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

export async function buildMutuosAcuerdosExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Mutuos acuerdos");
    const wsDet = wb.addWorksheet("Firmas ejecutivo");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const headers = [
        "ID",
        "Creado en",
        "Creado por",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Plaza ausente",
        "Plaza reemplaza",
        "Ejecutivo de cuenta",
        "Oficial ausente",
        "Oficial reemplaza",
        "Marca ausente (fecha / rol)",
        "Marca reemplaza (fecha / rol)",
        "Ausente acepta",
        "Fecha y hora aceptación (ausente)",
        "Reemplaza acepta",
        "Fecha y hora aceptación (reemplaza)",
        "Motivo",
        "Estado",
        "Cambio guardia (ID)",
        "Firma digital ejecutivo (registrada)",
        "Firma ejecutivo (manual)",
    ];
    const maxCol = headers.length;
    const colFirmaManual = maxCol;

    const anchorFirmaById = new Map<number, number>();
    const descRows = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of descRows) {
        const start = wsDet.rowCount + 1;
        wsDet.mergeCells(start, 1, start, maxCol);
        wsDet.getCell(start, 1).value = `Mutuo #${r.id} — ${r.cliente_nombre}`;
        wsDet.getCell(start, 1).font = { bold: true };
        wsDet.getCell(start, 1).fill = hdrFill;
        for (let c = 1; c <= maxCol; c++) wsDet.getCell(start, c).border = border;
        anchorFirmaById.set(Number(r.id), start + 1);
        wsDet.mergeCells(start + 1, 1, start + 1, maxCol);
        wsDet.getCell(start + 1, 1).value = "Firma ejecutivo de cuenta (manual)";
        wsDet.getCell(start + 1, 1).font = { bold: true };
        wsDet.getCell(start + 1, 1).fill = hdrFill;
        for (let c = 1; c <= maxCol; c++) wsDet.getCell(start + 1, c).border = border;
        const sig = parseSignatureForExcel(r.firma_ejecutivo_cuenta_manual);
        if (sig) {
            const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
            wsDet.addImage(imgId, { tl: { col: 0.2, row: start + 1 - 0.85 }, ext: { width: 280, height: 100 } });
            wsDet.getRow(start + 1).height = 96;
        } else {
            wsDet.getRow(start + 1).height = 36;
        }
        wsDet.addRow([]);
    }

    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = hdrFill;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = headers.map((label) => {
        if (label.startsWith("Motivo")) return { width: 44, outlineLevel: 1 };
        if (label.includes("Plaza") || label.includes("Oficial") || label.includes("Marca")) return { width: 28, outlineLevel: 1 };
        if (label.includes("Fecha y hora")) return { width: 22, outlineLevel: 1 };
        return { width: 20, outlineLevel: 1 };
    });

    for (const r of rows) {
        const fiRow = anchorFirmaById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id,
            r.created_at_txt,
            r.created_by_txt,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.plaza_ausente_txt,
            r.plaza_reemplaza_txt,
            r.ejecutivo_nombre,
            r.empleado_ausente_txt,
            r.empleado_reemplaza_txt,
            r.marca_ausente_txt,
            r.marca_reemplaza_txt,
            r.ausente_acepta_txt,
            r.ausente_acepta_at_txt,
            r.reemplaza_acepta_txt,
            r.reemplaza_acepta_at_txt,
            r.motivo_txt ?? r.motivo ?? "",
            r.estado,
            r.cambio_guardia_txt,
            r.firma_digital_ejecutivo_txt,
            "",
        ]);
        row.getCell(colFirmaManual).value = { text: "Ver firma", hyperlink: `#'Firmas ejecutivo'!A${fiRow}` };
        row.getCell(colFirmaManual).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    }
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    return Buffer.from(await wb.xlsx.writeBuffer());
}

const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};
const thickBlack = { style: "thick" as const, color: { argb: "FF000000" } };
const whiteFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };

function clearBordersInRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = {} as ExcelJS.Borders;
        }
    }
}

function applyThinBorderRect(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = { ...thinBorder };
        }
    }
}

/** F5/F8: sin gris de cabecera ni bordes (separación visual E–G). */
function patchSpacerColumnFInHeaderRow(ws: ExcelJS.Worksheet, row: number) {
    const t = thinBorder.top!;
    const b = thinBorder.bottom!;
    const l = thinBorder.left!;
    const rgt = thinBorder.right!;
    ws.getCell(row, 6).value = "";
    ws.getCell(row, 6).fill = { ...whiteFill };
    ws.getCell(row, 6).border = {} as ExcelJS.Borders;
    ws.getCell(row, 5).border = { top: t, bottom: b, left: l };
    ws.getCell(row, 7).border = { top: t, bottom: b, right: rgt };
}

/** Refuerza borde derecho en col. E («Fecha / Rol Cambio») e izquierdo en col. G («Motivo»), filas de cabecera y datos. */
function patchCambioRightMotivoLeft(ws: ExcelJS.Worksheet, dataRows: number[]) {
    const rt = thinBorder.right!;
    const lf = thinBorder.left!;
    for (const rr of dataRows) {
        const e = ws.getCell(rr, 5);
        const g = ws.getCell(rr, 7);
        const eb = (e.border || {}) as ExcelJS.Borders;
        const gb = (g.border || {}) as ExcelJS.Borders;
        e.border = { ...eb, right: rt };
        g.border = { ...gb, left: lf };
    }
}

/** F6 y F9: solo laterales (sin borde superior ni inferior). */
function stripF6F9TopBottom(ws: ExcelJS.Worksheet) {
    for (const rr of [6, 9]) {
        const f = ws.getCell(rr, 6);
        const b = (f.border || {}) as ExcelJS.Borders;
        f.border = { left: b.left, right: b.right };
    }
}

function applyOuterThickBlackBorder(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const p = (cell.border || {}) as ExcelJS.Borders;
            cell.border = {
                top: r === r1 ? thickBlack : p.top,
                bottom: r === r2 ? thickBlack : p.bottom,
                left: c === c1 ? thickBlack : p.left,
                right: c === c2 ? thickBlack : p.right,
            };
        }
    }
}

function applyWhiteFillExceptColoredHeaders(
    ws: ExcelJS.Worksheet,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    headerRows: Set<number>,
    titleFillRow: number,
    titleFillColFrom: number,
    titleFillColTo: number,
) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            if (headerRows.has(r)) continue;
            if (r === titleFillRow && c >= titleFillColFrom && c <= titleFillColTo) continue;
            ws.getCell(r, c).fill = { ...whiteFill };
        }
    }
}

/** Plantilla tipo boleta A–G (similar SEG-F-049), una hoja por registro. */
export async function buildMutuosAcuerdosExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } } as const;
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } } as const;
    const HEADER_BAND_H = 42;
    const DATA_ROW_BASE_H = 42;
    const DATA_ROW_SIG_H = 78;
    const motivoCell = (x: any) => String(x.motivo || "").slice(0, 500);

    for (const r of rows) {
        const safeName = `Mutuo_${r.id}`.replace(/[^\w-]/g, "_").slice(0, 31);
        const ws = wb.addWorksheet(safeName);
        ws.columns = [
            { width: 10 },
            { width: 30 },
            { width: 24 },
            { width: 22 },
            { width: 22 },
            { width: 2.8 },
            { width: 38 },
        ];

        const gridR1 = 1;
        const gridC1 = 1;
        const gridR2 = 12;
        const gridC2 = 7;

        const mText = motivoCell(r);
        const marcaCambioTablaAusente = r.marca_reemplaza_txt || "";
        const marcaCambioTablaReemplaza = r.marca_ausente_txt || "";
        const firmaEjecRaw =
            (r as any).firma_ejecutivo_cuenta_manual ||
            (r as any).firma_ejecutivo_manual_data_uri ||
            (r as any).firmaEjecutivoCuentaManual;
        const sigEjecutivo = parseSignatureForExcel(firmaEjecRaw);
        const firmaAusenteRaw = (r as any).firma_ausente_manual ?? (r as any).firmaAusenteManual;
        const sigAusente = parseSignatureForExcel(firmaAusenteRaw);
        const firmaReemplRaw = (r as any).firma_reemplaza_manual ?? (r as any).firmaReemplazaManual;
        const sigReempl = parseSignatureForExcel(firmaReemplRaw);

        const logoPath = await resolveLogoPathByEmpresaId(Number(r.empresa_id || 0));
        const logoNat = logoPath ? await readPngPixelSize(logoPath) : null;
        const logoExt = logoExtentForCellBox(logoNat, 198, 48);

        clearBordersInRange(ws, gridR1, gridC1, gridR2, gridC2);

        ws.getRow(1).height = 52;
        ws.mergeCells(1, 1, 1, 2);
        ws.getCell(1, 1).fill = { ...whiteFill };
        ws.mergeCells(1, 3, 1, 6);
        ws.getCell(1, 3).value = "BOLETA PARA MUTUOS ACUERDOS";
        ws.getCell(1, 3).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        ws.getCell(1, 3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        for (let c = 3; c <= 6; c++) {
            ws.getCell(1, c).fill = titleFill;
        }
        ws.mergeCells(1, 7, 1, 7);
        ws.getCell(1, 7).value = String(reportName ?? "").trim() || `Mutuo ${r.id}`;
        ws.getCell(1, 7).font = { bold: true, size: 9 };
        ws.getCell(1, 7).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(1, 7).fill = { ...whiteFill };

        ws.getRow(3).height = HEADER_BAND_H;
        ws.mergeCells(3, 1, 3, 2);
        ws.getCell(3, 1).value = `Ejecutivo de cuenta: ${String(r.ejecutivo_nombre ?? "").trim() || " "}`;
        ws.getCell(3, 1).font = { bold: true, size: 10 };
        ws.getCell(3, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: false };
        ws.getCell(3, 1).fill = { ...whiteFill };

        ws.mergeCells(3, 3, 3, 4);
        ws.getCell(3, 3).value = `Corpo: ${String(r.corpo_nombre ?? "").trim() || " "}`;
        ws.getCell(3, 3).font = { bold: true, size: 10 };
        ws.getCell(3, 3).alignment = { horizontal: "right", vertical: "middle", wrapText: false };
        ws.getCell(3, 3).fill = { ...whiteFill };

        ws.getCell(3, 5).value = "";
        ws.getCell(3, 5).fill = { ...whiteFill };
        ws.getCell(3, 6).value = "";
        ws.getCell(3, 6).fill = { ...whiteFill };

        ws.getCell(3, 7).value = `Fecha: ${r.created_at_txt?.slice(0, 10) || " "}`;
        ws.getCell(3, 7).font = { bold: true, size: 10 };
        ws.getCell(3, 7).alignment = { horizontal: "left", vertical: "middle", wrapText: false };
        ws.getCell(3, 7).fill = { ...whiteFill };

        ws.getRow(4).height = HEADER_BAND_H;
        ws.getCell(4, 1).value = "OFICIAL INTERESADO";
        ws.getCell(4, 1).font = { bold: true, size: 10 };
        ws.getCell(4, 1).fill = { ...whiteFill };
        ws.mergeCells(4, 4, 4, 5);
        ws.getCell(4, 4).value = "D:día / T: tarde / N: noche";
        ws.getCell(4, 4).font = { italic: true, size: 9 };
        ws.getCell(4, 4).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
        ws.getCell(4, 4).fill = { ...whiteFill };

        const hdrs = ["CÓDIGO", "NOMBRE", "FIRMA", "FECHA / ROL NORMAL", "FECHA / ROL CAMBIO", "", "MOTIVO"];
        ws.getRow(5).height = HEADER_BAND_H;
        for (let c = 1; c <= 7; c++) {
            const cell = ws.getCell(5, c);
            cell.value = hdrs[c - 1];
            cell.font = { bold: true, size: 9 };
            cell.fill = c === 6 ? { ...whiteFill } : { ...hdrFill };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }

        ws.getRow(6).height = sigAusente ? DATA_ROW_SIG_H : DATA_ROW_BASE_H;
        ws.getCell(6, 1).value = (r as any).empleado_ausente_codigo || String(r.empleadoAusente_id);
        ws.getCell(6, 2).value = r.empleado_ausente_txt || "";
        ws.getCell(6, 3).value = "";
        ws.getCell(6, 4).value = r.marca_ausente_txt || "";
        ws.getCell(6, 5).value = marcaCambioTablaAusente;
        ws.getCell(6, 6).value = "";
        ws.getCell(6, 7).value = mText;
        for (let c = 1; c <= 7; c++) {
            const cell = ws.getCell(6, c);
            if (c === 1) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            else if (c === 2) cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            else if (c === 7) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            else cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        }

        ws.getRow(7).height = HEADER_BAND_H;
        ws.getCell(7, 1).value = "OFICIAL QUE COLABORA";
        ws.getCell(7, 1).font = { bold: true, size: 10 };
        ws.getCell(7, 1).fill = { ...whiteFill };

        const h2 = 8;
        ws.getRow(h2).height = HEADER_BAND_H;
        for (let c = 1; c <= 7; c++) {
            const cell = ws.getCell(h2, c);
            cell.value = hdrs[c - 1];
            cell.font = { bold: true, size: 9 };
            cell.fill = c === 6 ? { ...whiteFill } : { ...hdrFill };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }

        const r9 = 9;
        ws.getRow(r9).height = sigReempl ? DATA_ROW_SIG_H : DATA_ROW_BASE_H;
        ws.getCell(r9, 1).value = (r as any).empleado_reemplaza_codigo || String(r.empleadoReemplaza_id);
        ws.getCell(r9, 2).value = r.empleado_reemplaza_txt || "";
        ws.getCell(r9, 3).value = "";
        ws.getCell(r9, 4).value = r.marca_reemplaza_txt || "";
        ws.getCell(r9, 5).value = marcaCambioTablaReemplaza;
        ws.getCell(r9, 6).value = "";
        ws.getCell(r9, 7).value = mText;
        for (let c = 1; c <= 7; c++) {
            const cell = ws.getCell(r9, c);
            if (c === 1) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            else if (c === 2) cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            else if (c === 7) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            else cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        }

        ws.getRow(10).height = 12;

        ws.mergeCells(11, 2, 11, 6);
        ws.getCell(11, 2).value = "Firma del Ejecutivo de Cuenta o quien designe";
        ws.getCell(11, 2).font = { size: 10 };
        ws.getCell(11, 2).alignment = { horizontal: "center", vertical: "top", wrapText: true };
        ws.getCell(11, 2).fill = { ...whiteFill };
        ws.getRow(11).height = Math.max(HEADER_BAND_H, sigEjecutivo ? 100 : 56);
        for (let c = 3; c <= 6; c++) {
            ws.getCell(11, c).fill = { ...whiteFill };
        }
        ws.getCell(11, 7).fill = { ...whiteFill };
        ws.getCell(11, 1).fill = { ...whiteFill };

        ws.mergeCells(12, 2, 12, 7);
        ws.getRow(12).height = HEADER_BAND_H;
        ws.getCell(12, 2).value = "El permiso no se puede ejecutar si no está en Corpo 0 firmado por el Delta.";
        ws.getCell(12, 2).font = { italic: true, size: 9 };
        ws.getCell(12, 2).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(12, 2).fill = { ...whiteFill };

        applyThinBorderRect(ws, 5, 1, 6, 7);
        applyThinBorderRect(ws, 8, 1, 9, 7);
        patchSpacerColumnFInHeaderRow(ws, 5);
        patchSpacerColumnFInHeaderRow(ws, 8);
        patchCambioRightMotivoLeft(ws, [5, 6, 8, 9]);
        applyOuterThickBlackBorder(ws, gridR1, gridC1, gridR2, gridC2);
        stripF6F9TopBottom(ws);
        applyWhiteFillExceptColoredHeaders(ws, gridR1, gridC1, gridR2, gridC2, new Set([5, 8]), 1, 3, 6);
        applyThinBorderRect(ws, 1, 1, 1, 7);

        for (let c = 2; c <= 6; c++) {
            const cell = ws.getCell(11, c);
            const p = (cell.border || {}) as ExcelJS.Borders;
            cell.border = { ...p, bottom: thinBorder.bottom };
        }

        if (logoPath) {
            const imgId = wb.addImage({ filename: logoPath, extension: "png" });
            ws.addImage(imgId, {
                tl: { col: 0.05, row: 0.1 },
                ext: logoExt,
                editAs: "oneCell",
            } as any);
        }

        if (sigAusente) {
            const imgId = wb.addImage({ base64: sigAusente.base64, extension: sigAusente.extension });
            ws.addImage(imgId, {
                tl: { col: 2.1, row: 5.52 },
                ext: { width: 118, height: 50 },
                editAs: "oneCell",
            } as any);
        }
        if (sigReempl) {
            const imgId = wb.addImage({ base64: sigReempl.base64, extension: sigReempl.extension });
            ws.addImage(imgId, {
                tl: { col: 2.1, row: 8.52 },
                ext: { width: 118, height: 50 },
                editAs: "oneCell",
            } as any);
        }
        if (sigEjecutivo) {
            const imgId = wb.addImage({ base64: sigEjecutivo.base64, extension: sigEjecutivo.extension });
            ws.addImage(imgId, {
                tl: { col: 2.85, row: 10.38 },
                ext: { width: 168, height: 48 },
                editAs: "oneCell",
            } as any);
        }
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
