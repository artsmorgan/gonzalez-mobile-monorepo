/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Evidencia de cada acción guardada (issues #151, #152 y #153). Especificación completa en `docs/firma-digital-evidencia.md`.
 *
 * Cada alta o edición de un registro deja una fila de SOLO INSERCIÓN en `c_evidencia_registro` con: dispositivo, latitud, longitud, cédula,
 * usuario, sesión, fecha y hora de la acción y su FIRMA, que cubre todos esos datos más la tabla, el registro y la acción.
 *
 * La firma sigue el contrato compartido con Guardify (`docs/guardify/protocolo-reportes.md`, «Evidencia»): `firma` = SHA-256 (hex minúscula) del
 * JSON canónico del contenido firmado (llaves ordenadas en todos los niveles, sin espacios, UTF-8; `undefined` no cuenta y `null` sí). Así la
 * pantalla «Verificar firma» de Guardify puede recalcularla sin ninguna clave. Además, si el servidor tiene `EVIDENCE_SIGNING_KEY`, cada fila lleva un
 * `sello` (HMAC-SHA256 del mismo JSON con la clave del servidor): una huella pública se puede recalcular a mano, el sello no, y detecta una fila fabricada.
 *
 * - La **firma de captura** que la app ya genera (`firma_responsable` = base64 de `sesión:empleado:latitud:longitud:marcaDeTiempo`) NO cambia de
 *   formato: sigue siendo la fuente de la ubicación y la hora de la acción (por eso una acción hecha sin conexión conserva su ubicación original:
 *   la firma viaja dentro del registro en la cola). Aquí se le suman cédula y dispositivo y se sella con la clave del servidor.
 * - Sin firma de captura se usa la ubicación que la app manda en cabeceras (`X-Evidence-*`), con su hora.
 */
import crypto from "node:crypto";

export const FIRMA_VERSION = 1;

export type AccionEvidencia = "CREATE" | "UPDATE";
export type UbicacionOrigen = "firma" | "cabecera" | "denegada" | "sin_datos";

/** Campos que entran en la firma, en este orden (ver la especificación). `null` se firma como cadena vacía. */
export type CamposFirmados = {
    tabla: string;
    registroId: number;
    accion: AccionEvidencia;
    cedula: string | null;
    usuarioId: number | null;
    sesionId: string | null;
    latitud: string | null;
    longitud: string | null;
    dispositivo: string | null;
    /** Hora de la acción como `AAAA-MM-DDTHH:mm:ss` (hora de reloj de Costa Rica). */
    capturadoEn: string;
};

const aTexto = (v: unknown): string | null => {
    const t = String(v ?? "").trim();
    return t ? t : null;
};

/** Coordenada guardada como texto → número (el contenido firmado y las columnas de los reportes la llevan como número). */
const aNumero = (v: string | null): number | null => {
    if (v == null || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** JSON canónico del contrato de Guardify: llaves ordenadas alfabéticamente en todos los niveles, sin espacios; `undefined` se omite y `null` se conserva. */
export function jsonCanonico(valor: unknown): string {
    const normalizar = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : normalizar(x)));
        if (v && typeof v === "object") {
            const out: Record<string, unknown> = {};
            for (const k of Object.keys(v as object).sort()) {
                const x = (v as Record<string, unknown>)[k];
                if (x !== undefined) out[k] = normalizar(x);
            }
            return out;
        }
        return v;
    };
    return JSON.stringify(normalizar(valor));
}

/**
 * El contenido que se firma. Es el mismo objeto que se entrega a Guardify (`evidencia.contenido`) para que recalcule la huella:
 * `{ accion, cedula, dispositivo, fecha, latitud, longitud, registro_id, sesion_id, tabla, usuario_id }`.
 */
