import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { MOBILE_VARIABLES_TABLE } from "./nomenclatorsMobileVariables";

export const MONITORING_PREVIOUS_MINUTES_VARIABLE = "monitoring_previous_minutes";
export const DEFAULT_MONITORING_PREVIOUS_MINUTES = 15;

export function parseMonitoringPreviousMinutes(raw: unknown): number {
    const n = Number(String(raw ?? "").trim());
    if (!Number.isFinite(n) || n < 0) {
        return DEFAULT_MONITORING_PREVIOUS_MINUTES;
    }
    return Math.floor(n);
}

export async function getMonitoringPreviousMinutes(req: NextRequest): Promise<number> {
    try {
        const row = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: MOBILE_VARIABLES_TABLE,
                operation: "findFirst",
                where: { variable_name: MONITORING_PREVIOUS_MINUTES_VARIABLE },
            },
        });

        if (!row || typeof row !== "object") {
            return DEFAULT_MONITORING_PREVIOUS_MINUTES;
        }

        const variable_value = (row as { variable_value?: unknown }).variable_value;
        return parseMonitoringPreviousMinutes(variable_value);
    } catch (error) {
        console.error("Error obteniendo monitoring_previous_minutes:", error);
        return DEFAULT_MONITORING_PREVIOUS_MINUTES;
    }
}
