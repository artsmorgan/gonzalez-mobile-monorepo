/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import {
    buildActaEntregaExcelBuffer,
    buildActaEntregaExcelBufferByType,
    normalizeActaEntregaFilters,
    queryActaEntregaProductos,
    type ActaEntregaReportType,
    type ActaEntregaOrderKey,
} from "./reports-functions/actaEntregaProductos";
import {
    buildUserLoginExcelBuffer,
    queryRefreshTokensUserLogin,
    type UserLoginOrderKey,
} from "./reports-functions/userLogin";
import {
    buildAgendaMinutaExcelConsolidado,
    buildAgendaMinutaIndividualZip,
    normalizeAgendaMinutaFilters,
    queryAgendaMinutaReportRows,
    type AgendaMinutaOrderKey,
} from "./reports-functions/agendaMinutaReport";
import {
    buildAperturaCierrePuestoExcelConsolidado,
    buildAperturaCierrePuestoExcelIndividual,
    normalizeAperturaCierrePuestoFilters,
    queryAperturaCierrePuestoRows,
    type AperturaCierrePuestoOrderKey,
} from "./reports-functions/aperturaCierrePuestoReport";
import {
    buildVulnerabilidadExcelConsolidado,
    buildVulnerabilidadExcelIndividual,
    normalizeVulnerabilidadFilters,
    queryVulnerabilidadRows,
    type VulnerabilidadOrderKey,
} from "./reports-functions/vulnerabilidadReport";
import {
    buildActividadesExcelConsolidado,
    buildActividadesExcelIndividual,
    normalizeActividadesFilters,
    queryActividadesReportRows,
    type ActividadesOrderKey,
} from "./reports-functions/actividadesReport";
import {
    buildControlAsistenciaExcelConsolidado,
    buildControlAsistenciaExcelIndividual,
    normalizeControlAsistenciaFilters,
    queryControlAsistenciaRows,
    type ControlAsistenciaOrderKey,
} from "./reports-functions/controlAsistenciaReport";
import {
    buildDocumentosEntregadosExcelConsolidado,
    buildDocumentosEntregadosExcelIndividual,
    normalizeDocumentosEntregadosFilters,
    queryDocumentosEntregadosRows,
    type DocumentosEntregadosOrderKey,
} from "./reports-functions/documentosEntregadosReport";
import {
    buildEncuestaSatisfaccionExcelConsolidado,
    buildEncuestaSatisfaccionExcelIndividual,
    normalizeEncuestaSatisfaccionFilters,
    queryEncuestaSatisfaccionRows,
    type EncuestaSatisfaccionOrderKey,
} from "./reports-functions/encuestaSatisfaccionReport";
import {
    buildAccionesPersonalesExcelConsolidado,
    normalizeAccionesPersonalesFilters,
    queryAccionesPersonalesRows,
    type AccionesPersonalesOrderKey,
} from "./reports-functions/accionesPersonalesReport";
import {
    buildEntregaPuestoExcelConsolidado,
    buildEntregaPuestoExcelIndividual,
    normalizeEntregaPuestoFilters,
    queryEntregaPuestoRows,
    type EntregaPuestoOrderKey,
} from "./reports-functions/entregaPuestoReport";
import {
    buildIncidenteExcelConsolidado,
    buildIncidenteExcelIndividual,
    normalizeIncidenteFilters,
    queryIncidenteRows,
    type IncidenteOrderKey,
} from "./reports-functions/incidentesReport";
import {
    buildLlavesExcelConsolidado,
    buildLlavesIndividualZip,
    normalizeLlavesFilters,
    queryLlavesRows,
    type LlavesOrderKey,
} from "./reports-functions/llavesReport";
import {
    buildLlaverosExcelConsolidado,
    buildLlaverosIndividualZip,
    normalizeLlaverosFilters,
    queryLlaverosRows,
    type LlaverosOrderKey,
} from "./reports-functions/llaverosReport";
import {
    buildBitacoraNovedadesExcelConsolidado,
    normalizeBitacoraNovedadesFilters,
    queryBitacoraNovedadesRows,
    type BitacoraNovedadesOrderKey,
} from "./reports-functions/bitacoraNovedadesReport";
import {
    buildMaestroQuejasExcelConsolidado,
    buildMaestroQuejasExcelIndividual,
    normalizeMaestroQuejasFilters,
    queryMaestroQuejasRows,
    type MaestroQuejasOrderKey,
} from "./reports-functions/maestroQuejasReport";
import {
    buildChecklistSupervisionExcelConsolidado,
    normalizeChecklistSupervisionFilters,
    queryChecklistSupervisionRows,
    type ChecklistSupervisionOrderKey,
} from "./reports-functions/checklistSupervisionReport";
import {
    buildMutuosAcuerdosExcelConsolidado,
    buildMutuosAcuerdosExcelIndividual,
    normalizeMutuosAcuerdosFilters,
    queryMutuosAcuerdosRows,
    type MutuosAcuerdosOrderKey,
} from "./reports-functions/mutuosAcuerdosReport";
import {
    buildEvaluacionPersonalExcelConsolidado,
    normalizeEvaluacionPersonalFilters,
    queryEvaluacionEmpleadoRows,
    type EvaluacionPersonalOrderKey,
} from "./reports-functions/evaluacionEmpleadoReport";
import {
    buildProductoNoConformeExcelConsolidado,
    buildProductoNoConformeExcelIndividual,
    normalizeProductoNoConformeFilters,
    queryProductoNoConformeRows,
    type ProductoNoConformeOrderKey,
} from "./reports-functions/productoNoConformeReport";
import {
    buildInduccionRecorridoExcelConsolidado,
    buildInduccionRecorridoExcelIndividual,
    normalizeInduccionRecorridoFilters,
    queryInduccionRecorridoRows,
    type InduccionRecorridoOrderKey,
} from "./reports-functions/induccionRecorridoReport";
import {
    buildManualesPuestoExcelConsolidado,
    normalizeManualesPuestoFilters,
    queryManualesPuestoRows,
    type ManualesPuestoOrderKey,
} from "./reports-functions/manualesPuestoReport";
import {
    buildRegistroVisitasExcelConsolidado,
    buildRegistroVisitasIndividualZip,
    normalizeRegistroVisitasFilters,
    queryRegistroVisitasRows,
    type RegistroVisitasOrderKey,
} from "./reports-functions/registroVisitasReport";

