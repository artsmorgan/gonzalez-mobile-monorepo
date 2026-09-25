import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const MOBILE_VARIABLES_SLUG = "variables-sistema";
export const MOBILE_VARIABLES_TABLE = "n_mobile_variables";

export type MobileVariableRow = {
    id: number;
    variable_name: string;
    slug: string;
    variable_value: string;
    variable_type: string;
    nombre: string;
};

export function buildMobileVariableLabel(variableName: string, variableValue: string): string {
    const name = String(variableName ?? "").trim();
    const value = String(variableValue ?? "").trim();
    if (!name) return value;
    if (!value) return name;
    return `${name}: ${value}`;
}

export function validateVariableValue(
    variableType: string,
    rawValue: string
): { valid: true; normalizedValue: string } | { valid: false; message: string } {
    const type = String(variableType ?? "").trim().toLowerCase();
    const value = String(rawValue ?? "").trim();

    if (value === "") {
        return { valid: false, message: "El valor no puede estar vacío." };
    }

    switch (type) {
        case "int":
        case "integer": {
            if (!/^-?\d+$/.test(value)) {
                return { valid: false, message: "El valor debe ser un número entero." };
            }
            const n = Number(value);
            if (!Number.isSafeInteger(n)) {
                return { valid: false, message: "El valor entero está fuera de rango." };
            }
            return { valid: true, normalizedValue: String(n) };
        }
        case "float":
        case "decimal":
        case "double":
        case "number": {
            if (!/^-?\d+(\.\d+)?$/.test(value)) {
                return { valid: false, message: "El valor debe ser un número." };
            }
            const n = Number(value);
            if (!Number.isFinite(n)) {
                return { valid: false, message: "El valor debe ser un número válido." };
            }
            return { valid: true, normalizedValue: String(n) };
        }
        case "bool":
        case "boolean": {
            const lower = value.toLowerCase();
            if (["true", "1", "yes", "si", "sí"].includes(lower)) {
                return { valid: true, normalizedValue: "true" };
            }
            if (["false", "0", "no"].includes(lower)) {
                return { valid: true, normalizedValue: "false" };
            }
            return {
                valid: false,
                message: "El valor debe ser verdadero o falso (true/false, 1/0, sí/no).",
            };
        }
        case "json": {
            try {
                const parsed = JSON.parse(value);
                return { valid: true, normalizedValue: JSON.stringify(parsed) };
            } catch {
                return { valid: false, message: "El valor debe ser un JSON válido." };
            }
        }
        case "string":
        case "text":
        default:
            return { valid: true, normalizedValue: value };
    }
}

export function mapMobileVariableRow(row: unknown): MobileVariableRow | null {
    if (!row || typeof row !== "object") return null;
    const r = row as {
        id?: unknown;
        variable_name?: unknown;
        slug?: unknown;
        variable_value?: unknown;
        variable_type?: unknown;
    };

    const id = Number(r.id);
    const variable_name = String(r.variable_name ?? "").trim();
    const slug = String(r.slug ?? "").trim();
    const variable_value = String(r.variable_value ?? "");
    const variable_type = String(r.variable_type ?? "").trim();

    if (!Number.isFinite(id) || id <= 0 || !variable_name || !variable_type) return null;

    return {
        id,
        variable_name,
        slug,
        variable_value,
        variable_type,
        nombre: buildMobileVariableLabel(variable_name, variable_value),
    };
}

export async function fetchMobileVariablesList(req: NextRequest): Promise<MobileVariableRow[]> {
    await ensureValidateGpsSalidaVariable(req);

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: MOBILE_VARIABLES_TABLE,
            operation: "findMany",
            orderBy: { variable_name: "asc" },
        },
    });

    return (Array.isArray(rows) ? rows : [])
        .map(mapMobileVariableRow)
        .filter((row): row is MobileVariableRow => row !== null);
}

async function ensureValidateGpsSalidaVariable(req: NextRequest): Promise<void> {
    try {
        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: MOBILE_VARIABLES_TABLE,
                operation: "findFirst",
                where: { variable_name: "validate_gps_salida" },
            },
        });
        if (existing) return;

        const now = new Date();
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: MOBILE_VARIABLES_TABLE,
                data: {
                    variable_name: "validate_gps_salida",
                    slug: "validate-gps-salida",
                    variable_value: "false",
                    variable_type: "boolean",
                    created_at: now,
                    updated_at: now,
                },
            },
        });
    } catch (error) {
        console.error("Error asegurando validate_gps_salida:", error);
    }
}

export function parseMobileVariablePayload(
    body: unknown
): { variable_value: string } | null {
    if (!body || typeof body !== "object") return null;
    const variable_value = (body as { variable_value?: unknown }).variable_value;
    if (variable_value == null) return null;
    return { variable_value: String(variable_value) };
}

export async function updateMobileVariable(
    req: NextRequest,
    id: number,
    variable_value: string
): Promise<MobileVariableRow> {
    const existing = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: MOBILE_VARIABLES_TABLE,
            operation: "findUnique",
            where: { id },
        },
    });

    const mappedExisting = mapMobileVariableRow(existing);
    if (!mappedExisting) {
        throw new Error("Variable no encontrada");
    }

    const validation = validateVariableValue(mappedExisting.variable_type, variable_value);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    const now = new Date();
    const updated = await callDynamicPrisma({
        req,
        data: {
            action: "UPDATE",
            table: MOBILE_VARIABLES_TABLE,
            operation: "update",
            where: { id },
            data: {
                variable_value: validation.normalizedValue,
                updated_at: now,
            },
        },
    });

    const mapped = mapMobileVariableRow(updated);
    if (!mapped) {
        throw new Error("No se pudo actualizar la variable");
    }

    return mapped;
}
