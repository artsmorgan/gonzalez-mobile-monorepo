import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, ubicacionTextos } from "../enrich";
import type { AttachmentFetcher, FormAttachment, FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Solicitud de permisos como formulario (`c_solicitud_permiso`): una hoja por solicitud, igual que `buildSolicitudesPermisoExcelIndividual`.
 * El papel imprime fecha, colaborador, con/sin goce, motivo, «cantidad de días» (el generador cuenta los TURNOS afectados), rango de fechas,
 * observaciones y las dos firmas manuales (colaborador y ejecutivo de cuenta). `firma_responsable` y la firma digital del ejecutivo no son
 * imágenes de garabato (son el hash de la firma digital con ubicación) y el papel no las imprime: no se entregan.
 *
 * Además (pedido del cliente): cédula, tipo de permiso en texto, fechas sueltas, días del permiso, cantidad de turnos, la lista `turnos`
 * (fecha, horario, tipo y reemplazo de cada turno) y los `adjuntos` del registro (de `c_archivos_solicitud_permiso`; el archivo se baja aparte
 * por `…/forms/{id}/attachments/{attachmentId}`).
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

/** Los turnos se guardan como JSON (igual que `safeParseTurnos` de la consulta de la lista): lo que no se puede leer, vacío. */
function leerTurnos(raw: unknown): any[] {
    if (!raw) return [];
    try { const p = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(p) ? p : []; } catch { return []; }
}

/** El papel solo cuenta los turnos. */
const contarTurnos = (raw: unknown): number => leerTurnos(raw).length;

/** «Diurno», «Nocturno», «Mixto» (u otro texto tal cual, con la primera letra en mayúscula). Lo usa también la lista. */
export const tipoTurnoLabel = (v: unknown): string | null => {
    const s = txt(v)?.slice(0, 60) ?? null;
    if (!s) return null;
    const k = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (k.includes("nocturn")) return "Nocturno";
    if (k.includes("mixt")) return "Mixto";
    if (k.includes("diurn")) return "Diurno";
    return s.charAt(0).toUpperCase() + s.slice(1);
};

/** `HH:mm` de «6:00», «06:00:00» o una fecha con hora; lo que no parece una hora, null. */
function horaCorta(v: unknown): string | null {
    const s = txt(v);
    if (!s) return null;
    const m = /(?:^|T|\s)(\d{1,2}):(\d{2})/.exec(s);
    return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : null;
}

/**
 * Días del permiso con la misma regla que la lista (`dias_permiso` de `querySolicitudesPermisoRows`): días calendario entre la fecha de
 * inicio y la de fin, ambos inclusive (0 si el fin es anterior). Si la fila ya trae `dias_permiso`, se usa ese. Sin alguna fecha, null.
 */
export function diasPermiso(raw: any): number | null {
    if (raw?.dias_permiso != null && raw.dias_permiso !== "" && Number.isFinite(Number(raw.dias_permiso))) return Number(raw.dias_permiso);
    const a = dia(raw?.fecha_inicio), b = dia(raw?.fecha_fin);
    if (!a || !b) return null;
    const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
    if (!Number.isFinite(ms)) return null;
    return ms < 0 ? 0 : Math.floor(ms / 86400000) + 1;
}

/** «Con goce» / «Sin goce» (así lo guarda la pantalla; se compara sin importar mayúsculas). */
const goce = (tipo: unknown, cual: "con" | "sin"): "Sí" | "No" => (String(tipo ?? "").toLowerCase().includes(`${cual} goce`) ? "Sí" : "No");

/** «Con goce de salario» / «Sin goce de salario» según `tipo` (misma regla que `goce`); null si no se reconoce. */
export function tipoPermiso(tipo: unknown): "Con goce de salario" | "Sin goce de salario" | null {
    if (goce(tipo, "con") === "Sí") return "Con goce de salario";
    if (goce(tipo, "sin") === "Sí") return "Sin goce de salario";
    return null;
}

const MIME: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "video/mp4",
};

/** Tipo MIME de un adjunto por su `extension` (si no se reconoce, por `type` cuando trae una extensión o uno de esos MIME); si no, null. */
export function mimeAdjunto(extension: unknown, type?: unknown): string | null {
    const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/^\./, "");
    const ext = norm(extension);
    if (MIME[ext]) return MIME[ext]!;
    const t = norm(type);
    if (MIME[t]) return MIME[t]!;
    if (Object.values(MIME).includes(t)) return t;
    return null;
}

