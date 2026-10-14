import { divisionPorContrato, ejecutivoPorCorpo, nombresEmpleado, ubicacionTextos, usuarioInserta, type UbicacionTextos } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";
import { registroVisitasForm } from "./registroVisitasForm";

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
 * Registro de personas (visitantes). Se omiten a propósito `foto_cedula` (imagen de la cédula) y `firma_visitante`
 * (firma en base64); de los activos que ingresa el visitante solo se expone la cantidad.
 *
 * Columnas para los filtros (las agrega `load`): `division` sale del contrato (con la de la cabecera como respaldo),
 * `ejecutivo_cuenta` es el de la sucursal y `creado_por` quien registró la visita (`responsable_id` guarda al usuario de la sesión
 * que la creó). `creado` es la fecha de creación del registro (`created_at`); la de la visita es `entrada`. `modificado` es `updated_at` y `modificado_por`
 * el autor del último cambio del historial. La ubicación («código - nombre») la agrega `load`. `responsable` se muestra como «código - nombre».
 */
export function mapRegistroVisitaRow(r: any): OutRow {
    const ubic: Partial<UbicacionTextos> = r.ubicacion ?? {};
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        entrada: fmtDt(r.hora_entrada),
        salida: fmtDt(r.hora_salida),
        visitante: txt(r.nombre),
        cedula: txt(r.cedula),
        funcionario: r.es_funcionario ? "Sí" : "No",
        motivo: txt(r.razon_visita),
        depto_visita: txt(r.dep_pers_visita),
        autoriza_salida: txt(r.pers_autoriza_salida),
        responsable: personaLabel(r.c_empleado) ?? txt(r.responsable_label),
        empresa: ubic.empresa ?? null,
        cliente: ubic.cliente ?? null,
        division: txt(r.division_contrato) ?? ubic.division ?? null,
        contrato: ubic.contrato ?? null,
        sucursal: ubic.sucursal ?? null,
        puesto: ubic.puesto ?? null,
        puesto_salida: txt(r.puesto_salida_nombre),
        activos: Array.isArray(r.e_activo_visitante) ? r.e_activo_visitante.length : 0,
        observaciones: txt(r.observaciones),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        creado_por: (r as any).audit_creado_por ?? (txt(r.creado_por_nombre)),
        modificado: fmtDt(r.updated_at),
        modificado_por: (r as any).audit_modificado_por ?? (txt(r.modificado_por_nombre)),
    };
}

/**
 * Agrega, por lote (una consulta por dato, no por fila), la ubicación («código - nombre»), el ejecutivo de la sucursal, la división del contrato,
 * quien registró (`responsable_id`) y quien hizo el último cambio del historial (`c_cambios_apps_modules`).
 */
export async function enrichVisitas(db: any, rows: any[]): Promise<any[]> {
    const ubicOf = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
    const cambios = await ultimosCambios(db, "e_registro_personas", rows.map((r) => r.id));
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
export function filterVisitasByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Registro de visitas (`e_registro_personas`). Cada fila trae empresa, cliente, división, contrato, sucursal y puesto de ingreso.
 * El periodo `from/to` se aplica a la **entrada** (`hora_entrada`, la fecha del Excel), no a la fecha de creación del registro.
 */
export const registroVisitas: GuardifyReportModule = {
    id: "registro_visitas",
    supportsScope: true,
    searchKeys: ["visitante", "cedula", "responsable", "motivo", "depto_visita", "puesto"],
    filterKeys: ["funcionario", "division", "responsable", "depto_visita", "ejecutivo_cuenta", "creado_por", "creado", "modificado", "modificado_por", "entrada", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["entrada", "salida", "visitante", "cedula", "funcionario", "responsable", "depto_visita", "division", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por", "empresa", "cliente", "contrato", "sucursal", "puesto", "activos"],
    defaultSort: "entrada",
    form: registroVisitasForm,
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { queryRegistroVisitasRows } = await import("../../reports-functions/registroVisitasReport");
        const rows = await queryRegistroVisitasRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, REZAGO_REGISTRO_DIAS - 1)}T23:59:59` }, "created_at", { take: 50_000 });
        const kept = filterVisitasByScope(filterByEntrada(rows, p.from, p.to), p.scope);
        return (await enrichVisitas(db, kept)).map(mapRegistroVisitaRow);
    },
};
