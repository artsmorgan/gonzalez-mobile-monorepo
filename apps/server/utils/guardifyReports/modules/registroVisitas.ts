import { divisionPorContrato, ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
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

/** Nombre de estructura; la consulta original rellena con el id (o «—») cuando no encuentra el registro: eso es «sin dato». */
const nombre = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    if (!s || s === "—" || s === String(id ?? "")) return null;
    return s;
};

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
 * `ejecutivo_cuenta` es el de la sucursal y `usuario_inserta` quien registró la visita (`responsable_id` guarda al usuario de la sesión
 * que la creó). `responsable` se muestra como «código - nombre».
 */
export function mapRegistroVisitaRow(r: any): OutRow {
    return {
        id: Number(r.id),
        entrada: fmtDt(r.hora_entrada),
        salida: fmtDt(r.hora_salida),
        visitante: txt(r.nombre),
        cedula: txt(r.cedula),
        funcionario: r.es_funcionario ? "Sí" : "No",
        motivo: txt(r.razon_visita),
        depto_visita: txt(r.dep_pers_visita),
        autoriza_salida: txt(r.pers_autoriza_salida),
        responsable: personaLabel(r.c_empleado) ?? txt(r.responsable_label),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.e_estructura_cliente?.nombre, r.cliente_id),
        division: txt(r.division_contrato) ?? nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.e_estructura_sucursal?.nombre, r.corpo_id),
        puesto: nombre(r.e_estructura_puesto?.nombre, r.puesto_id),
        puesto_salida: txt(r.puesto_salida_nombre),
        activos: Array.isArray(r.e_activo_visitante) ? r.e_activo_visitante.length : 0,
        observaciones: txt(r.observaciones),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        usuario_inserta: txt(r.usuario_inserta_nombre),
    };
}

/** Agrega, por lote (una consulta por dato, no por fila), el ejecutivo de la sucursal, la división del contrato y el usuario que registró. */
export async function enrichVisitas(db: any, rows: any[]): Promise<any[]> {
    const [ejecutivos, divisiones, nombres] = await Promise.all([
        ejecutivoPorCorpo(db, rows.map((r) => r.corpo_id)),
        divisionPorContrato(db, rows.map((r) => r.contrato_id)),
        nombresEmpleado(db, rows.map((r) => r.responsable_id)),
    ]);
    return rows.map((r) => ({
        ...r,
        ejecutivo_cuenta_nombre: ejecutivos.get(Number(r.corpo_id)) ?? null,
        division_contrato: divisiones.get(Number(r.contrato_id)) ?? null,
        usuario_inserta_nombre: usuarioInserta(r.responsable_id, nombres),
    }));
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
    filterKeys: ["funcionario", "division", "responsable", "depto_visita", "ejecutivo_cuenta", "usuario_inserta", "entrada", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["entrada", "salida", "visitante", "cedula", "funcionario", "responsable", "depto_visita", "division", "ejecutivo_cuenta", "usuario_inserta", "empresa", "cliente", "contrato", "sucursal", "puesto", "activos"],
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
