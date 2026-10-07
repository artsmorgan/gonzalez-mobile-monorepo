import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, ejecutivoPorCorpo, findByIds, nombresEmpleado, usuarioInserta } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";
import type { ReportParams } from "../params";
import { ReportUnavailableError } from "../errors";
import { loadPuestoHierarchy, matchesScope, type Hierarchy } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const clip = (v: unknown, max = 500): string | null => txt(v)?.slice(0, max) ?? null;
/** Fecha sin hora → `YYYY-MM-DDT00:00:00`. */
const fmtDay = (d: unknown): string | null => {
    const s = fmtDt(d as any);
    return s ? `${s.slice(0, 10)}T00:00:00` : null;
};
const withCode = (code: unknown, name: unknown): string | null => {
    const n = txt(name);
    if (!n) return null;
    const c = txt(code);
    return c ? `${c} - ${n}` : n;
};
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Datos ya resueltos en lote que el mapeo necesita (todo por id, sin consultas por fila). */
export type VacacionLookups = {
    empleados: Map<number, any>;
    plazas: Map<number, any>;
    jerarquia: Map<number, Hierarchy>;
    empresas: Map<number, any>;
    clientes: Map<number, any>;
    contratos: Map<number, any>;
    corpos: Map<number, any>;
    puestos: Map<number, any>;
    divisiones: Map<number, string>;
    ejecutivos: Map<number, string>;
    usuarios: Map<number, string>;
};

const EMPTY: VacacionLookups = {
    empleados: new Map(), plazas: new Map(), jerarquia: new Map(), empresas: new Map(), clientes: new Map(), contratos: new Map(), corpos: new Map(), puestos: new Map(),
    divisiones: new Map(), ejecutivos: new Map(), usuarios: new Map(),
};

/** Ubicación de la solicitud: la de su plaza (`plaza_id` → `puesto_id` → sucursal → contrato → cliente/empresa/división). */
export function ubicacionDe(r: any, l: VacacionLookups): Hierarchy {
    const plaza = l.plazas.get(Number(r.plaza_id));
    return (plaza?.puesto_id != null ? l.jerarquia.get(Number(plaza.puesto_id)) : undefined) ?? {};
}

/**
 * Solicitud de vacaciones (`v_vacacion_solicitud`) → fila plana. Nunca se exponen el monto, los usuarios ni las fechas de
 * aprobación (jefatura/gerencia), los datos de reversión ni los motivos de rechazo.
 */
export function mapSolicitudVacacionesRow(r: any, l: VacacionLookups = EMPTY): OutRow {
    const h = ubicacionDe(r, l);
    const emp = l.empleados.get(Number(r.empleado_id));
    const nombre = emp ? buildNombre(emp) : "";
    const codigo = txt(emp?.codigo);
    const plaza = l.plazas.get(Number(r.plaza_id));
    const empresa = l.empresas.get(Number(h.empresa));
    const contrato = l.contratos.get(Number(h.contrato));
    const corpo = l.corpos.get(Number(h.corpo));
    const puesto = l.puestos.get(Number(h.puesto));
    return {
        id: Number(r.id),
        creado: fmtDt(r.fecha_insercion),
        consecutivo: txt(r.consecutivo),
        fecha_inicio: fmtDay(r.fecha_inicio),
        fecha_fin: fmtDay(r.fecha_fin),
        dias: num(r.dias),
        semanas: num(r.semanas),
        tipo_vacaciones: legible(r.tipo_vacaciones),
        periodo: txt(r.periodo),
        estado: legible(r.estado_aprobacion),
        empleado: nombre ? (codigo ? `${codigo} - ${nombre}` : nombre) : codigo,
        cedula: txt(emp?.cedula),
        plaza: withCode(plaza?.codigo_plaza, plaza?.nombre),
        puesto: withCode(puesto?.codigo, puesto?.nombre),
        sucursal: withCode(corpo?.nro_sucursal, corpo?.nombre),
        contrato: withCode(contrato?.nro_contrato, contrato?.nombre),
        cliente: txt(l.clientes.get(Number(h.cliente))?.nombre),
        empresa: withCode(empresa?.codigo, empresa?.nombre),
        division: l.divisiones.get(Number(h.contrato)) ?? null,
        ejecutivo_cuenta: l.ejecutivos.get(Number(h.corpo)) ?? null,
        observaciones: clip(r.observaciones),
        usuario_inserta: usuarioInserta(r.usuario_insercion, l.usuarios),
    };
}

/** Solo columnas seguras: no se piden monto, usuarios/fechas de aprobación ni de reversión. */
const COLS = {
    id: true, empleado_id: true, plaza_id: true, fecha_inicio: true, fecha_fin: true, dias: true, semanas: true, observaciones: true, consecutivo: true,
    estado_aprobacion: true, tipo_vacaciones: true, periodo: true, fecha_insercion: true, usuario_insercion: true,
} as const;

