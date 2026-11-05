/**
 * Interruptores de las funciones de servidor que Guardify usa y que ya estaban encendidas antes de este interruptor.
 *
 * Por defecto (variable sin definir) TODO SIGUE COMO HOY; poner la variable en `off` (o `false`, `0`, `no`) apaga la función sin tocar código.
 *   GUARDIFY_EVIDENCE        → registro de evidencia de cada alta/edición (`c_evidencia_registro`, issue #153).
 *   GUARDIFY_DOCS_DELIVERY   → vínculos de entrega de documentos al marcar el ingreso (issue #154).
 * Las rutas `/api/guardify/*` se apagan quitando `GUARDIFY_REPORTS_API_KEY` (responden 503) y el control de equipos con `GUARDIFY_DEVICE_ENFORCE=off`.
 */
export type GuardifyServerFlag = "GUARDIFY_EVIDENCE" | "GUARDIFY_DOCS_DELIVERY";

export function isSwitchedOff(raw: unknown): boolean {
    return ["off", "false", "0", "no"].includes(String(raw ?? "").trim().toLowerCase());
}

/** `true` salvo que la variable esté explícitamente apagada. */
export function guardifyFeatureOn(name: GuardifyServerFlag, env: NodeJS.ProcessEnv = process.env): boolean {
    return !isSwitchedOff(env[name]);
}
