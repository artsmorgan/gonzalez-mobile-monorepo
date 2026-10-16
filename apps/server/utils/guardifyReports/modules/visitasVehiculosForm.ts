import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { nombresEmpleado, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Visitas de vehículos como formulario: la bitácora «Control de ingreso y salida de visitas y vehículos institucionales» (`e_registro_vehiculos`).
 * El papel es un libro (una hoja por puesto y día, una fila por vehículo); aquí cada registro es UNA fila de ese libro, con el cliente, el puesto y
 * la fecha de la cabecera. No lleva firmas. No salen la cédula del conductor ni la foto de la matrícula (`file_name`): la bitácora tampoco las imprime.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Lo que imprime el generador en «Persona o Lugar que visita»: persona / departamento y, si no hay, la razón de la visita. */
export function personaLugar(r: Record<string, unknown>): string | null {
    const junto = [r.persona_visita, r.departamento_visita].map(txt).filter(Boolean).join(" / ");
    return junto || txt(r.razon_visita);
}

export type VisitaVehiculoCrudo = Record<string, any> & { responsable?: string | null };

export function armarRegistro(raw: VisitaVehiculoCrudo, ubic: FormRecord["estructura"], _firmas: boolean): FormRecord {
    const entrada = fmtDt(raw.hora_entrada), salida = fmtDt(raw.hora_salida), creado = fmtDt(raw.created_at);
    const fila = {
        placa: txt(raw.placa), visitante: txt(raw.nombre), hora_entrada: entrada ? entrada.slice(11, 16) : null, hora_salida: salida ? salida.slice(11, 16) : null,
        oficial: txt(raw.responsable), visita: personaLugar(raw),
    };
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        // La fecha de la hoja es la de la entrada (como el reporte), no la del registro.
        valores: { fecha: entrada ? entrada.slice(0, 10) : null },
        listas: { ingresos: [fila] },
        firmas: {}, firmasPresentes: [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const visitasVehiculosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).e_registro_vehiculos.findMany({
            where: { id: { in: ids }, isActive: true },
            select: {
                id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true,
                placa: true, nombre: true, hora_entrada: true, hora_salida: true, razon_visita: true, persona_visita: true, departamento_visita: true, responsable_id: true, created_at: true,
            },
        });
        if (!rows.length) return [];
        const [ubic, nombres] = await Promise.all([
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
            nombresEmpleado(db as any, rows.map((r) => r.responsable_id)),
        ]);
        return rows.map((r) => armarRegistro(
            { ...r, responsable: nombres.get(Number(r.responsable_id)) ?? null },
            ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }),
            firmas,
        ));
    },
};
