import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { nombresEmpleado, ubicacionTextos, usuarioInserta } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Registro de vehículos corporativos como formulario: un registro = un vehículo con sus usos y mantenimientos como tablas hijas
 * (`c_vehiculos_corporativos`, `c_usos_vehiculos_corporativos`, `c_mantenimiento_vehiculos_corporativos`). La tabla es la misma para
 * vehículo, motocicleta y bicicleta; solo cambian los campos que la pantalla del móvil muestra (la bicicleta no lleva placa, kilometraje,
 * cambio de aceite, modelo, año ni documentos).
 *
 * Nunca salen las fotos del vehículo ni las de «antes/después» de cada mantenimiento: ni siquiera se consultan sus columnas.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const sino = (v: unknown): string | null => (v === true || v === 1 ? "Sí" : v === false || v === 0 ? "No" : null);
const dia = (d: unknown): string | null => fmtDt(d as any)?.slice(0, 10) ?? null;
const hora = (d: unknown): string | null => fmtDt(d as any)?.slice(11, 16) ?? null;

/** El móvil guarda «Vehículo», «Bicicleta» o «Motocicleta»; se tolera otra escritura (mayúsculas, sin tilde). */
export function varianteDe(tipo: unknown): string | null {
    const t = String(tipo ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (t.startsWith("bici")) return "Bicicleta";
    if (t.startsWith("moto")) return "Motocicleta";
    if (t.startsWith("veh") || t.startsWith("auto") || t.startsWith("carro")) return "Vehículo";
    return txt(tipo);
}

/**
 * Las firmas del conductor y del mecánico se guardan como base64 sin prefijo; la del responsable es un código de sesión (QR/GPS), no una
 * imagen: de esa solo se informa que existe. Devuelve el data URL si el valor es una imagen; si no, null.
 */
export function imagenDeFirma(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(s)) return `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}`;
    return null;
}

export type VehiculoCrudo = Record<string, any> & { usos?: any[]; mantenimientos?: any[]; creador?: string | null };

export function armarRegistro(raw: VehiculoCrudo, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const creado = fmtDt(raw.created_at);
    const bici = varianteDe(raw.tipo) === "Bicicleta";
    const valores: FormRecord["valores"] = {
        tipo: txt(raw.tipo), placa: txt(raw.placa), tipo_autoria: txt(raw.tipo_autoria), estado: txt(raw.estado), marca: txt(raw.marca),
        modelo: txt(raw.modelo), anno: num(raw.anno), kilometraje: num(raw.kilometraje), prox_cambio_aceite: num(raw.prox_cambio_aceite),
        descripcion: txt(raw.descripcion),
        fecha_creacion: creado ? creado.slice(0, 10) : null, hora_creacion: creado ? creado.slice(11, 16) : null, creado_por: txt(raw.creador),
    };
    const documentos = bici ? [] : [
        { item: "Título de propiedad", valor: sino(raw.titulo_propiedad) },
        { item: "RTV", valor: sino(raw.rtv) },
        { item: "Marchamo", valor: sino(raw.marchamo) },
    ];
    const usos = (raw.usos ?? []).map((u) => ({
        conductor: txt(u.nombre_conductor), codigo: txt(u.codigo_conductor), fecha: dia(u.fecha), inicio: hora(u.inicio), fin: hora(u.fin),
        km_inicio: num(u.km_inicio), km_fin: num(u.km_fin), motivo: txt(u.motivo), combustible_inicio: txt(u.combustible_inicio), combustible_fin: txt(u.combustible_fin),
    }));
    const mantenimientos = (raw.mantenimientos ?? []).map((m) => ({
        fecha: dia(m.fecha), tipo: txt(m.tipo), mantenimiento: txt(m.mantenimiento), diagnostico: txt(m.diagnostico),
        km_siguiente: num(m.kilometraje_siguiente_revision), mecanico: txt(m.nombre_mecanico),
    }));
    // Solo la firma del responsable del vehículo cabe en el pie; las de conductor y mecánico son por fila de tabla y no se dibujan.
    const responsable = txt(raw.firma_responsable);
    const presentes = responsable ? ["firma_responsable"] : [];
    return {
        id: Number(raw.id), variante: varianteDe(raw.tipo), creado, estructura: ubic, valores,
        listas: { documentos, usos, mantenimientos },
        firmas: Object.fromEntries(presentes.map((k) => [k, firmas ? imagenDeFirma(responsable) : null])),
        firmasPresentes: presentes,
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.sucursal_id, puesto: raw.puesto_id },
    };
}

export const registroVehiculosCorporativosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Igual que la lista: no se filtra por `isActive` (el estado «activo» es una columna del reporte).
        const rows: any[] = await (db as any).c_vehiculos_corporativos.findMany({
            where: { id: { in: ids } },
            select: {
                id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, sucursal_id: true, puesto_id: true,
                tipo: true, placa: true, tipo_autoria: true, estado: true, marca: true, modelo: true, anno: true, kilometraje: true, prox_cambio_aceite: true,
                descripcion: true, titulo_propiedad: true, rtv: true, marchamo: true, firma_responsable: true, created_at: true, created_by: true,
            },
        });
        if (!rows.length) return [];
        const vids = rows.map((r) => r.id);
        // Una consulta por tabla hija; sin las columnas de fotos ni de firmas (las de conductor y mecánico no se dibujan).
        const [usos, mants, ubic, nombres] = await Promise.all([
            (db as any).c_usos_vehiculos_corporativos.findMany({
                where: { vehiculo_id: { in: vids } }, orderBy: { id: "asc" },
                select: { id: true, vehiculo_id: true, nombre_conductor: true, codigo_conductor: true, fecha: true, inicio: true, fin: true, km_inicio: true, km_fin: true, motivo: true, combustible_inicio: true, combustible_fin: true },
            }),
            (db as any).c_mantenimiento_vehiculos_corporativos.findMany({
                where: { vehiculo_id: { in: vids } }, orderBy: { id: "asc" },
                select: { id: true, vehiculo_id: true, fecha: true, tipo: true, mantenimiento: true, diagnostico: true, kilometraje_siguiente_revision: true, nombre_mecanico: true },
            }),
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id }))),
            nombresEmpleado(db as any, rows.map((r) => r.created_by)),
        ]);
        const porVehiculo = <T extends { vehiculo_id: unknown }>(list: T[]) => { const m = new Map<number, T[]>(); for (const x of list) { const k = Number(x.vehiculo_id); (m.get(k) ?? m.set(k, []).get(k)!).push(x); } return m; };
        const usosDe = porVehiculo(usos as any[]), mantsDe = porVehiculo(mants as any[]);
        return rows.map((r) => armarRegistro(
            { ...r, usos: usosDe.get(Number(r.id)) ?? [], mantenimientos: mantsDe.get(Number(r.id)) ?? [], creador: usuarioInserta(r.created_by, nombres) },
            ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id }),
            firmas,
        ));
    },
};
