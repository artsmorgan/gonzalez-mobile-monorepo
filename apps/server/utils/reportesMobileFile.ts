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

export function inferOutputFileNameFromFiltersJson(filtersJson: string | null | undefined, reportId: number): string {
    try {
        const obj = filtersJson ? (JSON.parse(filtersJson) as { outputFile?: string }) : {};
        const of = obj?.outputFile != null ? String(obj.outputFile).trim() : "";
        if (of) return of;
    } catch {
        /* ignore */
    }
    return `reporte_${reportId}.xlsx`;
}

/** Ruta absoluta al archivo en disco; lanza si no existe o nombre inseguro. */
export async function resolveReportMobileAbsolutePath(reportId: number, filtersJson: string | null | undefined): Promise<string> {
    const inferred = inferOutputFileNameFromFiltersJson(filtersJson, reportId);
    const safe = safeReportMobileBaseName(inferred);
    if (!safe) throw new Error("Nombre de archivo inválido");

    const full = path.join(process.cwd(), "public", "uploads", "reportes_mobile", safe);
    const normalized = path.resolve(full);
    const root = path.resolve(process.cwd(), "public", "uploads", "reportes_mobile");
    const rel = path.relative(root, normalized);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Ruta fuera del directorio permitido");

    await fs.access(normalized);
    return normalized;
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
