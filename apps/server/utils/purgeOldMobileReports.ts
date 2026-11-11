import fs from "fs/promises";
import path from "path";
import type { ReportDataAccess } from "./reportDynamicPrisma";
import {
    inferOutputFileNameFromFiltersJson,
    safeReportMobileBaseName,
} from "./reportesMobileFile";

const REPORTS_MOBILE_DIR = path.resolve(process.cwd(), "public", "uploads", "reportes_mobile");
const RETENTION_MONTHS = 6;

export type PurgeOldMobileReportsResult = {
    cutoff: string;
    recordsFound: number;
    recordsDeleted: number;
    filesDeleted: number;
    fileDeleteErrors: number;
};

/** Registros con `created_at` anterior a esta fecha (más de 6 meses de antigüedad). */
export function getMobileReportsRetentionCutoff(now: Date = new Date()): Date {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    return cutoff;
}

function resolveReportFileAbsolutePath(fileName: string): string | null {
    const safe = safeReportMobileBaseName(fileName);
    if (!safe) return null;
    const full = path.join(REPORTS_MOBILE_DIR, safe);
    const normalized = path.resolve(full);
    const root = path.resolve(REPORTS_MOBILE_DIR);
    const rel = path.relative(root, normalized);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return normalized;
}

function collectOutputFileNames(filtersJson: string | null | undefined, reportId: number): string[] {
    const out = new Set<string>();
    const inferred = inferOutputFileNameFromFiltersJson(filtersJson, reportId);
    const safeInferred = safeReportMobileBaseName(inferred);
    if (safeInferred) out.add(safeInferred);
    try {
        const obj = JSON.parse(filtersJson || "{}") as { outputFile?: unknown };
        const raw = obj?.outputFile != null ? String(obj.outputFile).trim() : "";
        const safeRaw = safeReportMobileBaseName(raw);
        if (safeRaw) out.add(safeRaw);
    } catch {
        /* ignore */
    }
    return [...out];
}

async function deleteReportFileIfExists(fileName: string): Promise<boolean> {
    const abs = resolveReportFileAbsolutePath(fileName);
    if (!abs) return false;
    try {
        await fs.unlink(abs);
        return true;
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") return false;
        throw err;
    }
}

/**
 * Elimina reportes móviles con más de 6 meses de antigüedad (`created_at` &lt; ahora − 6 meses)
 * y sus archivos en `public/uploads/reportes_mobile` (cualquier módulo / extensión).
 */
export async function purgeOldMobileReports(reportDb: ReportDataAccess): Promise<PurgeOldMobileReportsResult> {
    const cutoff = getMobileReportsRetentionCutoff();
    const rows = await reportDb.e_reportes_mobile.findMany({
        where: { created_at: { lt: cutoff } },
        select: { id: true, filters: true },
    });

    let filesDeleted = 0;
    let fileDeleteErrors = 0;

    for (const row of rows) {
        const fileNames = collectOutputFileNames(row.filters, row.id);
        for (const fileName of fileNames) {
            try {
                if (await deleteReportFileIfExists(fileName)) filesDeleted += 1;
            } catch {
                fileDeleteErrors += 1;
            }
        }
    }

    let recordsDeleted = 0;
    for (const row of rows) {
        await reportDb.e_reportes_mobile.delete({ where: { id: row.id } });
        recordsDeleted += 1;
    }

    return {
        cutoff: cutoff.toISOString(),
        recordsFound: rows.length,
        recordsDeleted,
        filesDeleted,
        fileDeleteErrors,
    };
}
