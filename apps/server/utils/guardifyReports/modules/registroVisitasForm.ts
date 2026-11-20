import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Registro de visitas (personas) como formulario (`e_registro_personas`, activos en `e_activo_visitante`). El generador produce dos formatos:
 * «Control de visitantes» (SEG-F-052; aquí, una fila por visita) y, solo para las visitas que ingresan activos, «Control de activos de visitantes»
 * (SEG-F-024; una fila por activo). Como el segundo solo existe cuando hay activos, la variante es «Con activos» / «Sin activos».
 *
 * Nunca sale la foto de la cédula (`foto_cedula`): ni siquiera se consulta. La firma del visitante es una imagen real y solo viaja con `firmas`.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

export const CON_ACTIVOS = "Con activos";
export const SIN_ACTIVOS = "Sin activos";

/** La firma se guarda como data URL; si llegara sin prefijo (base64 suelto) se le pone. Cualquier otro texto no es una imagen. */
export function imagenDeFirma(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(s)) return `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}`;
    return null;
}

/** `detalles` del activo: JSON `[{ detalle, descripcion }]` → una línea «detalle: descripción» por ítem (como el Excel); un texto que no es JSON sale tal cual. */
export function detallesActivo(detalles: unknown): string | null {
    if (detalles == null) return null;
    let arr: any[];
    if (Array.isArray(detalles)) arr = detalles;
    else {
        const s = String(detalles).trim();
        if (!s) return null;
        try { const p = JSON.parse(s); arr = Array.isArray(p) ? p : []; } catch { return s.slice(0, 32000); }
    }
    const lines = arr.map((d) => {
        const det = txt(d?.detalle), desc = txt(d?.descripcion);
        return det && desc ? `${det}: ${desc}` : det ?? desc ?? "";
    }).filter(Boolean);
    return lines.length ? lines.join("\n").slice(0, 32000) : null;
}

export type VisitaCruda = Record<string, any> & { activos?: any[]; nro_sucursal?: string | null; codigo_puesto?: string | null };

export function armarRegistro(raw: VisitaCruda, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const entrada = fmtDt(raw.hora_entrada), salida = fmtDt(raw.hora_salida), creado = fmtDt(raw.created_at);
    const dia = entrada ? entrada.slice(0, 10) : null;
    const horaEntrada = entrada ? entrada.slice(11, 16) : null, horaSalida = salida ? salida.slice(11, 16) : null;
    // Lo que imprime el generador en «Motivo, Persona, Departamento Visita»: motivo, departamento/persona que se visita y quién autoriza la salida.
    const motivo = [raw.razon_visita, raw.dep_pers_visita, raw.pers_autoriza_salida].map(txt).filter(Boolean).join(" — ");
    const activos = (raw.activos ?? []).map((a) => ({
        fecha: dia, nro_corpo: txt(raw.nro_sucursal), nro_puesto: txt(raw.codigo_puesto), cedula: txt(raw.cedula), duenio: txt(raw.nombre),
        tipo_activo: txt(a.tipo_nombre), serie: txt(a.numero_id), visita: txt(raw.razon_visita), hora_ingreso: horaEntrada, hora_salida: horaSalida, observaciones: detallesActivo(a.detalles),
    }));
    const firma = imagenDeFirma(raw.firma_visitante);
    return {
        id: Number(raw.id), variante: activos.length ? CON_ACTIVOS : SIN_ACTIVOS, creado, estructura: ubic,
        valores: { fecha: dia },
        listas: {
            visitantes: [{ fecha: dia, visitante: txt(raw.nombre), cedula: txt(raw.cedula), hora_entrada: horaEntrada, hora_salida: horaSalida, motivo: txt(motivo) }],
            activos,
        },
        firmas: firma ? { firma_visitante: firmas ? firma : null } : {},
        firmasPresentes: firma ? ["firma_visitante"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const registroVisitasForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Igual que la lista: solo visitas activas. Sin `foto_cedula`.
        const rows: any[] = await (db as any).e_registro_personas.findMany({
            where: { id: { in: ids }, isActive: true },
            select: {
                id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true,
                nombre: true, cedula: true, hora_entrada: true, hora_salida: true, razon_visita: true, dep_pers_visita: true, pers_autoriza_salida: true, created_at: true, firma_visitante: true,
            },
        });
        if (!rows.length) return [];
        const activos: any[] = await (db as any).e_activo_visitante.findMany({
            where: { visitante_id: { in: rows.map((r) => r.id) } }, orderBy: { id: "asc" },
            select: { id: true, visitante_id: true, tipo_id: true, detalles: true, numero_id: true },
        });
        const [ubic, tipos, sucursales, puestos] = await Promise.all([
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
            findByIds<any>(db as any, "n_tipo_activo_visitas", activos.map((a) => a.tipo_id), { nombre: true }),
            // «Nº Corpo» y «Nº Puesto» del formato de activos son el número y el código sueltos.
            findByIds<any>(db as any, "e_estructura_sucursal", activos.length ? rows.map((r) => r.corpo_id) : [], { nro_sucursal: true }),
            findByIds<any>(db as any, "e_estructura_puesto", activos.length ? rows.map((r) => r.puesto_id) : [], { codigo: true }),
        ]);
        const porVisita = new Map<number, any[]>();
        for (const a of activos) { const k = Number(a.visitante_id); (porVisita.get(k) ?? porVisita.set(k, []).get(k)!).push({ ...a, tipo_nombre: tipos.get(Number(a.tipo_id))?.nombre ?? null }); }
        return rows.map((r) => armarRegistro(
            { ...r, activos: porVisita.get(Number(r.id)) ?? [], nro_sucursal: sucursales.get(Number(r.corpo_id))?.nro_sucursal ?? null, codigo_puesto: puestos.get(Number(r.puesto_id))?.codigo ?? null },
            ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }),
            firmas,
        ));
    },
};