/** Nombre visible de un adjunto: el original; si viene vacío, el guardado. */
const nombreAdjunto = (a: any): string => txt(a?.original_name) ?? txt(a?.name) ?? `archivo-${a?.id ?? ""}`;

/** Adjuntos del registro (contrato de Guardify: `{ id, nombre, tipo?, bytes? }`; el tamaño no se guarda en la tabla). */
export function armarAdjuntos(archivos: any[] | undefined): FormAttachment[] {
    return (archivos ?? []).map((a) => ({ id: String(a.id), nombre: nombreAdjunto(a), tipo: mimeAdjunto(a.extension, a.type), bytes: null }));
}

export function nombreEmpleado(e: any): { nombre: string | null; codigo: string | null } {
    if (!e) return { nombre: null, codigo: null };
    const codigo = txt(e.codigo);
    const nombre = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    return { nombre: nombre || codigo, codigo };
}

/** «código - nombre» de un empleado (solo uno de los dos si falta el otro). */
const codigoNombre = (e: any): string | null => {
    const { nombre, codigo } = nombreEmpleado(e);
    return codigo && nombre && nombre !== codigo ? `${codigo} - ${nombre}` : nombre ?? codigo;
};

/** Una fila por turno del JSON `turnos` (`{ plaza_id, fecha, hora_inicio, hora_fin, tipo_turno, reemplazo_id }`). */
export function armarTurnos(rawTurnos: unknown, reemplazos: Map<number, any> = new Map()): Record<string, string | number | null>[] {
    return leerTurnos(rawTurnos).map((t: any) => {
        const ini = horaCorta(t?.hora_inicio), fin = horaCorta(t?.hora_fin);
        const rid = Number(t?.reemplazo_id);
        const rep = Number.isFinite(rid) && rid > 0 ? reemplazos.get(rid) : undefined;
        return {
            fecha: dia(t?.fecha),
            horario: ini && fin ? `${ini} – ${fin}` : null,
            tipo: tipoTurnoLabel(t?.tipo_turno),
            reemplazo: rep ? codigoNombre(rep) : null,
        };
    });
}

/**
 * `raw` es la fila de `c_solicitud_permiso` con su empleado en `c_empleado` (como lo trae el módulo de lista). `extra` trae lo que se carga
 * en lote: los empleados de reemplazo por id y las filas de `c_archivos_solicitud_permiso` de esta solicitud.
 */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, extra: { reemplazos?: Map<number, any>; archivos?: any[] } = {}): FormRecord {
    const creado = fmtDt(raw.created_at);
    const { nombre, codigo } = nombreEmpleado(raw.c_empleado);
    const inicio = dia(raw.fecha_inicio), fin = dia(raw.fecha_fin);
    const rango = [inicio, fin].filter(Boolean).join(" — ");
    const sign: Record<string, string> = {};
    const colaborador = firmaImagen(raw.firma_empleado_manual);
    const ejecutivo = firmaImagen(raw.firma_ejecutivo_cuenta_manual);
    if (colaborador) sign.firma_colaborador = colaborador;
    if (ejecutivo) sign.firma_ejecutivo = ejecutivo;
    const turnos = contarTurnos(raw.turnos);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            fecha: creado ? creado.slice(0, 10) : null,
            nombre_colaborador: nombre,
            codigo_colaborador: codigo,
            permiso_con_goce: goce(raw.tipo, "con"),
            permiso_sin_goce: goce(raw.tipo, "sin"),
            motivo: txt(raw.motivo)?.slice(0, 2000) ?? null,
            // Compatibilidad: el papel llama «cantidad de días» a la cantidad de TURNOS (igual que `cantidad_turnos`).
            cantidad_dias: turnos,
            fechas_permiso: rango ? `Del: ${rango}` : null,
            observaciones: txt(raw.observaciones)?.slice(0, 2000) ?? null,
            cedula_colaborador: txt(raw.c_empleado?.cedula),
            tipo_permiso: tipoPermiso(raw.tipo),
            fecha_creacion: creado,
            fecha_desde: inicio,
            fecha_hasta: fin,
            dias_permiso: diasPermiso(raw),
            cantidad_turnos: turnos,
        },
        listas: { turnos: armarTurnos(raw.turnos, extra.reemplazos) },
        adjuntos: armarAdjuntos(extra.archivos),
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