type StoredFilters = {
    moduleKey?: string;
    moduleFilters?: Record<string, unknown>;
    outputFile?: string;
};

function sanitizeFilePart(v: string): string {
    const s = String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return s || "reporte";
}

async function buildUniqueReportFileName(
    dir: string,
    nomenclatura: string,
    tipoReporte: string,
    ext: string = "xlsx",
): Promise<string> {
    const cleanExt = ext.replace(/^\./, "").toLowerCase() || "xlsx";
    const base = `${sanitizeFilePart(nomenclatura)}_${sanitizeFilePart(tipoReporte)}`;
    const existing = new Set<string>();
    try {
        const files = await fs.readdir(dir);
        for (const f of files) existing.add(String(f).toLowerCase());
    } catch {
        /* ignore */
    }
    let candidate = `${base}.${cleanExt}`;
    let n = 2;
    while (existing.has(candidate.toLowerCase())) {
        candidate = `${base}_${n}.${cleanExt}`;
        n += 1;
    }
    return candidate;
}

function mergeFiltersWithOutputFile(filtersJson: string | null, outputFile: string): string {
    let obj: Record<string, unknown> = {};
    try {
        obj = JSON.parse(filtersJson || "{}") as Record<string, unknown>;
    } catch {
        obj = {};
    }
    return JSON.stringify({ ...obj, outputFile });
}

