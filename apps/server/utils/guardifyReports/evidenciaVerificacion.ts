/**
 * Verificación de la firma de la evidencia para Guardify (issue #151): dado un registro (tabla + id), devuelve cada fila de evidencia con el
 * `contenido` firmado (para que la pantalla «Verificar firma» de Guardify recalcule la huella SHA-256) y `valida` (si la huella, y el sello cuando
 * se puede comprobar, coinciden con los campos guardados).
 *
 *   GET /api/guardify/evidence?tabla=<tabla>&registro_id=<id>   → { rows: [{ id, accion, ..., valida }] }
 * Misma llave que la API de reportes (`GUARDIFY_REPORTS_API_KEY`). Las filas llegan de la más reciente a la más antigua.
 */
import { camposDeFila, contenidoFirmado, llaveroDesdeEntorno, verificarFirma, type FilaEvidencia, type LlaveroFirma } from "../evidencia";
import { verifyGuardifyApiKey } from "./auth";

type Env = Record<string, string | undefined>;

export type FilaVerificada = {
    id: number;
    accion: string;
    dispositivo: string | null;
    latitud: number | null;
    longitud: number | null;
    ubicacion_origen: string;
    capturado_en: string;
    cedula: string | null;
    usuario_id: number | null;
    sesion_id: string | null;
    /** Huella SHA-256 del `contenido` (contrato de Guardify). */
    firma: string;
    /** El contenido que se firmó, tal cual: Guardify recalcula la huella con él. */
    contenido: Record<string, unknown>;
    /** HMAC con la clave del servidor (null si la fila se registró sin clave). */
    sello: string | null;
    firma_kid: string | null;
    /** La huella coincide con el contenido. */
    firma_ok: boolean;
    /** El sello coincide; null si no hay sello o falta la clave para comprobarlo. */
    sello_ok: boolean | null;
    /** true = todo lo comprobable coincide; false = la fila fue alterada o fabricada. */
    valida: boolean;
};

const num = (v: unknown): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export function verificarFilas(rows: any[], llavero: LlaveroFirma | null): FilaVerificada[] {
    return rows.map((r) => {
        const campos = camposDeFila(r as FilaEvidencia);
        const v = verificarFirma(campos, { firma: String(r.firma), sello: r.sello ?? null, kid: r.firma_kid ?? null }, llavero);
        return {
        id: Number(r.id),
        accion: String(r.accion),
        dispositivo: r.dispositivo_id ?? null,
        latitud: num(r.latitud),
        longitud: num(r.longitud),
        ubicacion_origen: String(r.ubicacion_origen),
        capturado_en: r.capturado_en instanceof Date ? r.capturado_en.toISOString().slice(0, 19) : String(r.capturado_en).slice(0, 19),
        cedula: r.cedula ?? null,
        usuario_id: r.usuario_id == null ? null : Number(r.usuario_id),
        sesion_id: r.sesion_id ?? null,
        firma: String(r.firma),
        contenido: contenidoFirmado(campos),
        sello: r.sello ?? null,
        firma_kid: r.firma_kid ?? null,
        firma_ok: v.firma,
        sello_ok: v.sello,
        valida: v.firma && v.sello !== false,
        };
    });
}

export async function handleEvidenceVerification(
    req: Request,
    deps: { db: { c_evidencia_registro: { findMany: (args: any) => Promise<any[]> } }; env?: Env },
): Promise<Response> {
    const env = deps.env ?? process.env;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const auth = verifyGuardifyApiKey(req.headers, env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);

    const sp = new URL(req.url).searchParams;
    const tabla = String(sp.get("tabla") ?? "").trim();
    const registroId = Number(sp.get("registro_id"));
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(tabla) || !Number.isInteger(registroId) || registroId <= 0) {
        return json({ error: "bad_request", message: "Indica «tabla» y «registro_id»." }, 400);
    }
    try {
        const rows = await deps.db.c_evidencia_registro.findMany({ where: { tabla, registro_id: registroId }, orderBy: { id: "desc" }, take: 200 });
        return json({ rows: verificarFilas(rows, llaveroDesdeEntorno(env)) });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_evidence_failed", error: String(e) }));
        return json({ error: "internal", message: "No se pudo leer la evidencia." }, 500);
    }
}
