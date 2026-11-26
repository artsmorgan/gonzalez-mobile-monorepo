/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Documentos (manuales de trabajo): versiones con histórico (#155), entrega a los empleados (#154) y asignaciones vigentes de Guardify (#157).
 * La lógica habla con la base a través de `Dyn` (una capa mínima sobre `callDynamicPrisma`) para poder probarla sin red.
 */
import { matchesScope, parseScope, type Hierarchy, type ScopeItem } from "../guardifyReports/scope";

export interface Dyn {
    find(table: string, args?: { where?: any; orderBy?: any; select?: any }): Promise<any[]>;
    create(table: string, data: Record<string, unknown>): Promise<any>;
    update(table: string, where: { id: number }, data: Record<string, unknown>): Promise<any>;
}

const unicos = (xs: unknown[]): number[] => [...new Set(xs.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
const CHUNK = 500;

async function findIn(dyn: Dyn, table: string, campo: string, ids: number[], extra: Record<string, unknown> = {}): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await dyn.find(table, { where: { ...extra, [campo]: { in: ids.slice(i, i + CHUNK) } } })));
    return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Versiones (#155)

export type ContenidoVersion = {
    title?: string | null;
    description?: string | null;
    classification?: string | null;
    quiz?: string | null;
    externoVersionId?: string | null;
    sello?: string | null;
    archivoSha256?: string | null;
    /** Número de versión; si no se manda es la siguiente a la vigente. Debe ser mayor que la vigente. */
    version?: number | null;
};

export type ArchivoNuevo = { name: string; type: string; original_name: string; extension: string; sha256?: string | null };

export type ResultadoVersion = { version: number; creada: boolean };

/** Archivos que aplican a una versión: los agregados en ella o antes y que no se retiraron todavía. */
export function archivosDeVersion<T extends { version?: number | null; retirado_en_version?: number | null }>(archivos: T[], version: number): T[] {
    return archivos.filter((a) => Number(a.version ?? 1) <= version && (a.retirado_en_version == null || Number(a.retirado_en_version) > version));
}

/**
 * Publica una versión nueva de un documento SIN borrar nada: guarda la vigente en `e_manual_puesto_version`, deja los datos nuevos en
 * `e_manual_puesto` con la versión subida, marca los archivos retirados y agrega los nuevos. Las firmas y notas de las versiones anteriores quedan
 * con su versión. Idempotente por `externoVersionId`: si esa versión ya está publicada, no hace nada.
 */
export async function publicarNuevaVersion(
    dyn: Dyn,
    manual: any,
    nuevo: ContenidoVersion & { publicadoPor?: string | null; ahoraIso: string; archivosNuevos?: ArchivoNuevo[]; archivosRetirar?: number[] },
): Promise<ResultadoVersion> {
    const actual = Number(manual.version ?? 1);
    if (nuevo.externoVersionId && manual.externo_version_id && String(manual.externo_version_id) === String(nuevo.externoVersionId)) {
        return { version: actual, creada: false };
    }
    const siguiente = nuevo.version != null ? Number(nuevo.version) : actual + 1;
    if (!Number.isInteger(siguiente) || siguiente <= actual) {
        throw new Error(`La versión nueva (${nuevo.version}) debe ser mayor que la vigente (${actual}).`);
    }

    // 1. El histórico conserva la versión vigente tal como estaba (una sola vez por versión).
    const yaGuardada = await dyn.find("e_manual_puesto_version", { where: { manual_puesto_id: manual.id, version: actual } });
    if (!yaGuardada.length) {
        await dyn.create("e_manual_puesto_version", {
            manual_puesto_id: manual.id,
            version: actual,
            title: manual.title ?? "",
            description: manual.description ?? "",
            classification: manual.classification ?? null,
            quiz: manual.quiz ?? null,
            externo_version_id: manual.externo_version_id ?? null,
            sello: manual.sello ?? null,
            archivo_sha256: manual.archivo_sha256 ?? null,
            publicado_por: manual.created_by != null ? String(manual.created_by).slice(0, 190) : null,
            publicado_en: manual.updated_at ?? manual.created_at ?? nuevo.ahoraIso,
        });
    }

    // 2. Los archivos retirados dejan de aplicar desde la versión nueva (no se borran).
    for (const id of unicos(nuevo.archivosRetirar ?? [])) await dyn.update("e_archivos_manual_puesto", { id }, { retirado_en_version: siguiente });

    // 3. Los archivos nuevos pertenecen a la versión nueva.
    for (const a of nuevo.archivosNuevos ?? []) {
        await dyn.create("e_archivos_manual_puesto", { ...a, sha256: a.sha256 ?? null, manual_puesto_id: manual.id, version: siguiente });
    }

    // 4. El documento vigente pasa a la versión nueva.
    await dyn.update("e_manual_puesto", { id: manual.id }, {
        version: siguiente,
        ...(nuevo.title != null ? { title: nuevo.title } : {}),
        ...(nuevo.description != null ? { description: nuevo.description } : {}),
        ...(nuevo.classification !== undefined ? { classification: nuevo.classification } : {}),
        ...(nuevo.quiz !== undefined ? { quiz: nuevo.quiz } : {}),
        ...(nuevo.externoVersionId !== undefined ? { externo_version_id: nuevo.externoVersionId } : {}),
        ...(nuevo.sello !== undefined ? { sello: nuevo.sello } : {}),
        ...(nuevo.archivoSha256 !== undefined ? { archivo_sha256: nuevo.archivoSha256 } : {}),
        updated_at: nuevo.ahoraIso,
    });
    return { version: siguiente, creada: true };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Asignaciones vigentes (#157)

export type Asignacion = { id?: number; manual_puesto_id: number; audience: string; scope?: string | null; vigente?: boolean | null };

/** ¿La asignación vigente alcanza a alguien con esta ubicación? `app_users` y `company` alcanzan a todos; `units` según los códigos de estructura. */
export function asignacionAplica(a: Asignacion, hier: Hierarchy): boolean {
    if (a.vigente === false) return false;
    const audience = String(a.audience ?? "").toLowerCase();
    if (audience === "company" || audience === "app_users") return true;
    if (audience !== "units") return false;
    let scope: ScopeItem[];
    try {
        scope = parseScope(String(a.scope ?? ""));
    } catch {
        return false;
    }
    return scope.length > 0 && matchesScope(hier, scope);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Entrega a los empleados (#154)

export type ResultadoEntrega = { creados: number; actualizados: number; manualIds: number[] };

/**
 * Entrega a un empleado los documentos que le corresponden: los de su puesto (vínculo o puesto principal del documento) y los de las asignaciones
 * vigentes que lo alcanzan. Crea el vínculo `e_empleados_manual_puesto` con la fecha de entrega; si ya lo tenía y el documento tiene una versión
 * nueva, actualiza la versión entregada y su fecha. No quita nada: un empleado que sale del puesto conserva sus vínculos y resultados.
 */
export async function entregarDocumentosPendientes(
    dyn: Dyn,
    p: { empleadoId: number; hier: Hierarchy; ahoraIso: string },
): Promise<ResultadoEntrega> {
    const origen = new Map<number, "puesto" | "asignacion">();
    const puestoId = Number(p.hier.puesto ?? 0);
    if (puestoId > 0) {
        for (const l of await dyn.find("e_puestos_manual_puesto", { where: { puesto_id: puestoId } })) origen.set(Number(l.manual_puesto_id), "puesto");
        for (const m of await dyn.find("e_manual_puesto", { where: { puesto_id: puestoId, isActive: true } })) origen.set(Number(m.id), "puesto");
    }
    for (const a of await dyn.find("e_documento_asignacion", { where: { vigente: true } })) {
        if (asignacionAplica(a, p.hier) && !origen.has(Number(a.manual_puesto_id))) origen.set(Number(a.manual_puesto_id), "asignacion");
    }
    const manualIds = unicos([...origen.keys()]);
    if (!manualIds.length) return { creados: 0, actualizados: 0, manualIds: [] };

    const manuales = (await findIn(dyn, "e_manual_puesto", "id", manualIds)).filter((m) => m.isActive !== false);
    const vigentes = new Map(manuales.map((m) => [Number(m.id), m]));
    const enlaces = await dyn.find("e_empleados_manual_puesto", { where: { empleado_id: p.empleadoId, manual_puesto_id: { in: manualIds } } });
    const porManual = new Map<number, any>(enlaces.map((e) => [Number(e.manual_puesto_id), e]));

    let creados = 0;
    let actualizados = 0;
    for (const [manualId, manual] of vigentes) {
        const version = Number(manual.version ?? 1);
        const enlace = porManual.get(manualId);
        if (!enlace) {
            await dyn.create("e_empleados_manual_puesto", { manual_puesto_id: manualId, empleado_id: p.empleadoId, created_at: p.ahoraIso, entregado_en: p.ahoraIso, version, origen: origen.get(manualId) ?? null });
            creados++;
        } else if (Number(enlace.version ?? 1) < version) {
            await dyn.update("e_empleados_manual_puesto", { id: Number(enlace.id) }, { version, entregado_en: p.ahoraIso });
            actualizados++;
        }
    }
    return { creados, actualizados, manualIds: [...vigentes.keys()] };
}

/** Entrega un documento (su versión vigente) a una lista de empleados; los que ya lo tienen en esa versión no se tocan. */
export async function entregarDocumentoAEmpleados(
    dyn: Dyn,
    p: { manual: any; empleadoIds: number[]; ahoraIso: string; origen: string },
): Promise<{ creados: number; actualizados: number }> {
    const ids = unicos(p.empleadoIds);
    const version = Number(p.manual.version ?? 1);
    const enlaces = ids.length ? await findIn(dyn, "e_empleados_manual_puesto", "empleado_id", ids, { manual_puesto_id: Number(p.manual.id) }) : [];
    const porEmpleado = new Map<number, any>(enlaces.map((e) => [Number(e.empleado_id), e]));
    let creados = 0;
    let actualizados = 0;
    for (const empleadoId of ids) {
        const e = porEmpleado.get(empleadoId);
        if (!e) {
            await dyn.create("e_empleados_manual_puesto", { manual_puesto_id: Number(p.manual.id), empleado_id: empleadoId, created_at: p.ahoraIso, entregado_en: p.ahoraIso, version, origen: p.origen });
            creados++;
        } else if (Number(e.version ?? 1) < version) {
            await dyn.update("e_empleados_manual_puesto", { id: Number(e.id) }, { version, entregado_en: p.ahoraIso });
            actualizados++;
        }
    }
    return { creados, actualizados };
}