export function contenidoFirmado(c: CamposFirmados): Record<string, unknown> {
    return {
        accion: c.accion,
        cedula: aTexto(c.cedula),
        dispositivo: aTexto(c.dispositivo),
        fecha: c.capturadoEn,
        latitud: aNumero(c.latitud),
        longitud: aNumero(c.longitud),
        registro_id: c.registroId,
        sesion_id: aTexto(c.sesionId),
        tabla: c.tabla,
        usuario_id: c.usuarioId == null ? null : Number(c.usuarioId),
    };
}

/** Huella del contrato de Guardify: SHA-256 (hex) del JSON canónico del contenido. */
export function huellaSha256(contenido: unknown): string {
    return crypto.createHash("sha256").update(jsonCanonico(contenido), "utf8").digest("hex");
}

export type ClaveFirma = { kid: string; secreto: string };
export type LlaveroFirma = { actual: ClaveFirma; anteriores: ClaveFirma[] };

/**
 * Clave del sello desde el entorno: `EVIDENCE_SIGNING_KEY` (mínimo 24 caracteres) con id `EVIDENCE_SIGNING_KEY_ID` (por defecto `k1`).
 * Rotación: la clave anterior pasa a `EVIDENCE_SIGNING_KEYS_OLD` como `kid:secreto,kid2:secreto2` para seguir verificando lo ya sellado.
 * Sin clave la evidencia se registra igual, solo con la huella (el sello queda vacío).
 */
export function llaveroDesdeEntorno(env: Record<string, string | undefined> = process.env): LlaveroFirma | null {
    const secreto = String(env.EVIDENCE_SIGNING_KEY ?? "").trim();
    if (secreto.length < 24) return null;
    const kid = String(env.EVIDENCE_SIGNING_KEY_ID ?? "k1").trim() || "k1";
    const anteriores = String(env.EVIDENCE_SIGNING_KEYS_OLD ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
            const i = p.indexOf(":");
            return i > 0 ? { kid: p.slice(0, i).trim(), secreto: p.slice(i + 1).trim() } : null;
        })
        .filter((k): k is ClaveFirma => !!k && k.secreto.length > 0);
    return { actual: { kid, secreto }, anteriores };
}

const hmac = (secreto: string, texto: string) => crypto.createHmac("sha256", secreto).update(texto, "utf8").digest("hex");

/** Firma un registro: la huella del contrato (siempre) y el sello con la clave del servidor (si hay clave). */
export function firmarRegistro(campos: CamposFirmados, llavero: LlaveroFirma | null): { firma: string; sello: string | null; version: number; kid: string | null } {
    const json = jsonCanonico(contenidoFirmado(campos));
    return {
        firma: crypto.createHash("sha256").update(json, "utf8").digest("hex"),
        sello: llavero ? hmac(llavero.actual.secreto, json) : null,
        version: FIRMA_VERSION,
        kid: llavero ? llavero.actual.kid : null,
    };
}

const igualesHex = (a: string, b: string): boolean => {
    try {
        const x = Buffer.from(String(a), "hex"), y = Buffer.from(String(b), "hex");
        return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
    } catch {
        return false;
    }
};

export type ResultadoVerificacion = {
    /** La huella coincide con el contenido (lo que recalcula Guardify). */
    firma: boolean;
    /** El sello coincide (solo el servidor puede calcularlo); null si la fila no tiene sello o no hay clave para comprobarlo. */
    sello: boolean | null;
};

/** Verifica una fila: recalcula la huella del contenido y, si hay sello y la clave de su `kid`, también el sello. Compara en tiempo constante. */
export function verificarFirma(campos: CamposFirmados, guardada: { firma: string; sello?: string | null; kid?: string | null }, llavero: LlaveroFirma | null): ResultadoVerificacion {
    const json = jsonCanonico(contenidoFirmado(campos));
    const firma = igualesHex(crypto.createHash("sha256").update(json, "utf8").digest("hex"), guardada.firma);
    let sello: boolean | null = null;
    if (guardada.sello) {
        const clave = llavero ? [llavero.actual, ...llavero.anteriores].find((k) => k.kid === guardada.kid) : undefined;
        sello = clave ? igualesHex(hmac(clave.secreto, json), guardada.sello) : null;
    }
    return { firma, sello };
}

