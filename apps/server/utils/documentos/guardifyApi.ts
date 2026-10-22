/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API de documentos para Guardify (issue #157). Contrato: `docs/guardify/protocolo-documentos.md` (misma llave que los reportes, `GUARDIFY_REPORTS_API_KEY`).
 *
 *   POST /api/guardify/documents                        multipart: meta (JSON) + file                    → 201 { id }
 *   POST /api/guardify/documents/preview                { audience, scope }                              → 200 { recipients }
 *   POST /api/guardify/documents/dispatches             { documentId, versionId, externalVersionId, version, audience, scope, standing, requestedBy } → 201 { id, recipients }
 *   POST /api/guardify/documents/dispatches/{id}/end    { endedBy }                                      → 200 { ok: true }
 *
 * El documento vive en `e_manual_puesto` (el mismo almacén de los manuales de la app); cada versión nueva se guarda con su histórico. Una asignación
 * es una REGLA vigente (`e_documento_asignacion`): quien entre después al puesto o a la empresa recibe el documento al marcar su ingreso.
 */
import crypto from "node:crypto";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import { loadPuestoHierarchy, matchesScope, parseScope, type ScopeItem } from "../guardifyReports/scope";
import { asignadosPorPuesto } from "../guardifyReports/modules/manualesAsignados";
import { verifyGuardifyApiKey } from "../guardifyReports/auth";
import { entregarDocumentoAEmpleados, publicarNuevaVersion, type Dyn } from "./service";

export const MAX_ARCHIVO_BYTES = 50 * 1024 * 1024;

export type SubirArchivo = (carpeta: string, archivo: { file_base64: string; original_name: string; extension: string; type: string }) => Promise<{ name: string; original_name: string; extension: string; type: string }>;

export type DocDeps = {
    dyn: Dyn;
    /** Lectura de la estructura y de las plazas (Planillas, solo lectura). */
    db: ReportDataAccess;
    subir: SubirArchivo;
    env?: Record<string, string | undefined>;
    ahoraIso?: () => string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const AUDIENCES = ["units", "app_users", "company"] as const;
type Audience = (typeof AUDIENCES)[number];

function autenticar(req: Request, deps: DocDeps): { ok: true; user: string | null } | { ok: false; res: Response } {
    const a = verifyGuardifyApiKey(req.headers, deps.env ?? process.env);
    return a.ok ? { ok: true, user: a.user } : { ok: false, res: json({ error: a.error, message: a.message }, a.status) };
}

const ahora = (deps: DocDeps) => (deps.ahoraIso ? deps.ahoraIso() : new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

// ---------------------------------------------------------------------------------------------------------------------------------
// Destinatarios

export type Destinatarios = { puestoIds: number[]; empleadoIds: number[] };

/** Puestos y empleados que alcanza una audiencia. Un código de estructura cubre todo lo que cuelga de esa unidad. */
export async function resolverDestinatarios(db: ReportDataAccess, audience: Audience, scope: ScopeItem[]): Promise<Destinatarios> {
    const todos = await (db as any).e_estructura_puesto.findMany({ where: { deleted: null }, select: { id: true } });
    const todosIds = todos.map((p: any) => Number(p.id)).filter((n: number) => n > 0);
    let puestoIds = todosIds;
    if (audience === "units") {
        const hier = await loadPuestoHierarchy(db as any, todosIds);
        puestoIds = todosIds.filter((id: number) => {
            const h = hier.get(id);
            return !!h && matchesScope(h, scope);
        });
    }
    const porPuesto = await asignadosPorPuesto(db, puestoIds);
    const empleados = new Set<number>();
    for (const ids of porPuesto.values()) for (const e of ids) empleados.add(e);
    return { puestoIds, empleadoIds: [...empleados] };
}

function leerAudiencia(body: any): { audience: Audience; scope: ScopeItem[]; scopeTexto: string } | { error: string } {
    const audience = String(body?.audience ?? "").trim().toLowerCase() as Audience;
    if (!AUDIENCES.includes(audience)) return { error: "audience debe ser units, app_users o company." };
    const scopeTexto = String(body?.scope ?? "").trim();
    if (audience === "units") {
        if (!scopeTexto) return { error: "scope es obligatorio para units." };
        try {
            return { audience, scope: parseScope(scopeTexto), scopeTexto };
        } catch (e) {
            return { error: e instanceof Error ? e.message : "scope inválido." };
        }
    }
    return { audience, scope: [], scopeTexto: "" };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// POST /documents

export async function handlePublicarDocumento(req: Request, deps: DocDeps): Promise<Response> {
    const auth = autenticar(req, deps);
    if (!auth.ok) return auth.res;
    let meta: any;
    let archivo: File | null = null;
    try {
        const form = (await req.formData()) as unknown as { get(k: string): unknown };
        meta = JSON.parse(String(form.get("meta") ?? ""));
        const f = form.get("file");
        archivo = f && typeof f === "object" && "arrayBuffer" in f ? (f as File) : null;
    } catch {
        return json({ message: "Se espera multipart con «meta» (JSON) y «file»." }, 400);
    }
    const documentId = txt(meta?.documentId), versionId = txt(meta?.versionId), titulo = txt(meta?.title);
    const version = Number(meta?.version ?? 1);
    if (!documentId || !versionId || !titulo || !archivo || !Number.isInteger(version) || version < 1) {
        return json({ message: "Faltan documentId, versionId, title, version o el archivo." }, 422);
    }
    if (archivo.size > MAX_ARCHIVO_BYTES) return json({ message: "El archivo supera el máximo de 50 MB." }, 422);
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    const shaMeta = txt(meta?.sha256)?.toLowerCase();
    if (shaMeta && shaMeta !== sha) return json({ message: "La huella SHA-256 del archivo no coincide con la indicada." }, 422);

    const nombre = txt(meta?.fileName) ?? archivo.name ?? "documento";
    const extension = (nombre.includes(".") ? nombre.split(".").pop()! : "bin").toLowerCase().slice(0, 20);
    const sello = txt(meta?.seal);
    const publicadoPor = txt(meta?.publishedBy) ?? auth.user;
    const ahoraIso = ahora(deps);
    const nuevoArchivo = async (manualId: number, versionDelArchivo: number) => {
        const sub = await deps.subir(`job-manuals/${manualId}`, { file_base64: bytes.toString("base64"), original_name: nombre, extension, type: "document" });
        return { name: sub.name, type: sub.type || "document", original_name: sub.original_name || nombre, extension: sub.extension || extension, sha256: sha, version: versionDelArchivo };
    };

    try {
        const existentes = await deps.dyn.find("e_manual_puesto", { where: { externo_documento_id: documentId } });
        const manual = existentes[0];
        if (!manual) {
            // Se crea apagado, se sube el archivo y solo entonces se activa: un fallo a medias no deja un documento sin archivo a la vista.
            const creado = await deps.dyn.create("e_manual_puesto", {
                title: titulo, description: txt(meta?.description) ?? "", classification: null, firma: sello ?? "", puesto_id: 0, created_by: (publicadoPor ?? "guardify").slice(0, 190),
                created_at: ahoraIso, quiz: null, empresa_id: 0, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0, isActive: false,
                version, externo_documento_id: documentId, externo_version_id: versionId, sello, archivo_sha256: sha,
            });
            const fila = await nuevoArchivo(Number(creado.id), version);
            await deps.dyn.create("e_archivos_manual_puesto", { ...fila, manual_puesto_id: Number(creado.id) });
            await deps.dyn.update("e_manual_puesto", { id: Number(creado.id) }, { isActive: true });
            return json({ id: Number(creado.id) }, 201);
        }
        if (String(manual.externo_version_id ?? "") === versionId) return json({ id: Number(manual.id) }, 201); // reintento de la misma versión
        const archivos = await deps.dyn.find("e_archivos_manual_puesto", { where: { manual_puesto_id: manual.id } });
        const vigentes = archivos.filter((a: any) => a.retirado_en_version == null).map((a: any) => Number(a.id));
        const fila = await nuevoArchivo(Number(manual.id), version);
        const { sha256: _s, version: _v, ...archivoSinVersion } = fila;
        await publicarNuevaVersion(deps.dyn, manual, {
            title: titulo, description: txt(meta?.description) ?? manual.description, externoVersionId: versionId, sello, archivoSha256: sha, version,
            publicadoPor, ahoraIso, archivosRetirar: vigentes, archivosNuevos: [{ ...archivoSinVersion, sha256: sha }],
        });
        await deps.dyn.update("e_manual_puesto", { id: Number(manual.id) }, { isActive: true, firma: sello ?? manual.firma });
        return json({ id: Number(manual.id) }, 201);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Una versión que no es mayor que la vigente es un conflicto, no una falla de la app.
        return json({ message }, /mayor que la vigente/.test(message) ? 409 : 500);
    }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// POST /documents/preview

export async function handleVistaPreviaDocumento(req: Request, deps: DocDeps): Promise<Response> {
    const auth = autenticar(req, deps);
    if (!auth.ok) return auth.res;
    const body = await req.json().catch(() => null);
    const aud = leerAudiencia(body);
    if ("error" in aud) return json({ message: aud.error }, 422);
    try {
        const d = await resolverDestinatarios(deps.db, aud.audience, aud.scope);
        return json({ recipients: d.empleadoIds.length });
    } catch (e) {
        return json({ message: e instanceof Error ? e.message : String(e) }, 500);
    }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// POST /documents/dispatches  y  /dispatches/{id}/end

export async function handleEnviarDocumento(req: Request, deps: DocDeps): Promise<Response> {
    const auth = autenticar(req, deps);
    if (!auth.ok) return auth.res;
    const body = await req.json().catch(() => null);
    const documentId = txt(body?.documentId);
    if (!documentId) return json({ message: "Falta documentId." }, 422);
    const aud = leerAudiencia(body);
    if ("error" in aud) return json({ message: aud.error }, 422);
    try {
        const manual = (await deps.dyn.find("e_manual_puesto", { where: { externo_documento_id: documentId } }))[0];
        if (!manual) return json({ message: "El documento no está publicado en la app." }, 409);
        const externalVersionId = txt(body?.externalVersionId);
        if (externalVersionId && String(manual.externo_version_id ?? "") !== externalVersionId) {
            return json({ message: "La versión indicada no es la vigente en la app." }, 409);
        }
        const ahoraIso = ahora(deps);
        const dest = await resolverDestinatarios(deps.db, aud.audience, aud.scope);
        const por = txt(body?.requestedBy?.email) ?? txt(body?.requestedBy?.name) ?? auth.user;

        // Regla vigente (si Guardify la pide así): quien entre después al grupo la recibe al marcar su ingreso.
        const vigente = body?.standing !== false;
        const asignacion = await deps.dyn.create("e_documento_asignacion", {
            manual_puesto_id: Number(manual.id), externo_envio_id: null, audience: aud.audience, scope: aud.scopeTexto || null,
            vigente, solicitado_por: por ? por.slice(0, 190) : null, creado_en: ahoraIso,
        });

        // Para los puestos alcanzados, el documento queda vinculado al puesto (así se lista y la lista de la app lo ve por puesto).
        if (aud.audience === "units" && dest.puestoIds.length) {
            const yaVinculados = new Set<number>((await deps.dyn.find("e_puestos_manual_puesto", { where: { manual_puesto_id: Number(manual.id) } })).map((l: any) => Number(l.puesto_id)));
            for (const puestoId of dest.puestoIds) if (!yaVinculados.has(puestoId)) await deps.dyn.create("e_puestos_manual_puesto", { manual_puesto_id: Number(manual.id), puesto_id: puestoId });
        }
        await entregarDocumentoAEmpleados(deps.dyn, { manual, empleadoIds: dest.empleadoIds, ahoraIso, origen: "guardify" });
        return json({ id: String(asignacion.id), recipients: dest.empleadoIds.length }, 201);
    } catch (e) {
        return json({ message: e instanceof Error ? e.message : String(e) }, 500);
    }
}

export async function handleTerminarAsignacion(req: Request, id: string, deps: DocDeps): Promise<Response> {
    const auth = autenticar(req, deps);
    if (!auth.ok) return auth.res;
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero <= 0) return json({ message: "Asignación inválida." }, 404);
    const body = await req.json().catch(() => null);
    try {
        const asignacion = (await deps.dyn.find("e_documento_asignacion", { where: { id: numero } }))[0];
        if (!asignacion) return json({ message: "No existe esa asignación." }, 404);
        // Terminar deja de asignar a quien entre después; lo ya entregado y los resultados se conservan.
        if (asignacion.vigente !== false) {
            const por = txt(body?.endedBy?.email) ?? txt(body?.endedBy?.name) ?? auth.user;
            await deps.dyn.update("e_documento_asignacion", { id: numero }, { vigente: false, terminado_en: ahora(deps), terminado_por: por ? por.slice(0, 190) : null });
        }
        return json({ ok: true });
    } catch (e) {
        return json({ message: e instanceof Error ? e.message : String(e) }, 500);
    }
}
