import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const REPORTES_CONTROL_VERSIONES_SLUG = "control-versiones-reportes";
export const REPORTES_CONTROL_VERSIONES_TABLE = "n_reportes_control_versiones";

const TITLE_MAX_LENGTH = 50;

export type ReportesControlVersionesRow = {
    id: number;
    report_original_name: string;
    module: string;
    title: string;
    version: number;
    approve_date: string | null;
    department: string;
    /** Alias requerido por la UI genérica de nomencladores. */
    nombre: string;
};

function stripCommas(value: string): string {
    return value.replace(/,/g, "");
}

export function mapReportesControlVersionesRow(row: unknown): ReportesControlVersionesRow | null {
    if (!row || typeof row !== "object") return null;
    const r = row as {
        id?: unknown;
        report_original_name?: unknown;
        module?: unknown;
        title?: unknown;
        version?: unknown;
        approve_date?: unknown;
        department?: unknown;
    };

    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) return null;

    const report_original_name = String(r.report_original_name ?? "").trim();
    const module = String(r.module ?? "").trim();
    const title = String(r.title ?? "").trim();
    const version = Number(r.version ?? 0);
    const department = String(r.department ?? "").trim();
    const approve_date =
        r.approve_date != null ? new Date(r.approve_date as string).toISOString() : null;

    return {
        id,
        report_original_name,
        module,
        title,
        version: Number.isFinite(version) ? version : 0,
        approve_date,
        department,
        nombre: report_original_name || title,
    };
}

export async function fetchReportesControlVersionesList(
    req: NextRequest
): Promise<ReportesControlVersionesRow[]> {
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: REPORTES_CONTROL_VERSIONES_TABLE,
            operation: "findMany",
            orderBy: { id: "desc" },
        },
    });

    return (Array.isArray(rows) ? rows : [])
        .map(mapReportesControlVersionesRow)
        .filter((row): row is ReportesControlVersionesRow => row !== null);
}

export type ReportesControlVersionesUpdatePayload = {
    title: string;
    version: number;
    approve_date: string;
    department: string;
};

export function parseReportesControlVersionesUpdatePayload(
    body: unknown
): ReportesControlVersionesUpdatePayload | { error: string } {
    if (!body || typeof body !== "object") {
        return { error: "Datos inválidos" };
    }
    const b = body as {
        title?: unknown;
        version?: unknown;
        approve_date?: unknown;
        department?: unknown;
    };

    const title = stripCommas(String(b.title ?? "").trim());
    if (!title) {
        return { error: "El título es obligatorio" };
    }
    if (title.length > TITLE_MAX_LENGTH) {
        return { error: `El título no puede superar los ${TITLE_MAX_LENGTH} caracteres` };
    }

    const versionRaw = String(b.version ?? "").trim();
    if (!/^-?\d+$/.test(versionRaw)) {
        return { error: "La versión debe ser un número entero" };
    }
    const version = Number(versionRaw);
    if (!Number.isSafeInteger(version)) {
        return { error: "La versión está fuera de rango" };
    }

    const approveDateRaw = String(b.approve_date ?? "").trim();
    if (!approveDateRaw) {
        return { error: "La fecha de aprobación es obligatoria" };
    }
    const approveDate = new Date(approveDateRaw);
    if (Number.isNaN(approveDate.getTime())) {
        return { error: "La fecha de aprobación no es válida" };
    }

    const department = stripCommas(String(b.department ?? "").trim());
    if (!department) {
        return { error: "El departamento es obligatorio" };
    }

    return {
        title,
        version,
        approve_date: approveDate.toISOString(),
        department,
    };
}

export async function updateReportesControlVersiones(
    req: NextRequest,
    id: number,
    payload: ReportesControlVersionesUpdatePayload
): Promise<ReportesControlVersionesRow> {
    const updated = await callDynamicPrisma({
        req,
        data: {
            action: "UPDATE",
            table: REPORTES_CONTROL_VERSIONES_TABLE,
            operation: "update",
            where: { id },
            data: {
                title: payload.title,
                version: payload.version,
                approve_date: payload.approve_date,
                department: payload.department,
            },
        },
    });

    const mapped = mapReportesControlVersionesRow(updated);
    if (!mapped) {
        throw new Error("No se pudo actualizar el registro");
    }
    return mapped;
}