export type FirmaCaptura = { sessionId: string; empleadoId: string; latitud: string; longitud: string; timestamp: number };

/** Lee la firma de captura que genera la app (`base64(sesión:empleado:latitud:longitud:marcaDeTiempo)`); null si no tiene ese formato. */
export function decodificarFirmaCaptura(raw: unknown): FirmaCaptura | null {
    try {
        const text = String(raw ?? "").trim();
        if (!text) return null;
        const parts = Buffer.from(text, "base64").toString("utf8").split(":");
        if (parts.length !== 5) return null;
        const [sessionId, empleadoId, latitud, longitud, ts] = parts as [string, string, string, string, string];
        const timestamp = Number(ts);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
        return { sessionId, empleadoId, latitud, longitud, timestamp };
    } catch {
        return null;
    }
}

const coordValida = (v: unknown, max: number): string | null => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && Math.abs(n) <= max ? s : null;
};

const isoNaive = (ms: number): string => new Date(ms).toISOString().slice(0, 19);
/**
 * Fecha para el servicio dinámico (Prisma `DateTime` exige zona: «…:44Z»). Es la misma hora «naive» de Costa Rica guardada como UTC, igual que
 * el resto de la app; la firma sigue calculándose con el texto sin zona (`camposDeFila` lo reconstruye al verificar).
 */
const paraBase = (naive: string): string => (/[zZ]|[+-]\d{2}:?\d{2}$/.test(naive) ? naive : `${naive}Z`);

export type ContextoEvidencia = {
    /** Cabeceras de la petición (minúsculas): `x-guardify-device`, `x-device-uid`, `x-evidence-lat`, `x-evidence-lng`, `x-evidence-at`, `x-evidence-perm`. */
    headers: Record<string, string | undefined>;
    /** Datos del token de sesión (sin verificar de nuevo: la ruta ya lo autenticó): `id`, `cedula`, `sessionId`, `gdev`. */
    actor: { id?: unknown; cedula?: unknown; sessionId?: unknown; gdev?: unknown } | null;
    /** Datos que se están guardando en la tabla (de ahí sale `firma_responsable`). */
    datos: Record<string, unknown> | null;
    /** Hora de reloj de CR «ahora» (ms) para cuando la acción no trae hora propia. */
    ahoraMs: number;
};

export type EvidenciaConstruida = CamposFirmados & { ubicacionOrigen: UbicacionOrigen };

/**
 * Arma los campos de la evidencia de una acción. Orden de las fuentes: firma de captura del registro → cabeceras de la app → sin datos.
 * El permiso de ubicación negado (`x-evidence-perm: denied`) deja la ubicación vacía y marcada, pero la acción se guarda igual.
 */
export function construirEvidencia(base: { tabla: string; registroId: number; accion: AccionEvidencia }, ctx: ContextoEvidencia): EvidenciaConstruida | null {
    const firma = decodificarFirmaCaptura(ctx.datos?.firma_responsable);
    const h = ctx.headers;
    const actorId = Number(ctx.actor?.id);
    const usuarioFirma = firma ? Number(firma.empleadoId) : NaN;
    const usuarioId = Number.isFinite(usuarioFirma) && usuarioFirma > 0 ? usuarioFirma : Number.isFinite(actorId) && actorId > 0 ? actorId : null;
    // El equipo tal como lo ve Guardify (su id); sin registrar todavía, el UUID de la instalación.
    const dispositivo = String(h["x-guardify-device"] || h["x-device-uid"] || ctx.actor?.gdev || "").trim() || null;

    let latitud: string | null = null;
    let longitud: string | null = null;
    let origen: UbicacionOrigen = "sin_datos";
    let capturadoMs = ctx.ahoraMs;

    const firmaLat = firma ? coordValida(firma.latitud, 90) : null;
    const firmaLng = firma ? coordValida(firma.longitud, 180) : null;
    if (firma && firmaLat && firmaLng) {
        latitud = firmaLat;
        longitud = firmaLng;
        origen = "firma";
        capturadoMs = firma.timestamp;
    } else {
        const hLat = coordValida(h["x-evidence-lat"], 90);
        const hLng = coordValida(h["x-evidence-lng"], 180);
        const hAt = Number(h["x-evidence-at"]);
        if (Number.isFinite(hAt) && hAt > 0) capturadoMs = hAt;
        if (hLat && hLng) {
            latitud = hLat;
            longitud = hLng;
            origen = "cabecera";
        } else if (String(h["x-evidence-perm"] ?? "").toLowerCase() === "denied") {
            origen = "denegada";
        }
    }
    if (firma && origen !== "firma") capturadoMs = firma.timestamp;

    if (usuarioId == null && !dispositivo && origen === "sin_datos") return null; // sin ningún dato de quién ni desde dónde: no hay evidencia que guardar

    return {
        ...base,
        cedula: String(ctx.actor?.cedula ?? "").trim() || null,
        usuarioId,
        sesionId: (firma?.sessionId || String(ctx.actor?.sessionId ?? "").trim()) || null,
        latitud,
        longitud,
        dispositivo,
        capturadoEn: isoNaive(capturadoMs),
        ubicacionOrigen: origen,
    };
}

