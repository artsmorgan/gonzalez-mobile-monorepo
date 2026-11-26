import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Registro de capacitaciones como formulario (un solo formato). La capacitación lleva a los empleados y los puestos a los que se dirigió,
 * cada uno con su resultado (Bueno / Regular / Malo). No hay generador individual: el papel sale de la pantalla «Nueva Capacitación» y de
 * la hoja «Detalles» del consolidado. Nunca se entregan el archivo (`file`) ni los adjuntos.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

const empleadoLabel = (e: any): string | null => {
    if (!e) return null;
    const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    const cod = txt(e.codigo);
    return full ? (cod ? `${cod} - ${full}` : full) : cod;
};
const puestoLabel = (p: any): string | null => {
    const n = txt(p?.nombre);
    if (!n) return null;
    const c = txt(p?.codigo);
    return c ? `${c} - ${n}` : n;
};

/**
 * `raw` = fila de `e_registro_capacitaciones` con `empleados_cap` ({ id, label, cedula, resultado }) y `puestos_cap` ({ id, label, resultado })
 * ya resueltos, como los arma la consulta del reporte (`queryRegistroCapacitacionesRows`), y `responsable_label` (empleado de la sesión, de respaldo).
 */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const creado = fmtDt(raw.fecha);
    const empleados: any[] = Array.isArray(raw.empleados_cap) ? raw.empleados_cap : [];
    const puestos: any[] = Array.isArray(raw.puestos_cap) ? raw.puestos_cap : [];
    const firma = clasificarFirma(raw.firma_responsable);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            titulo: txt(raw.titulo), descripcion: txt(raw.descripcion), tipo: txt(raw.tipo), fecha: dia(raw.fecha), observaciones: txt(raw.observaciones),
            // Lo que se escribió en la pantalla; si falta, el empleado de la sesión que la registró.
            nombre_responsable: txt(raw.nombre_responsable) ?? txt(raw.responsable_label), cedula_responsable: txt(raw.cedula_responsable),
        },
        listas: {
            empleados: empleados.map((e) => ({ empleado: txt(e.label), cedula: txt(e.cedula), resultado: txt(e.resultado) })),
            puestos: puestos.map((p) => ({ puesto: txt(p.label), resultado: txt(p.resultado) })),
        },
        firmas: firma ? { firma_responsable: firmas ? firma.imagen : null } : {},
        firmasPresentes: firma ? ["firma_responsable"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const registroCapacitacionesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Mismas tablas y activos que el módulo de lista; los vínculos vienen por `include` como en la consulta del reporte.
        const rows: any[] = await (db as any).e_registro_capacitaciones.findMany({
            where: { id: { in: ids }, isActive: true },
            include: { e_capacitacion_empleado: true, e_capacitacion_puesto: true },
        });
        if (!rows.length) return [];
        const links = (r: any, k: string): any[] => (Array.isArray(r[k]) ? r[k] : []);
        const [ubic, empleados, puestos, divisiones] = await Promise.all([
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
            findByIds<any>(db as any, "c_empleado", rows.flatMap((r) => [r.responsable_id, ...links(r, "e_capacitacion_empleado").map((l) => l.empleado_id)]), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true }),
            findByIds<any>(db as any, "e_estructura_puesto", rows.flatMap((r) => links(r, "e_capacitacion_puesto").map((l) => l.puesto_id)), { codigo: true, nombre: true }),
            divisionPorContrato(db as any, rows.map((r) => r.contrato_id)),
        ]);
        const porId = new Map(rows.map((r) => [Number(r.id), r]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const r = porId.get(id)!;
            const u = ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
            return armarRegistro(
                {
                    ...r,
                    responsable_label: empleadoLabel(empleados.get(Number(r.responsable_id))),
                    empleados_cap: links(r, "e_capacitacion_empleado").map((l) => ({ label: empleadoLabel(empleados.get(Number(l.empleado_id))) ?? `#${l.empleado_id}`, cedula: empleados.get(Number(l.empleado_id))?.cedula ?? null, resultado: l.resultado ?? null })),
                    puestos_cap: links(r, "e_capacitacion_puesto").map((l) => ({ label: puestoLabel(puestos.get(Number(l.puesto_id))) ?? `#${l.puesto_id}`, resultado: l.resultado ?? null })),
                },
                // Igual que la lista: la división es la del contrato; la de la cabecera es el respaldo.
                { ...u, division: divisiones.get(Number(r.contrato_id)) ?? u.division },
                firmas,
            );
        });
    },
};