export async function runMobileReportJob(prisma: PrismaClient, reportId: number): Promise<void> {
    const row = await prisma.e_reportes_mobile.findUnique({ where: { id: reportId } });
    if (!row) return;

    let parsed: StoredFilters = {};
    try {
        parsed = JSON.parse(row.filters || "{}");
    } catch {
        parsed = {};
    }

    const moduleKey = parsed.moduleKey || row.modulo;
    const orderKey = String(row.order_by || "nombre_usuario").trim();

    try {
        if (moduleKey === "ingresos_usuario") {
            const mf = (parsed.moduleFilters || {}) as any;
            const tokens = await queryRefreshTokensUserLogin(prisma, mf, orderKey as UserLoginOrderKey);
            const buf = await buildUserLoginExcelBuffer(tokens);
            /** Misma raíz que `dynamic-prisma/files`: solo disco bajo `public/uploads`, sin guardar binarios ni rutas en BD. */
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "acta_entrega_productos") {
            const mf = normalizeActaEntregaFilters(parsed.moduleFilters || {});
            const rows = await queryActaEntregaProductos(prisma, mf, orderKey as ActaEntregaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim() as ActaEntregaReportType;
            const buf =
                reportType === "Individual"
                    ? await buildActaEntregaExcelBufferByType(rows, "Individual", row.nombre)
                    : await buildActaEntregaExcelBuffer(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "agenda_minuta") {
            const mf = normalizeAgendaMinutaFilters(parsed.moduleFilters || {});
            const rows = await queryAgendaMinutaReportRows(prisma, mf, orderKey as AgendaMinutaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildAgendaMinutaIndividualZip(rows, row.nombre)
                    : await buildAgendaMinutaExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, ext);
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "apertura_cierre_puesto") {
            const mf = normalizeAperturaCierrePuestoFilters(parsed.moduleFilters || {});
            const rows = await queryAperturaCierrePuestoRows(prisma, mf, orderKey as AperturaCierrePuestoOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildAperturaCierrePuestoExcelIndividual(rows, row.nombre)
                    : await buildAperturaCierrePuestoExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "apreciacion_vulnerabilidad") {
            const mf = normalizeVulnerabilidadFilters(parsed.moduleFilters || {});
            const rows = await queryVulnerabilidadRows(prisma, mf, orderKey as VulnerabilidadOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildVulnerabilidadExcelIndividual(rows, row.nombre)
                    : await buildVulnerabilidadExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "actividades") {
            const mf = normalizeActividadesFilters(parsed.moduleFilters || {});
            const rows = await queryActividadesReportRows(prisma, mf, orderKey as ActividadesOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildActividadesExcelIndividual(rows, row.nombre)
                    : await buildActividadesExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "control_asistencia") {
            const mf = normalizeControlAsistenciaFilters(parsed.moduleFilters || {});
            const rows = await queryControlAsistenciaRows(prisma, mf, orderKey as ControlAsistenciaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildControlAsistenciaExcelIndividual(rows, row.nombre)
                    : await buildControlAsistenciaExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "documentos_entregados") {
            const mf = normalizeDocumentosEntregadosFilters(parsed.moduleFilters || {});
            const rows = await queryDocumentosEntregadosRows(prisma, mf, orderKey as DocumentosEntregadosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildDocumentosEntregadosExcelIndividual(rows, row.nombre)
                    : await buildDocumentosEntregadosExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "encuesta_satisfaccion") {
            const mf = normalizeEncuestaSatisfaccionFilters(parsed.moduleFilters || {});
            const rows = await queryEncuestaSatisfaccionRows(prisma, mf, orderKey as EncuestaSatisfaccionOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildEncuestaSatisfaccionExcelIndividual(rows, row.nombre)
                    : await buildEncuestaSatisfaccionExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "entrega_puesto") {
            const mf = normalizeEntregaPuestoFilters(parsed.moduleFilters || {});
            const rows = await queryEntregaPuestoRows(prisma, mf, orderKey as EntregaPuestoOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildEntregaPuestoExcelIndividual(rows, row.nombre)
                    : await buildEntregaPuestoExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "acciones_personales") {
            const mf = normalizeAccionesPersonalesFilters(parsed.moduleFilters || {});
            const rows = await queryAccionesPersonalesRows(prisma, mf, orderKey as AccionesPersonalesOrderKey);
            const buf = await buildAccionesPersonalesExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "incidentes") {
            const mf = normalizeIncidenteFilters(parsed.moduleFilters || {});
            const rows = await queryIncidenteRows(prisma, mf, orderKey as IncidenteOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildIncidenteExcelIndividual(rows, row.nombre)
                    : await buildIncidenteExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "llaves") {
            const mf = normalizeLlavesFilters(parsed.moduleFilters || {});
            const rows = await queryLlavesRows(prisma, mf, orderKey as LlavesOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildLlavesIndividualZip(rows, row.nombre)
                    : await buildLlavesExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, ext);
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "llaveros") {
            const mf = normalizeLlaverosFilters(parsed.moduleFilters || {});
            const rows = await queryLlaverosRows(prisma, mf, orderKey as LlaverosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildLlaverosIndividualZip(rows, row.nombre)
                    : await buildLlaverosExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, ext);
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "bitacora_novedades") {
            const mf = normalizeBitacoraNovedadesFilters(parsed.moduleFilters || {});
            const bnvOrder = String(row.order_by || "titulo").trim();
            const rows = await queryBitacoraNovedadesRows(prisma, mf, bnvOrder as BitacoraNovedadesOrderKey);
            const buf = await buildBitacoraNovedadesExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "maestro_quejas") {
            const mf = normalizeMaestroQuejasFilters(parsed.moduleFilters || {});
            const mqjOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryMaestroQuejasRows(prisma, mf, mqjOrder as MaestroQuejasOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildMaestroQuejasExcelIndividual(rows, String(row.nombre ?? ""))
                    : await buildMaestroQuejasExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }
        if (moduleKey === "checklist_supervision") {
            const mf = normalizeChecklistSupervisionFilters(parsed.moduleFilters || {});
            const ckOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryChecklistSupervisionRows(prisma, mf, ckOrder as ChecklistSupervisionOrderKey);
            const buf = await buildChecklistSupervisionExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "mutuos_acuerdos") {
            const mf = normalizeMutuosAcuerdosFilters(parsed.moduleFilters || {});
            const rows = await queryMutuosAcuerdosRows(prisma, mf, orderKey as MutuosAcuerdosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildMutuosAcuerdosExcelIndividual(rows, row.nombre)
                    : await buildMutuosAcuerdosExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "evaluacion_personal") {
            const mf = normalizeEvaluacionPersonalFilters(parsed.moduleFilters || {});
            const evpOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryEvaluacionEmpleadoRows(prisma, mf, evpOrder as EvaluacionPersonalOrderKey);
            const buf = await buildEvaluacionPersonalExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "producto_no_conforme") {
            const mf = normalizeProductoNoConformeFilters(parsed.moduleFilters || {});
            const pncOrder = String(row.order_by || "empresa_id").trim() as ProductoNoConformeOrderKey;
            const rows = await queryProductoNoConformeRows(prisma, mf, pncOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildProductoNoConformeExcelIndividual(rows, row.nombre)
                    : await buildProductoNoConformeExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "registro_induccion_recorrido") {
            const mf = normalizeInduccionRecorridoFilters(parsed.moduleFilters || {});
            const irOrder = String(row.order_by || "empresa_id").trim() as InduccionRecorridoOrderKey;
            const rows = await queryInduccionRecorridoRows(prisma, mf, irOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildInduccionRecorridoExcelIndividual(rows, row.nombre)
                    : await buildInduccionRecorridoExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "manuales_puesto") {
            const mf = normalizeManualesPuestoFilters(parsed.moduleFilters || {});
            const mpOrder = String(row.order_by || "title").trim() as ManualesPuestoOrderKey;
            const rows = await queryManualesPuestoRows(prisma, mf, mpOrder);
            const buf = await buildManualesPuestoExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, "xlsx");
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        if (moduleKey === "registro_visitas") {
            const mf = normalizeRegistroVisitasFilters(parsed.moduleFilters || {});
            const rvOrder = String(row.order_by || "empresa_id").trim() as RegistroVisitasOrderKey;
            const rows = await queryRegistroVisitasRows(prisma, mf, rvOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildRegistroVisitasIndividualZip(rows, String(row.nombre ?? ""))
                    : await buildRegistroVisitasExcelConsolidado(rows);
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const relDir = "reportes_mobile";
            const dir = path.join(uploadsRoot, relDir);
            await fs.mkdir(dir, { recursive: true });
            const fileName = await buildUniqueReportFileName(dir, row.nomenclatura, row.tipo_reporte, ext);
            const abs = path.join(dir, fileName);
            await fs.writeFile(abs, buf);
            await prisma.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "completado",
                    filters: mergeFiltersWithOutputFile(row.filters, fileName),
                },
            });
            return;
        }

        await prisma.e_reportes_mobile.update({
            where: { id: reportId },
            data: { estado: "error" },
        });
    } catch (e) {
        console.error("runMobileReportJob", reportId, e);
        await prisma.e_reportes_mobile.update({
            where: { id: reportId },
            data: { estado: "error" },
        });
    }
}
