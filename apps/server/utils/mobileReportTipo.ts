export type MobileReportTipo = "Individual" | "Consolidado" | "Grupal";

export function normalizeMobileReportTipo(raw: unknown): MobileReportTipo | null {
    const t = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (t === "individual") return "Individual";
    if (t === "consolidado") return "Consolidado";
    if (t === "grupal") return "Grupal";
    return null;
}

/** Tipo efectivo al ejecutar un job (columna BD, formMeta en filters, o reportOutputType en moduleFilters). */
export function resolveMobileReportTipoFromRow(row: {
    tipo_reporte?: string | null;
    filters?: string | null;
}): MobileReportTipo {
    const fromColumn = normalizeMobileReportTipo(row.tipo_reporte);
    if (fromColumn) return fromColumn;

    try {
        const parsed = JSON.parse(row.filters || "{}") as {
            formMeta?: { tipo_reporte?: unknown; reportOutputType?: unknown };
        };
        const fromMeta =
            normalizeMobileReportTipo(parsed?.formMeta?.tipo_reporte) ??
            normalizeMobileReportTipo(parsed?.formMeta?.reportOutputType);
        if (fromMeta) return fromMeta;
    } catch {
        /* ignore */
    }

    return "Grupal";
}

export function resolveMobileReportTipoFromModuleFilters(raw: unknown): MobileReportTipo | null {
    if (raw == null || typeof raw !== "object") return null;
    return normalizeMobileReportTipo((raw as Record<string, unknown>).reportOutputType);
}
