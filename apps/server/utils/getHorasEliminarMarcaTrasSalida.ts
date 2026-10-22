import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { MOBILE_VARIABLES_TABLE } from "./nomenclatorsMobileVariables";
import { DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA, parseHorasEliminarMarca } from "./marcaCaducada";

export const HORAS_ELIMINAR_MARCA_VARIABLE = "horas_eliminar_marca_tras_salida";

/**
 * Horas que deben pasar desde la salida de un turno (marca) para que deje de ser el turno actual y se elimine del almacenamiento de la app
 * (issue #159). Es una variable del sistema editable en Nomencladores («variables-sistema»); por defecto 4.
 */
export async function getHorasEliminarMarcaTrasSalida(req: NextRequest): Promise<number> {
    try {
        const row = await callDynamicPrisma({
            req,
            data: { action: "GET", table: MOBILE_VARIABLES_TABLE, operation: "findFirst", where: { variable_name: HORAS_ELIMINAR_MARCA_VARIABLE } },
        });
        if (!row || typeof row !== "object") return DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
        return parseHorasEliminarMarca((row as { variable_value?: unknown }).variable_value);
    } catch (error) {
        console.error("Error obteniendo horas_eliminar_marca_tras_salida:", error);
        return DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
    }
}
