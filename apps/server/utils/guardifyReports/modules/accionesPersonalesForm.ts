import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, nombresEmpleado, ubicacionTextos, usuarioInserta } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";

/**
 * Acción de personal como formulario (`c_accion_personal`). No hay generador individual ni pantalla de captura en el móvil: el formato sale de las
 * mismas columnas que el módulo de lista y entrega EXACTAMENTE los mismos datos que él (nada de salarios, montos, usuarios de aprobación o reversión,
 * ni la ruta del adjunto). El detalle propio de cada tipo de acción (ausencia, traslado, vacaciones…) vive en tablas aparte que este módulo tampoco lee.
 * Esta tabla no guarda firmas: no hay firmas que entregar.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const withCode = (code: unknown, name: unknown, sep = " - "): string | null => {
    const n = txt(name);
    if (!n) return null;
    const c = txt(code);
    return c ? `${c}${sep}${n}` : n;
};
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** Lookups ya resueltos en lote (por id). */
export type AccionLookups = {
    empleados?: Map<number, any>; tipos?: Map<number, any>; plazas?: Map<number, any>; horarios?: Map<number, any>; usuarios?: Map<number, string>;
};

/** `raw` es la fila de `c_accion_personal`; los nombres se resuelven con `l` (ver `loadRecords`). La división es la del contrato (`divisionId`). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], _firmas: boolean, l: AccionLookups = {}, divisionId?: number | null): FormRecord {
    const emp = l.empleados?.get(Number(raw.empleado_id));
    const rep = l.empleados?.get(Number(raw.reemplazo_id));
    const tipo = l.tipos?.get(Number(raw.tipoAccion_id));
    const plaza = l.plazas?.get(Number(raw.plaza_id));
    const registrada = fmtDt(raw.fecha_insercion);
    return {
        id: Number(raw.id), variante: null, creado: registrada, estructura: ubic,
        valores: {
            consecutivo: txt(raw.consecutivo),
            tipo_accion: withCode(tipo?.codigo, tipo?.nombre, " — "),
            // La base guarda un código de hasta 3 letras; se entrega tal cual (no se conocen todos los códigos).
            estado_aprobacion: txt(raw.estado_aprobacion),
            fecha_inicio: dia(raw.fecha_inicio),
            fecha_fin: dia(raw.fecha_fin),
            cantidad_horas: raw.cantidad_horas == null || !Number.isFinite(Number(raw.cantidad_horas)) ? null : Number(raw.cantidad_horas),
            reversible: raw.reversible == null ? null : raw.reversible ? "Sí" : "No",
            empleado: emp ? withCode(emp.codigo, buildNombre(emp)) : null,
            cedula: txt(emp?.cedula),
            reemplazo: rep ? txt(buildNombre(rep)) : null,
            horario: txt(l.horarios?.get(Number(raw.horario_id))?.titulo),
            plaza: withCode(plaza?.codigo_plaza, plaza?.nombre),
            comentarios: txt(raw.comentarios)?.slice(0, 500) ?? null,
            // Solo si tiene adjunto; nunca el nombre ni la ruta del archivo.
            adjunto: txt(raw.document) ? "Sí" : "No",
            registrada: registrada ? registrada.replace("T", " ").slice(0, 16) : null,
            registrada_por: usuarioInserta(raw.usuario_insercion, l.usuarios ?? new Map()),
        },
        listas: {},
        firmas: {}, firmasPresentes: [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: divisionId ?? null, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

/** Solo las columnas que ya usa el módulo de lista (sin salarios, montos ni usuarios de aprobación). */
const COLS = {
    id: true, empleado_id: true, reemplazo_id: true, tipoAccion_id: true, empresa_id: true, cliente_id: true, contrato_id: true, corpo_id: true, puesto_id: true, plaza_id: true, horario_id: true,
    consecutivo: true, usuario_insercion: true, fecha_inicio: true, fecha_fin: true, fecha_insercion: true, comentarios: true, document: true, reversible: true, estado_aprobacion: true, cantidad_horas: true,
} as const;

export const accionesPersonalesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, _opts) {
        // Igual que el módulo de lista: tabla sola (sin relaciones del cliente Prisma) y todo lo demás en lote.
        const rows: any[] = await (db as any).c_accion_personal.findMany({ where: { id: { in: ids } }, select: COLS });
        if (!rows.length) return [];
        const d = db as any;
        const col = (k: string) => rows.map((r) => r[k]);
        const [empleados, tipos, plazas, horarios, contratos, usuarios] = await Promise.all([
            findByIds<any>(d, "c_empleado", [...col("empleado_id"), ...col("reemplazo_id")], { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true }),
            findByIds<any>(d, "c_tipo_accion", col("tipoAccion_id"), { codigo: true, nombre: true }),
            findByIds<any>(d, "e_estructura_plazas", col("plaza_id"), { codigo_plaza: true, nombre: true }),
            findByIds<any>(d, "c_horario", col("horario_id"), { titulo: true }),
            // La acción no guarda la división: sale del contrato.
            findByIds<any>(d, "e_estructura_contrato", col("contrato_id"), { division_id: true }),
            // Quien registró: si `usuario_insercion` es un id de empleado se busca su nombre; si es texto, se deja tal cual.
            nombresEmpleado(d, rows.map((r) => (/^\d+$/.test(String(r.usuario_insercion ?? "").trim()) ? r.usuario_insercion : null))),
        ]);
        const divisionDe = (r: any): number | null => { const n = Number(contratos.get(Number(r.contrato_id))?.division_id); return n > 0 ? n : null; };
        const loc = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: divisionDe(r), contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(d, rows.map(loc));
        return rows.map((r) => armarRegistro(r, ubic(loc(r)), false, { empleados, tipos, plazas, horarios, usuarios }, divisionDe(r)));
    },
};