/** `ESTADO_SOLICITADO` → «Solicitado», `DISFRUTE` → «Disfrute»: la base guarda códigos. */
export function legible(v: unknown): string | null {
    const s = String(v ?? "").trim().replace(/^ESTADO_/i, "").replace(/_/g, " ").toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

/**
 * Cuando falta la tabla, deja en el log qué ve de verdad este servidor (solo lectura): los modelos de vacaciones del cliente Prisma y las
 * tablas de vacaciones de la base. Sirve para saber si la tabla no existe o si el cliente no la conoce.
 */
async function logDiagnostico() {
    try {
        const { prisma } = await import("../../prismaClient");
        const modelos = Object.keys(prisma as object).filter((k) => /vacac/i.test(k) && !k.startsWith("$") && !k.startsWith("_"));
        let tablas: string[] = [];
        try {
            const r = (await (prisma as any).$queryRawUnsafe("SHOW TABLES LIKE 'v\\_vacacion%'")) as Record<string, string>[];
            tablas = r.map((x) => String(Object.values(x)[0]));
        } catch (e) {
            tablas = [`(no se pudo consultar: ${String((e as Error).message).slice(0, 120)})`];
        }
        console.warn(JSON.stringify({ level: "warn", msg: "guardify_vacaciones_diagnostico", modelosPrisma: modelos, tablasBase: tablas }));
    } catch (e) {
        console.warn(JSON.stringify({ level: "warn", msg: "guardify_vacaciones_diagnostico_fallo", error: String(e).slice(0, 200) }));
    }
}

const ids = (rows: any[], k: string) => rows.map((r) => Number(r[k]));
const uniq = (xs: number[]) => [...new Set(xs.filter((n) => Number.isFinite(n) && n > 0))];

/**
 * Trae las solicitudes del periodo `[from, to)` (por `fecha_inicio` de las vacaciones), resuelve en lote su ubicación y la
 * restringe al alcance.
 */
export async function loadSolicitudVacaciones(db: ReportDataAccess, p: ReportParams): Promise<OutRow[]> {
    let rows: any[];
    try {
        rows = await db.v_vacacion_solicitud!.findMany({
            where: { fecha_inicio: { gte: new Date(`${p.from}T00:00:00.000Z`), lt: new Date(`${p.to}T00:00:00.000Z`) } },
            select: COLS,
            orderBy: { id: "desc" },
            take: 50_000,
        });
    } catch (e) {
        // La base de planillas de algunos entornos todavía no tiene la vista de solicitudes de vacaciones.
        if (/Tabla no soportada|does not exist|no existe|Unknown (model|field)|not found in Prisma/i.test(String((e as Error)?.message ?? e)) || (db.v_vacacion_solicitud as unknown) === undefined) {
            await logDiagnostico();
            throw new ReportUnavailableError("Este reporte todavía no está disponible: la base de datos no tiene la tabla de solicitudes de vacaciones.");
        }
        throw e;
    }
    const d = db as any;
    const [empleados, plazas] = await Promise.all([
        findByIds<any>(d, "c_empleado", ids(rows, "empleado_id"), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true }),
        findByIds<any>(d, "e_estructura_plazas", ids(rows, "plaza_id"), { puesto_id: true, codigo_plaza: true, nombre: true }),
    ]);
    const puestoIds = uniq([...plazas.values()].map((x) => Number(x.puesto_id)));
    const jerarquia = await loadPuestoHierarchy(d, puestoIds);
    const nivel = (k: "empresa" | "cliente" | "contrato" | "corpo" | "puesto") => uniq([...jerarquia.values()].map((h) => Number(h[k])));
    const [empresas, clientes, contratos, corpos, puestos, divisiones, ejecutivos, usuarios] = await Promise.all([
        findByIds<any>(d, "e_estructura_empresa", nivel("empresa"), { codigo: true, nombre: true }),
        findByIds<any>(d, "e_estructura_cliente", nivel("cliente"), { nombre: true }),
        findByIds<any>(d, "e_estructura_contrato", nivel("contrato"), { nro_contrato: true, nombre: true }),
        findByIds<any>(d, "e_estructura_sucursal", nivel("corpo"), { nro_sucursal: true, nombre: true }),
        findByIds<any>(d, "e_estructura_puesto", nivel("puesto"), { codigo: true, nombre: true }),
        divisionPorContrato(d, nivel("contrato")),
        ejecutivoPorCorpo(d, nivel("corpo")),
        // Quien registró: si `usuario_insercion` es un id de empleado se busca su nombre (en lote); si es texto, se deja tal cual.
        nombresEmpleado(d, rows.map((r) => (/^\d+$/.test(String(r.usuario_insercion ?? "").trim()) ? r.usuario_insercion : null))),
    ]);
    const lookups: VacacionLookups = { empleados, plazas, jerarquia, empresas, clientes, contratos, corpos, puestos, divisiones, ejecutivos, usuarios };
    const scope = p.scope;
    const out: OutRow[] = [];
    for (const r of rows) {
        if (scope && !matchesScope(ubicacionDe(r, lookups), scope)) continue;
        out.push(mapSolicitudVacacionesRow(r, lookups));
    }
    return out;
}

/**
 * Solicitud de vacaciones (`v_vacacion_solicitud`, tabla dinámica). Periodo: `fecha_inicio` de las vacaciones. Ubicación por la plaza
 * (`plaza_id` → `e_estructura_plazas.puesto_id` → puesto, sucursal, contrato, cliente, empresa y división); una solicitud sin plaza o
 * cuya plaza no tiene puesto queda sin ubicación y, por eso, no aparece cuando se pide un alcance por estructura.
 */
export const solicitudVacaciones: GuardifyReportModule = {
    id: "solicitud_vacaciones",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "consecutivo", "plaza", "puesto", "sucursal", "usuario_inserta"],
    filterKeys: ["estado", "tipo_vacaciones", "division", "ejecutivo_cuenta", "usuario_inserta", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "fecha_inicio", "fecha_fin", "dias", "semanas", "tipo_vacaciones", "periodo", "estado", "empleado", "cedula", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
    defaultSort: "fecha_inicio",
    load: loadSolicitudVacaciones,
};
