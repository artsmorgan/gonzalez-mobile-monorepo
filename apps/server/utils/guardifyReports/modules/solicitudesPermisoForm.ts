import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Solicitud de permisos como formulario (`c_solicitud_permiso`): una hoja por solicitud, igual que `buildSolicitudesPermisoExcelIndividual`.
 * El papel imprime fecha, colaborador, con/sin goce, motivo, «cantidad de días» (el generador cuenta los TURNOS afectados), rango de fechas,
 * observaciones y las dos firmas manuales (colaborador y ejecutivo de cuenta). `firma_responsable` y la firma digital del ejecutivo no son
 * imágenes de garabato (son el hash de la firma digital con ubicación) y el papel no las imprime: no se entregan.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** Imagen de firma como data URL; lo que no es una imagen (un hash, un texto) no es una firma que se pueda dibujar. */
export function firmaImagen(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
    if (s.startsWith("iVBOR")) return `data:image/png;base64,${s}`;
    if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
    return null;
}

/** Los turnos se guardan como JSON; el papel solo los cuenta. */
function contarTurnos(raw: unknown): number {
    if (!raw) return 0;
    try { const p = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(p) ? p.length : 0; } catch { return 0; }
}

/** «Con goce» / «Sin goce» (así lo guarda la pantalla; se compara sin importar mayúsculas). */
const goce = (tipo: unknown, cual: "con" | "sin"): "Sí" | "No" => (String(tipo ?? "").toLowerCase().includes(`${cual} goce`) ? "Sí" : "No");

function nombreEmpleado(e: any): { nombre: string | null; codigo: string | null } {
    if (!e) return { nombre: null, codigo: null };
    const codigo = txt(e.codigo);
    const nombre = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    return { nombre: nombre || codigo, codigo };
}

/** `raw` es la fila de `c_solicitud_permiso` con su empleado en `c_empleado` (como lo trae el módulo de lista). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const creado = fmtDt(raw.created_at);
    const { nombre, codigo } = nombreEmpleado(raw.c_empleado);
    const inicio = dia(raw.fecha_inicio), fin = dia(raw.fecha_fin);
    const rango = [inicio, fin].filter(Boolean).join(" — ");
    const sign: Record<string, string> = {};
    const colaborador = firmaImagen(raw.firma_empleado_manual);
    const ejecutivo = firmaImagen(raw.firma_ejecutivo_cuenta_manual);
    if (colaborador) sign.firma_colaborador = colaborador;
    if (ejecutivo) sign.firma_ejecutivo = ejecutivo;
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            fecha: creado ? creado.slice(0, 10) : null,
            nombre_colaborador: nombre,
            codigo_colaborador: codigo,
            permiso_con_goce: goce(raw.tipo, "con"),
            permiso_sin_goce: goce(raw.tipo, "sin"),
            motivo: txt(raw.motivo)?.slice(0, 2000) ?? null,
            cantidad_dias: contarTurnos(raw.turnos),
            fechas_permiso: rango ? `Del: ${rango}` : null,
            observaciones: txt(raw.observaciones)?.slice(0, 2000) ?? null,
        },
        listas: {},
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const solicitudesPermisoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Solo activas, como el módulo de lista. Una consulta por tabla (empleados y estructura en lote).
        const rows: any[] = await (db as any).c_solicitud_permiso.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const loc = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const [empleados, ubic, divisiones] = await Promise.all([
            findByIds<any>(db as any, "c_empleado", rows.map((r) => r.empleado_id), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
            ubicacionTextos(db as any, rows.map(loc)),
            // La división de la cabecera viene en 0 en registros viejos: entonces sale la del contrato.
            divisionPorContrato(db as any, rows.map((r) => r.contrato_id)),
        ]);
        return rows.map((r) => {
            const u = ubic(loc(r));
            return armarRegistro({ ...r, c_empleado: empleados.get(Number(r.empleado_id)) }, { ...u, division: u.division ?? divisiones.get(Number(r.contrato_id)) ?? null }, firmas);
        });
    },
};