/** Hora de reloj de Costa Rica «ahora» como milisegundos UTC (mismo convenio que `getHoraAccion`). */
export function ahoraCostaRicaMs(): number {
    // Costa Rica es UTC-6 todo el año (sin horario de verano). Se calcula con el instante real y no con `toZonedTime(...).getTime()`, que solo da la
    // hora de CR «como UTC» si el proceso corre en UTC: en un equipo con otra zona (p. ej. un servidor de desarrollo en UTC-6) se desplazaría 6 h.
    return Date.now() - 6 * 60 * 60 * 1000;
}

export type FilaEvidencia = {
    tabla: string;
    registro_id: number;
    accion: AccionEvidencia;
    dispositivo_id: string | null;
    latitud: string | null;
    longitud: string | null;
    ubicacion_origen: UbicacionOrigen;
    capturado_en: string;
    cedula: string | null;
    usuario_id: number | null;
    sesion_id: string | null;
    firma: string;
    /** HMAC del contenido con la clave del servidor (null si no había clave configurada). */
    sello: string | null;
    firma_version: number;
    firma_kid: string | null;
    creado: string;
};

/** Fila lista para insertar: los campos más la firma. */
export function filaDeEvidencia(e: EvidenciaConstruida, llavero: LlaveroFirma | null, ahoraMs: number): FilaEvidencia {
    const { firma, sello, version, kid } = firmarRegistro(e, llavero);
    return {
        tabla: e.tabla,
        registro_id: e.registroId,
        accion: e.accion,
        dispositivo_id: e.dispositivo,
        latitud: e.latitud,
        longitud: e.longitud,
        ubicacion_origen: e.ubicacionOrigen,
        capturado_en: paraBase(e.capturadoEn),
        cedula: e.cedula,
        usuario_id: e.usuarioId,
        sesion_id: e.sesionId,
        firma,
        sello,
        firma_version: version,
        firma_kid: kid,
        creado: paraBase(isoNaive(ahoraMs)),
    };
}

/** Los campos firmados que se reconstruyen desde una fila guardada (para verificarla). */
export function camposDeFila(f: Omit<Pick<FilaEvidencia, "tabla" | "registro_id" | "accion" | "cedula" | "usuario_id" | "sesion_id" | "latitud" | "longitud" | "dispositivo_id" | "capturado_en">, "capturado_en"> & { capturado_en: string | Date }): CamposFirmados {
    return {
        tabla: f.tabla,
        registroId: Number(f.registro_id),
        accion: f.accion,
        cedula: f.cedula,
        usuarioId: f.usuario_id == null ? null : Number(f.usuario_id),
        sesionId: f.sesion_id,
        latitud: f.latitud,
        longitud: f.longitud,
        dispositivo: f.dispositivo_id,
        capturadoEn: f.capturado_en instanceof Date ? isoNaive(f.capturado_en.getTime()) : String(f.capturado_en).slice(0, 19),
    };
}

