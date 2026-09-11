import fs from "fs/promises";
import path from "path";

/** Nombre de archivo seguro bajo `public/uploads/reportes_mobile` (solo base name). */
export function safeReportMobileBaseName(raw: string): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const base = path.basename(s);
    if (!base || base === "." || base === "..") return null;
    if (base.includes("..")) return null;
    if (/[/\\]/.test(base)) return null;
    return base;
}

function parseFiltersJson(filtersJson: string | null | undefined): Record<string, unknown> {
    try {
        return filtersJson ? (JSON.parse(filtersJson) as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** Ruta relativa bajo `public/uploads` (p. ej. `reportes_mobile/12/archivo.xlsx`). */
export function inferOutputRelativePathFromFiltersJson(
    filtersJson: string | null | undefined,
    reportId: number,
): string {
    const obj = parseFiltersJson(filtersJson);
    const outputUrl = String(obj?.outputUrl ?? "").trim().replace(/\\/g, "/");
    if (outputUrl) {
        const cleaned = outputUrl.startsWith("/uploads/") ? outputUrl.slice("/uploads/".length) : outputUrl;
        if (cleaned && !cleaned.includes("..")) return cleaned;
    }
    const of = obj?.outputFile != null ? String(obj.outputFile).trim() : "";
    if (of) {
        const base = safeReportMobileBaseName(of);
        if (base) return `reportes_mobile/${reportId}/${base}`;
        const rel = of.replace(/\\/g, "/").replace(/^\/+/, "");
        if (rel.startsWith("reportes_mobile/")) return rel;
    }
    return `reportes_mobile/${reportId}/reporte_${reportId}.xlsx`;
}

export function inferOutputFileNameFromFiltersJson(filtersJson: string | null | undefined, reportId: number): string {
    const rel = inferOutputRelativePathFromFiltersJson(filtersJson, reportId);
    return path.basename(rel) || `reporte_${reportId}.xlsx`;
}

/** Ruta absoluta al archivo en disco; lanza si no existe o nombre inseguro. */
export async function resolveReportMobileAbsolutePath(reportId: number, filtersJson: string | null | undefined): Promise<string> {
    const rel = inferOutputRelativePathFromFiltersJson(filtersJson, reportId);
    const normalizedPosix = rel.replace(/\\/g, "/");
    if (normalizedPosix.includes("..")) throw new Error("Ruta de archivo inválida");

    const full = path.join(process.cwd(), "public", "uploads", ...normalizedPosix.split("/"));
    const normalized = path.resolve(full);
    const root = path.resolve(process.cwd(), "public", "uploads");
    const relToRoot = path.relative(root, normalized);
    if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) throw new Error("Ruta fuera del directorio permitido");

    await fs.access(normalized);
    return normalized;
}

/** Ruta relativa para `fetchDynamicFile` (sin prefijo `/uploads/`). */
export function resolveReportMobileRelativeUrl(reportId: number, filtersJson: string | null | undefined): string {
    return inferOutputRelativePathFromFiltersJson(filtersJson, reportId);
}

export function guessContentDispositionFileName(downloadName: string): string {
    const base = safeReportMobileBaseName(downloadName) || "reporte.bin";
    return base;
}

export function contentTypeFromFileName(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
    if (lower.endsWith(".zip")) return "application/zip";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
    if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
    return "application/octet-stream";
}
