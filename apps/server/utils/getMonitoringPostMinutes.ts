import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { MOBILE_VARIABLES_TABLE } from "./nomenclatorsMobileVariables";

export const MONITORING_POST_MINUTES_VARIABLE = "monitoring_post_minutes";
export const DEFAULT_MONITORING_POST_MINUTES = 0;

export function parseMonitoringPostMinutes(raw: unknown): number {
    const n = Number(String(raw ?? "").trim());
    if (!Number.isFinite(n) || n < 0) {
        return DEFAULT_MONITORING_POST_MINUTES;
    }
    return Math.floor(n);
}

/** Minutos tras la hora de inicio en que la entrada aún no se considera tardía. */
export async function getMonitoringPostMinutes(req: NextRequest): Promise<number> {
    try {
        const row = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: MOBILE_VARIABLES_TABLE,
                operation: "findFirst",
                where: { variable_name: MONITORING_POST_MINUTES_VARIABLE },
            },
        });

        if (!row || typeof row !== "object") {
            return DEFAULT_MONITORING_POST_MINUTES;
        }

        const variable_value = (row as { variable_value?: unknown }).variable_value;
        return parseMonitoringPostMinutes(variable_value);
    } catch (error) {
        console.error("Error obteniendo monitoring_post_minutes:", error);
        return DEFAULT_MONITORING_POST_MINUTES;
    }
}