/**
 * Tablas del servicio dinámico cuyas altas y ediciones dejan evidencia (los ~30 módulos con auditoría propia).
 * Las de Planillas (`c_accion_personal`, `v_vacacion_solicitud`, artículos del puesto) no se alteran: su evidencia va solo en la tabla central.
 */
export const TABLAS_CON_EVIDENCIA: ReadonlySet<string> = new Set([
    "c_acta_entre_producto", "e_actividades", "c_agenda_minuta", "c_apertura_cierre_puesto", "c_boleta_apreciacion_vulnerabilidad",
    "c_puesto_notas", "c_ubicacion_puesto_registro_cambios", "c_checklist_supervision", "c_control_asistencia", "e_control_documento_entregado_cliente",
    "c_encuesta_cliente", "e_registro_entrega_puesto", "c_evaluacion_empleado", "c_incidente", "e_llave", "e_llavero", "c_maestro_quejas",
    "c_articulo_mantenimiento", "e_manual_puesto", "e_mutuos_acuerdos", "c_notas_voz", "c_producto_no_conforme", "e_registro_capacitaciones",
    "c_registro_induccion_general", "c_registro_induccion_recorrido", "c_vehiculos_corporativos", "e_registro_personas",
    "c_bitacora_vehiculo_detenido", "c_solicitud_permiso", "c_empleado_almuerzo", "e_registro_vehiculos",
]);

export type RegistroEvidenciaParams = {
    tabla: string;
    action: string;
    operation?: string;
    where?: unknown;
    data?: Record<string, unknown> | null;
    resultado: unknown;
    headers: Record<string, string | undefined>;
    actor: ContextoEvidencia["actor"];
    escribir: (fila: FilaEvidencia) => Promise<void>;
    /** Clave del sello; null = sin sello (la huella se calcula igual). */
    llavero: LlaveroFirma | null;
    ahoraMs?: number;
    onError?: (e: unknown) => void;
};

/** Id del registro afectado: el devuelto por el alta/edición o, si no, el `where.id` numérico. */
export function idDelRegistro(params: Pick<RegistroEvidenciaParams, "resultado" | "where">): number | null {
    const r = Number((params.resultado as any)?.id);
    if (Number.isInteger(r) && r > 0) return r;
    const w = Number((params.where as any)?.id);
    return Number.isInteger(w) && w > 0 ? w : null;
}

/**
 * Registra la evidencia de un alta (POST create) o edición (UPDATE) en una tabla con evidencia. NUNCA lanza: si falla, la acción del usuario
 * ya se guardó y solo se avisa por `onError`. Sin clave de sello (`EVIDENCE_SIGNING_KEY`) registra igual, solo con la huella.
 */
export async function registrarEvidencia(p: RegistroEvidenciaParams): Promise<boolean> {
    try {
        if (!TABLAS_CON_EVIDENCIA.has(p.tabla)) return false;
        const action = String(p.action).toUpperCase();
        const operation = String(p.operation ?? "");
        let accion: AccionEvidencia;
        if (action === "POST" && operation !== "createMany") accion = "CREATE";
        else if (action === "UPDATE" && operation !== "updateMany" && operation !== "deleteMany") accion = "UPDATE";
        else if (action === "UPDATE" && operation === "updateMany" && Number.isInteger(Number((p.where as any)?.id))) accion = "UPDATE";
        else return false;
        const registroId = idDelRegistro(p);
        if (!registroId) return false;
        const ahora = p.ahoraMs ?? ahoraCostaRicaMs();
        const evid = construirEvidencia({ tabla: p.tabla, registroId, accion }, { headers: p.headers, actor: p.actor, datos: p.data ?? null, ahoraMs: ahora });
        if (!evid) return false;
        await p.escribir(filaDeEvidencia(evid, p.llavero, ahora));
        return true;
    } catch (e) {
        p.onError?.(e);
        return false;
    }
}
