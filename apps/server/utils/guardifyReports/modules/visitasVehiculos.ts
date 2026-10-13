import { divisionPorContrato, ejecutivoPorCorpo, nombresEmpleado, ubicacionTextos, usuarioInserta, type UbicacionTextos } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";
import { visitasVehiculosForm } from "./visitasVehiculosForm";

const txt = (v: unknown, max = 500): string | null => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
};

/**
 * Último cambio de cada registro en el historial (`c_cambios_apps_modules`): cuándo y quién (id de empleado). Una consulta por bloque
 * de 1000 registros; si la base no tiene el historial, ningún registro tiene cambio.
 */
async function ultimosCambios(db: any, tabla: string, ids: unknown[]): Promise<Map<number, { id: number; at: string; by: number }>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, { id: number; at: string; by: number }>();
    try {
        for (let i = 0; i < all.length; i += 1000) {
            const rows = await db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } }, select: { id: true, registro_id: true, created_by: true, created_at: true } });
            for (const c of rows) {
                const at = fmtDt(c.created_at);
                if (!at) continue;
                const prev = out.get(Number(c.registro_id));
                if (!prev || at > prev.at || (at === prev.at && Number(c.id) > prev.id)) out.set(Number(c.registro_id), { id: Number(c.id), at, by: Number(c.created_by) });
            }
        }
    } catch {
        /* sin historial */
    }
    return out;
}

/** «código - nombre completo» del empleado (solo el nombre si no hay código; solo el código si no hay nombre). */
const personaLabel = (e: any): string | null => {
    if (!e) return null;
    const nom = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    const cod = txt(e.codigo);
    return cod && nom ? `${cod} - ${nom}` : nom || cod;
};

/**
 * Visitas de vehículos (`e_registro_vehiculos`). Se omite `file_name` (archivo adjunto).
 *
 * Columnas para los filtros (las agrega `load`): `division` sale del contrato (con la de la cabecera como respaldo),
 * `ejecutivo_cuenta` es el de la sucursal y `creado_por` quien registró la visita (`responsable_id` guarda al usuario de la sesión
 * que la creó). `creado` es la fecha de creación del registro (`created_at`); la de la visita es `entrada`. `modificado` es `updated_at` y `modificado_por`
 * el autor del último cambio del historial. La ubicación («código - nombre») la agrega `load`. `responsable` se muestra como «código - nombre». `departamento` y `persona_visita` son los dos datos que
 * `persona_lugar_visita` junta.
 */
export function mapVisitaVehiculoRow(r: any): OutRow {
    const ubic: Partial<UbicacionTextos> = r.ubicacion ?? {};
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        entrada: fmtDt(r.hora_entrada),
        salida: fmtDt(r.hora_salida),
        tipo: txt(r.tipo),
        placa: txt(r.placa),
        visitante: txt(r.nombre),
        cedula: txt(r.cedula),
        motivo: txt(r.razon_visita),
        persona_lugar_visita: txt(r.persona_lugar_visita),
        responsable: personaLabel(r.c_empleado) ?? txt(r.responsable_label),
        empresa: ubic.empresa ?? null,
        cliente: ubic.cliente ?? null,
        division: txt(r.division_contrato) ?? ubic.division ?? null,
        contrato: ubic.contrato ?? null,
        sucursal: ubic.sucursal ?? null,
        puesto: ubic.puesto ?? null,
        puesto_salida: txt(r.puesto_salida_nombre),
        departamento: txt(r.departamento_visita),
        persona_visita: txt(r.persona_visita),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        creado_por: txt(r.creado_por_nombre),
        modificado: fmtDt(r.updated_at),
        modificado_por: txt(r.modificado_por_nombre),
    };
}

/**
 * Agrega, por lote (una consulta por dato, no por fila), la ubicación («código - nombre»), el ejecutivo de la sucursal, la división del contrato,
 * quien registró (`responsable_id`) y quien hizo el último cambio del historial (`c_cambios_apps_modules`).
 */
export async function enrichVehiculos(db: any, rows: any[]): Promise<any[]> {
    const ubicOf = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
    const cambios = await ultimosCambios(db, "e_registro_vehiculos", rows.map((r) => r.id));
    const [ejecutivos, divisiones, nombres, ubic] = await Promise.all([
        ejecutivoPorCorpo(db, rows.map((r) => r.corpo_id)),
        divisionPorContrato(db, rows.map((r) => r.contrato_id)),
        nombresEmpleado(db, [...rows.map((r) => r.responsable_id), ...[...cambios.values()].map((c) => c.by)]),
        ubicacionTextos(db, rows.map(ubicOf)),
    ]);
    return rows.map((r) => {
        const c = cambios.get(Number(r.id));
        return {
            ...r,
            ejecutivo_cuenta_nombre: ejecutivos.get(Number(r.corpo_id)) ?? null,
            division_contrato: divisiones.get(Number(r.contrato_id)) ?? null,
            creado_por_nombre: usuarioInserta(r.responsable_id, nombres),
            modificado_por_nombre: c ? usuarioInserta(c.by, nombres) : null,
            ubicacion: ubic(ubicOf(r)),
        };
    });
}

/** Días extra que se leen después del periodo: la consulta filtra por `created_at`, pero la fecha del reporte es la de entrada. */
export const REZAGO_REGISTRO_DIAS = 7;

/** Se queda con las visitas cuya entrada (`hora_entrada`, la «Fecha» del reporte) cae en `[from, to)`. */
export function filterByEntrada(rows: any[], from: string, to: string): any[] {
    const lo = `${from}T00:00:00`;
    const hi = `${to}T00:00:00`;
    return rows.filter((r) => {
        const e = fmtDt(r.hora_entrada);
        return !!e && e >= lo && e < hi;
    });
}

/** Filas cuya ubicación (la de la cabecera del registro) cae dentro del alcance; sin alcance, todas. */
export function filterVehiculosByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Visitas de vehículos. Cada fila trae empresa, cliente, división, contrato, sucursal y puesto de ingreso.
 * El periodo `from/to` se aplica a la **entrada** (`hora_entrada`, la fecha del Excel), no a la fecha de creación del registro.
 */
export const visitasVehiculos: GuardifyReportModule = {
    id: "visitas_vehiculos",
    supportsScope: true,
    searchKeys: ["placa", "visitante", "cedula", "responsable", "motivo", "persona_visita", "departamento", "puesto"],
    filterKeys: ["tipo", "placa", "division", "responsable", "departamento", "persona_visita", "ejecutivo_cuenta", "creado_por", "creado", "modificado", "modificado_por", "entrada", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["entrada", "salida", "tipo", "placa", "visitante", "cedula", "responsable", "departamento", "persona_visita", "division", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    defaultSort: "entrada",
    form: visitasVehiculosForm,
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { queryVisitasVehiculosRows } = await import("../../reports-functions/visitasVehiculosReport");
        const rows = await queryVisitasVehiculosRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, REZAGO_REGISTRO_DIAS - 1)}T23:59:59` }, "created_at", { take: 50_000 });
        const kept = filterVehiculosByScope(filterByEntrada(rows, p.from, p.to), p.scope);
        return (await enrichVehiculos(db, kept)).map(mapVisitaVehiculoRow);
    },
};