const COLS_ARCHIVO = { id: true, solicitud_id: true, name: true, original_name: true, type: true, extension: true };

/**
 * Archivos de las solicitudes en lote (`solicitud_id in […]`; una consulta por cada 1000 solicitudes, como `findByIds`), agrupados por
 * solicitud en el orden en que se subieron.
 */
export async function cargarArchivos(db: any, solicitudIds: unknown[]): Promise<Map<number, any[]>> {
    const ids = [...new Set(solicitudIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const out = new Map<number, any[]>();
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += 1000) {
        rows.push(...await db.c_archivos_solicitud_permiso.findMany({ where: { solicitud_id: { in: ids.slice(i, i + 1000) } }, select: COLS_ARCHIVO, orderBy: { id: "asc" } }));
    }
    for (const a of rows) {
        const k = Number(a.solicitud_id);
        if (!out.has(k)) out.set(k, []);
        out.get(k)!.push(a);
    }
    return out;
}

/**
 * Un adjunto de una solicitud de permiso: la fila de `c_archivos_solicitud_permiso` debe ser de ESA solicitud y la solicitud debe estar
 * activa. El archivo se pide con la misma ruta que `api/permit-request/[id]/get-file/[file]`: `permit-request/<solicitud>/<name>`.
 */
export async function cargarAdjuntoPermiso(db: any, recordId: number, attachmentId: string, fetchFile?: AttachmentFetcher) {
    const aid = Number(attachmentId);
    if (!Number.isInteger(recordId) || recordId <= 0 || !/^\d{1,10}$/.test(attachmentId) || !aid || !fetchFile) return null;
    const [sol] = await db.c_solicitud_permiso.findMany({
        where: { id: recordId, isActive: true },
        select: { id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true },
    });
    if (!sol) return null;
    const [arch] = await db.c_archivos_solicitud_permiso.findMany({ where: { id: aid, solicitud_id: recordId }, select: COLS_ARCHIVO });
    if (!arch || Number(arch.solicitud_id) !== recordId || Number(arch.id) !== aid || !txt(arch.name)) return null;
    const file = await fetchFile(`permit-request/${recordId}/${String(arch.name).trim()}`);
    if (!file) return null;
    return {
        bytes: file.bytes,
        contentType: mimeAdjunto(arch.extension, arch.type) ?? (txt(file.contentType) || "application/octet-stream"),
        nombre: nombreAdjunto(arch),
        hier: { empresa: sol.empresa_id, cliente: sol.cliente_id, division: sol.division_id, contrato: sol.contrato_id, corpo: sol.corpo_id, puesto: sol.puesto_id },
    };
}

export const solicitudesPermisoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Solo activas, como el módulo de lista. Una consulta por tabla (empleados, archivos y estructura en lote).
        const rows: any[] = await (db as any).c_solicitud_permiso.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const loc = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        // Los empleados de la solicitud y los reemplazos de los turnos van en la MISMA consulta a `c_empleado`.
        const reemplazoIds = rows.flatMap((r) => leerTurnos(r.turnos).map((t: any) => t?.reemplazo_id));
        const [empleados, ubic, divisiones, archivos] = await Promise.all([
            findByIds<any>(db as any, "c_empleado", [...rows.map((r) => r.empleado_id), ...reemplazoIds], { codigo: true, cedula: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
            ubicacionTextos(db as any, rows.map(loc)),
            // La división de la cabecera viene en 0 en registros viejos: entonces sale la del contrato.
            divisionPorContrato(db as any, rows.map((r) => r.contrato_id)),
            cargarArchivos(db, rows.map((r) => r.id)),
        ]);
        return rows.map((r) => {
            const u = ubic(loc(r));
            return armarRegistro({ ...r, c_empleado: empleados.get(Number(r.empleado_id)) }, { ...u, division: u.division ?? divisiones.get(Number(r.contrato_id)) ?? null }, firmas,
                { reemplazos: empleados, archivos: archivos.get(Number(r.id)) ?? [] });
        });
    },
    loadAttachment: (db, recordId, attachmentId, fetchFile) => cargarAdjuntoPermiso(db, recordId, attachmentId, fetchFile),
};
