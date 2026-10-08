import { divisionPorContrato, ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
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
 * Visitas de vehículos (`e_registro_vehiculos`). Se omite `file_name` (archivo adjunto).
 *
 * Columnas para los filtros (las agrega `load`): `division` sale del contrato (con la de la cabecera como respaldo),
 * `ejecutivo_cuenta` es el de la sucursal y `usuario_inserta` quien registró la visita (`responsable_id` guarda al usuario de la sesión
 * que la creó). `responsable` se muestra como «código - nombre». `departamento` y `persona_visita` son los dos datos que
 * `persona_lugar_visita` junta.
 */
export function mapVisitaVehiculoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        entrada: fmtDt(r.hora_entrada),
        salida: fmtDt(r.hora_salida),
        tipo: txt(r.tipo),
        placa: txt(r.placa),
        visitante: txt(r.nombre),
        cedula: txt(r.cedula),
        motivo: txt(r.razon_visita),
        persona_lugar_visita: txt(r.persona_lugar_visita),
        responsable: personaLabel(r.c_empleado) ?? txt(r.responsable_label),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.e_estructura_cliente?.nombre, r.cliente_id),
        division: txt(r.division_contrato) ?? nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.e_estructura_sucursal?.nombre, r.corpo_id),
        puesto: nombre(r.e_estructura_puesto?.nombre, r.puesto_id),
        puesto_salida: txt(r.puesto_salida_nombre),
        departamento: txt(r.departamento_visita),
        persona_visita: txt(r.persona_visita),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        usuario_inserta: txt(r.usuario_inserta_nombre),
    };
}

/** Agrega, por lote (una consulta por dato, no por fila), el ejecutivo de la sucursal, la división del contrato y el usuario que registró. */
export async function enrichVehiculos(db: any, rows: any[]): Promise<any[]> {
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
    filterKeys: ["tipo", "placa", "division", "responsable", "departamento", "persona_visita", "ejecutivo_cuenta", "usuario_inserta", "entrada", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["entrada", "salida", "tipo", "placa", "visitante", "cedula", "responsable", "departamento", "persona_visita", "division", "ejecutivo_cuenta", "usuario_inserta", "empresa", "cliente", "contrato", "sucursal", "puesto"],
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
