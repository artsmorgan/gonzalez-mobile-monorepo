import { ahoraCostaRicaMs, filaDeEvidencia, llaveroDesdeEntorno, type EvidenciaConstruida, type LlaveroFirma } from "../evidencia";
import type { ActionEnv } from "./env";

/**
 * Evidencia de una acción pedida desde Guardify (issue #193). Aprobar, rechazar o cargar desde la consola deja la MISMA fila de `c_evidencia_registro` que
 * deja la acción hecha desde el teléfono, para que toda acción tenga evidencia consultable (reportes con columnas de evidencia, #153 y #166):
 *   - `ubicacion_origen = "guardify"` (el origen);
 *   - `usuario_id` y `cedula` del actor ya resuelto a una persona de la app;
 *   - `sesion_id` = SHA-256 de la firma de la petición (`x-guardify-actor-sig`): la huella de lo que Guardify firmó (método, ruta, consulta y cuerpo);
 *   - sin datos de dispositivo ni ubicación (quedan null; Guardify muestra «-»).
 *
 * Si no se puede escribir la evidencia NO se revierte la acción (ya se aplicó, p. ej. en Planillas, y deshacerla no es seguro): se reintenta una vez,
 * se deja el error en `error_logs` con lo necesario para reconstruir la fila y la respuesta lo dice (`evidencia: "pendiente"`). El rastro de bitácora
 * (`c_cambios_apps_modules`) no se pierde.
 */
export type EvidenciaAccionParams = {
    tabla: string;
    /** Registros afectados: uno en aprobar/rechazar; un puesto por cada puesto que recibió algo en la carga. */
    registroIds: number[];
    usuarioId: number;
    cedula: string | null;
    /** SHA-256 (hex) de la firma de la petición. */
    huella: string;
    ahoraMs?: number;
};

const isoNaive = (ms: number): string => new Date(ms).toISOString().slice(0, 19);

export function evidenciasDeAccion(p: EvidenciaAccionParams): EvidenciaConstruida[] {
    const ahora = p.ahoraMs ?? ahoraCostaRicaMs();
    return [...new Set(p.registroIds.filter((n) => Number.isInteger(n) && n > 0))].map((registroId) => ({
        tabla: p.tabla,
        registroId,
        accion: "UPDATE" as const,
        cedula: p.cedula,
        usuarioId: p.usuarioId,
        sesionId: p.huella,
        latitud: null,
        longitud: null,
        dispositivo: null,
        capturadoEn: isoNaive(ahora),
        ubicacionOrigen: "guardify" as const,
    }));
}

/** Escribe la evidencia (una fila por registro). NUNCA lanza: devuelve si quedó escrita. */
export async function registrarEvidenciaDeAccion(env: ActionEnv, p: EvidenciaAccionParams, llavero: LlaveroFirma | null = llaveroDesdeEntorno()): Promise<boolean> {
    const ahora = p.ahoraMs ?? ahoraCostaRicaMs();
    const evs = evidenciasDeAccion({ ...p, ahoraMs: ahora });
    if (evs.length === 0) return true;
    const filas = evs.map((e) => filaDeEvidencia(e, llavero, ahora));
    const peticion = filas.length === 1
        ? { action: "POST", table: "c_evidencia_registro", operation: "create", data: filas[0], returning: false }
        : { action: "POST", table: "c_evidencia_registro", operation: "createMany", many: true, data: filas };
    let ultimo: unknown = null;
    for (let intento = 0; intento < 2; intento++) {
        try {
            await env.call(peticion);
            return true;
        } catch (e) {
            ultimo = e;
        }
    }
    try {
        await env.report(500, `No se pudo registrar la evidencia de la acción de Guardify (${p.tabla} ${evs.map((e) => e.registroId).slice(0, 20).join(",")}; actor ${p.usuarioId}): ${ultimo instanceof Error ? ultimo.message : String(ultimo)}`);
    } catch {
        /* dejar constancia es de mejor esfuerzo */
    }
    return false;
}
