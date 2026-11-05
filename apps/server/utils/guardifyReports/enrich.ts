import { buildNombre } from "./names";

/**
 * Datos que casi todos los reportes necesitan para sus filtros comunes: el ejecutivo de cuenta de la sucursal, la división del contrato
 * y el nombre de la persona que registró algo. Se cargan en lote y solo con las columnas que se muestran (no dependen de columnas
 * recientes de la base). `db` es el acceso a datos de los reportes (`ReportDataAccess`).
 */
type Db = { [table: string]: { findMany: (args?: any) => Promise<any[]> } };

const unique = (ids: unknown[]): number[] => [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];

/** Registros por id, en bloques de 1000. */
export async function findByIds<T = any>(db: Db, table: string, ids: unknown[], select: Record<string, boolean>): Promise<Map<number, T>> {
    const all = unique(ids);
    const out = new Map<number, T>();
    for (let i = 0; i < all.length; i += 1000) {
        const rows = await db[table]!.findMany({ where: { id: { in: all.slice(i, i + 1000) } }, select: { id: true, ...select } });
        for (const r of rows) out.set(Number(r.id), r as T);
    }
    return out;
}

/** Ejecutivo de cuenta de cada sucursal (corpo): `e_estructura_sucursal.ejecutivoCuenta_id` → `n_ejecutivo_cuenta.nombre`. */
export async function ejecutivoPorCorpo(db: Db, corpoIds: unknown[]): Promise<Map<number, string>> {
    const corpos = await findByIds<{ ejecutivoCuenta_id: number | null }>(db, "e_estructura_sucursal", corpoIds, { ejecutivoCuenta_id: true });
    const ejecutivos = await findByIds<{ nombre: string | null }>(db, "n_ejecutivo_cuenta", [...corpos.values()].map((c) => c.ejecutivoCuenta_id), { nombre: true });
    const out = new Map<number, string>();
    for (const [id, c] of corpos) {
        const nombre = String(ejecutivos.get(Number(c.ejecutivoCuenta_id))?.nombre ?? "").trim();
        if (nombre) out.set(id, nombre);
    }
    return out;
}

/** División de cada contrato: `e_estructura_contrato.division_id` → `n_division.nombre`. */
export async function divisionPorContrato(db: Db, contratoIds: unknown[]): Promise<Map<number, string>> {
    const contratos = await findByIds<{ division_id: number | null }>(db, "e_estructura_contrato", contratoIds, { division_id: true });
    const divisiones = await findByIds<{ nombre: string | null }>(db, "n_division", [...contratos.values()].map((c) => c.division_id), { nombre: true });
    const out = new Map<number, string>();
    for (const [id, c] of contratos) {
        const nombre = String(divisiones.get(Number(c.division_id))?.nombre ?? "").trim();
        if (nombre) out.set(id, nombre);
    }
    return out;
}

/** Nombre completo de cada empleado (solo nombre y apellidos). */
export async function nombresEmpleado(db: Db, empleadoIds: unknown[]): Promise<Map<number, string>> {
    const emps = await findByIds<{ nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }>(db, "c_empleado", empleadoIds, { nombre: true, primer_apellido: true, segundo_apellido: true });
    const out = new Map<number, string>();
    for (const [id, e] of emps) {
        const nombre = buildNombre(e);
        if (nombre) out.set(id, nombre);
    }
    return out;
}

/**
 * «Usuario inserta»: quien registró algo. Las tablas guardan un id de empleado (número) o ya un texto (usuario, correo); si es un
 * número se busca su nombre, si es texto se deja tal cual. Vacío → null.
 */
export function usuarioInserta(raw: unknown, nombres: Map<number, string>): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    return /^\d+$/.test(s) ? nombres.get(Number(s)) ?? null : s.slice(0, 120);
}

/** Ids de la ubicación de un registro (los nombres de columna varían entre tablas, por eso se pasan ya normalizados). */
export type UbicacionIds = { empresa?: unknown; cliente?: unknown; division?: unknown; contrato?: unknown; corpo?: unknown; puesto?: unknown };
export type UbicacionTextos = { empresa: string | null; cliente: string | null; division: string | null; contrato: string | null; sucursal: string | null; puesto: string | null };

const conCodigo = (codigo: unknown, nombre: unknown): string | null => {
    const n = String(nombre ?? "").trim();
    if (!n) return null;
    const c = String(codigo ?? "").trim();
    return c ? `${c} - ${n}` : n;
};

/**
 * Textos de la ubicación («código - nombre») de muchos registros con una consulta por nivel. Devuelve una función que, dada la ubicación
 * por ids de un registro, da sus textos (null si no se encontró; nunca el id como texto).
 */
export async function ubicacionTextos(db: Db, items: UbicacionIds[]): Promise<(u: UbicacionIds) => UbicacionTextos> {
    const col = (k: keyof UbicacionIds) => items.map((i) => i[k]);
    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        findByIds<any>(db, "e_estructura_empresa", col("empresa"), { codigo: true, nombre: true }),
        findByIds<any>(db, "e_estructura_cliente", col("cliente"), { nombre: true }),
        findByIds<any>(db, "n_division", col("division"), { nombre: true }),
        findByIds<any>(db, "e_estructura_contrato", col("contrato"), { nro_contrato: true, nombre: true }),
        findByIds<any>(db, "e_estructura_sucursal", col("corpo"), { nro_sucursal: true, nombre: true }),
        findByIds<any>(db, "e_estructura_puesto", col("puesto"), { codigo: true, nombre: true }),
    ]);
    return (u) => {
        const e = empresas.get(Number(u.empresa)), c = clientes.get(Number(u.cliente)), d = divisiones.get(Number(u.division));
        const k = contratos.get(Number(u.contrato)), s = corpos.get(Number(u.corpo)), p = puestos.get(Number(u.puesto));
        return {
            empresa: e ? conCodigo(e.codigo, e.nombre) : null, cliente: c ? conCodigo(null, c.nombre) : null, division: d ? conCodigo(null, d.nombre) : null,
            contrato: k ? conCodigo(k.nro_contrato, k.nombre) : null, sucursal: s ? conCodigo(s.nro_sucursal, s.nombre) : null, puesto: p ? conCodigo(p.codigo, p.nombre) : null,
        };
    };
}
