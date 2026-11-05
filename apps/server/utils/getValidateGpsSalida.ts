import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { MOBILE_VARIABLES_TABLE } from "./nomenclatorsMobileVariables";

export const VALIDATE_GPS_SALIDA_VARIABLE = "validate_gps_salida";
export const DEFAULT_VALIDATE_GPS_SALIDA = false;

export function parseValidateGpsSalida(raw: unknown): boolean {
    const lower = String(raw ?? "").trim().toLowerCase();
    if (["true", "1", "yes", "si", "sí"].includes(lower)) return true;
    if (["false", "0", "no"].includes(lower)) return false;
    return DEFAULT_VALIDATE_GPS_SALIDA;
}

export async function getValidateGpsSalida(req: NextRequest): Promise<boolean> {
    try {
        const row = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: MOBILE_VARIABLES_TABLE,
                operation: "findFirst",
                where: { variable_name: VALIDATE_GPS_SALIDA_VARIABLE },
            },
        });

        if (!row || typeof row !== "object") {
            return DEFAULT_VALIDATE_GPS_SALIDA;
        }

        const variable_value = (row as { variable_value?: unknown }).variable_value;
        return parseValidateGpsSalida(variable_value);
    } catch (error) {
        console.error("Error obteniendo validate_gps_salida:", error);
        return DEFAULT_VALIDATE_GPS_SALIDA;
    }
}
