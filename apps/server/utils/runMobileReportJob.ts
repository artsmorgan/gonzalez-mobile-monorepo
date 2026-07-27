/* eslint-disable @typescript-eslint/no-explicit-any */
import { createReportPrismaClient, createReportServiceRequest, type ReportDataAccess } from "./reportDynamicPrisma";
import { finalizeReportJobAsError, hasExceededReportAttempts } from "./reportJobQueue";
import { completeReportJob } from "./reportMobileFileStorage";
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
    buildArticulosPuestoExcelConsolidado,
    normalizeArticulosPuestoFilters,
    queryArticulosPuestoRows,
    type ArticulosPuestoOrderKey,
} from "./reports-functions/articulosPuestoReport";
import {
    buildMantenimientoArticulosExcelConsolidado,
    normalizeMantenimientoArticulosFilters,
    queryMantenimientoArticulosRows,
    type MantenimientoArticulosOrderKey,
} from "./reports-functions/mantenimientoArticulosReport";
import {
    buildRegistroVehiculosCorporativosExcelConsolidado,
    normalizeRegistroVehiculosCorporativosFilters,
    queryRegistroVehiculosCorporativosRows,
    type RegistroVehiculosCorporativosOrderKey,
} from "./reports-functions/registroVehiculosCorporativosReport";
import {
    buildRevisionVehiculosExcelConsolidado,
    normalizeRevisionVehiculosFilters,
    queryRevisionVehiculosRows,
    type RevisionVehiculosOrderKey,
} from "./reports-functions/revisionVehiculosReport";
import { buildRevisionVehiculosExcelIndividual } from "./reports-functions/revisionVehiculosIndividualVehiculo";
import {
    buildRegistroVisitasExcelConsolidado,
    buildRegistroVisitasIndividualZip,
    normalizeRegistroVisitasFilters,
    queryRegistroVisitasRows,
    type RegistroVisitasOrderKey,
} from "./reports-functions/registroVisitasReport";
import {
    buildNotasVozExcelConsolidado,
    normalizeNotasVozFilters,
    queryNotasVozRows,
    type NotasVozOrderKey,
} from "./reports-functions/notasVozReport";
import {
    buildCambiosUbicacionPuestoExcelConsolidado,
    normalizeCambiosUbicacionPuestoFilters,
    queryCambiosUbicacionPuestoRows,
    type CambiosUbicacionPuestoOrderKey,
} from "./reports-functions/cambiosUbicacionPuestoReport";
import {
    buildRegistroCapacitacionesExcelConsolidado,
    normalizeRegistroCapacitacionesFilters,
    queryRegistroCapacitacionesRows,
    type RegistroCapacitacionesOrderKey,
} from "./reports-functions/registroCapacitacionesReport";
import { resolveMobileReportTipoFromRow } from "./mobileReportTipo";
import {
    buildRegistroInduccionGeneralExcelConsolidado,
    buildRegistroInduccionGeneralIndividualZip,
    normalizeRegistroInduccionGeneralFilters,
    queryRegistroInduccionGeneralRows,
    type RegistroInduccionGeneralOrderKey,
} from "./reports-functions/registroInduccionGeneralReport";
import {
    buildTiempoAlmuerzoExcelConsolidado,
    normalizeTiempoAlmuerzoFilters,
    queryTiempoAlmuerzoRows,
    type TiempoAlmuerzoOrderKey,
} from "./reports-functions/tiempoAlmuerzoReport";
import {
    buildLoginMarcaExcelConsolidado,
    normalizeLoginMarcaFilters,
    queryLoginMarcaRows,
    type LoginMarcaOrderKey,
} from "./reports-functions/loginMarcaReport";
import {
    buildSolicitudesPermisoExcelConsolidado,
    buildSolicitudesPermisoExcelIndividual,
    normalizeSolicitudesPermisoFilters,
    querySolicitudesPermisoRows,
    type SolicitudesPermisoOrderKey,
} from "./reports-functions/solicitudesPermisoReport";
import {
    buildVisitasVehiculosExcelConsolidado,
    buildVisitasVehiculosIndividualZip,
    normalizeVisitasVehiculosFilters,
    queryVisitasVehiculosRows,
    type VisitasVehiculosOrderKey,
} from "./reports-functions/visitasVehiculosReport";

type StoredFilters = {
    moduleKey?: string;
    moduleFilters?: Record<string, unknown>;
    outputFile?: string;
    serviceAccessToken?: string;
};

export async function runMobileReportJob(queueDb: ReportDataAccess, reportId: number): Promise<void> {
    const row = await queueDb.e_reportes_mobile.findUnique({ where: { id: reportId } });
    if (!row) return;

    const estado = String(row.estado || "").toLowerCase();
    if (estado === "error" || estado === "completado") return;

    if (hasExceededReportAttempts(row.attemps, row.max_attempts)) {
        await finalizeReportJobAsError(
            queueDb,
            reportId,
            row.error_message || "Máximo de intentos alcanzado",
            row,
        );
        return;
    }

    let parsed: StoredFilters = {};
    try {
        parsed = JSON.parse(row.filters || "{}");
    } catch {
        parsed = {};
    }

    const serviceAccessToken = String(parsed.serviceAccessToken || "").trim();
    const req = createReportServiceRequest(serviceAccessToken || undefined);
    const reportDb = createReportPrismaClient(req, serviceAccessToken || undefined);

    const moduleKey = parsed.moduleKey || row.modulo;
    const orderKey = String(row.order_by || "nombre_usuario").trim();

    try {
        if (moduleKey === "ingresos_usuario") {
            const mf = (parsed.moduleFilters || {}) as any;
            const tokens = await queryRefreshTokensUserLogin(reportDb, mf, orderKey as UserLoginOrderKey);
            const buf = await buildUserLoginExcelBuffer(tokens);
            /** Misma raíz que `dynamic-prisma/files`: solo disco bajo `public/uploads`, sin guardar binarios ni rutas en BD. */
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "acta_entrega_productos") {
            const mf = normalizeActaEntregaFilters(parsed.moduleFilters || {});
            const rows = await queryActaEntregaProductos(reportDb, mf, orderKey as ActaEntregaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim() as ActaEntregaReportType;
            const buf =
                reportType === "Individual"
                    ? await buildActaEntregaExcelBufferByType(rows, "Individual", row.nombre)
                    : await buildActaEntregaExcelBuffer(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "agenda_minuta") {
            const mf = normalizeAgendaMinutaFilters(parsed.moduleFilters || {});
            const rows = await queryAgendaMinutaReportRows(reportDb, mf, orderKey as AgendaMinutaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildAgendaMinutaIndividualZip(rows, row.nombre)
                    : await buildAgendaMinutaExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }

        if (moduleKey === "apertura_cierre_puesto") {
            const mf = normalizeAperturaCierrePuestoFilters(parsed.moduleFilters || {});
            const rows = await queryAperturaCierrePuestoRows(reportDb, mf, orderKey as AperturaCierrePuestoOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildAperturaCierrePuestoExcelIndividual(rows, row.nombre)
                    : await buildAperturaCierrePuestoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "apreciacion_vulnerabilidad") {
            const mf = normalizeVulnerabilidadFilters(parsed.moduleFilters || {});
            const rows = await queryVulnerabilidadRows(reportDb, mf, orderKey as VulnerabilidadOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildVulnerabilidadExcelIndividual(rows, row.nombre)
                    : await buildVulnerabilidadExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "actividades") {
            const mf = normalizeActividadesFilters(parsed.moduleFilters || {});
            const rows = await queryActividadesReportRows(reportDb, mf, orderKey as ActividadesOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildActividadesExcelIndividual(rows, row.nombre)
                    : await buildActividadesExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "control_asistencia") {
            const mf = normalizeControlAsistenciaFilters(parsed.moduleFilters || {});
            const rows = await queryControlAsistenciaRows(reportDb, mf, orderKey as ControlAsistenciaOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildControlAsistenciaExcelIndividual(rows, row.nombre)
                    : await buildControlAsistenciaExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "documentos_entregados") {
            const mf = normalizeDocumentosEntregadosFilters(parsed.moduleFilters || {});
            const rows = await queryDocumentosEntregadosRows(reportDb, mf, orderKey as DocumentosEntregadosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildDocumentosEntregadosExcelIndividual(rows, row.nombre)
                    : await buildDocumentosEntregadosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "encuesta_satisfaccion") {
            const mf = normalizeEncuestaSatisfaccionFilters(parsed.moduleFilters || {});
            const rows = await queryEncuestaSatisfaccionRows(reportDb, mf, orderKey as EncuestaSatisfaccionOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildEncuestaSatisfaccionExcelIndividual(rows, row.nombre)
                    : await buildEncuestaSatisfaccionExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "entrega_puesto") {
            const mf = normalizeEntregaPuestoFilters(parsed.moduleFilters || {});
            const rows = await queryEntregaPuestoRows(reportDb, mf, orderKey as EntregaPuestoOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildEntregaPuestoExcelIndividual(rows, row.nombre)
                    : await buildEntregaPuestoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "acciones_personales") {
            const mf = normalizeAccionesPersonalesFilters(parsed.moduleFilters || {});
            const rows = await queryAccionesPersonalesRows(reportDb, mf, orderKey as AccionesPersonalesOrderKey);
            const buf = await buildAccionesPersonalesExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }
        if (moduleKey === "incidentes") {
            const mf = normalizeIncidenteFilters(parsed.moduleFilters || {});
            const rows = await queryIncidenteRows(reportDb, mf, orderKey as IncidenteOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildIncidenteExcelIndividual(rows, row.nombre)
                    : await buildIncidenteExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }
        if (moduleKey === "llaves") {
            const mf = normalizeLlavesFilters(parsed.moduleFilters || {});
            const rows = await queryLlavesRows(reportDb, mf, orderKey as LlavesOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildLlavesIndividualZip(rows, row.nombre)
                    : await buildLlavesExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }
        if (moduleKey === "llaveros") {
            const mf = normalizeLlaverosFilters(parsed.moduleFilters || {});
            const rows = await queryLlaverosRows(reportDb, mf, orderKey as LlaverosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildLlaverosIndividualZip(rows, row.nombre)
                    : await buildLlaverosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }
        if (moduleKey === "bitacora_novedades") {
            const mf = normalizeBitacoraNovedadesFilters(parsed.moduleFilters || {});
            const bnvOrder = String(row.order_by || "titulo").trim();
            const rows = await queryBitacoraNovedadesRows(reportDb, mf, bnvOrder as BitacoraNovedadesOrderKey);
            const buf = await buildBitacoraNovedadesExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }
        if (moduleKey === "maestro_quejas") {
            const mf = normalizeMaestroQuejasFilters(parsed.moduleFilters || {});
            const mqjOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryMaestroQuejasRows(reportDb, mf, mqjOrder as MaestroQuejasOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildMaestroQuejasExcelIndividual(rows, String(row.nombre ?? ""))
                    : await buildMaestroQuejasExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }
        if (moduleKey === "checklist_supervision") {
            const mf = normalizeChecklistSupervisionFilters(parsed.moduleFilters || {});
            const ckOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryChecklistSupervisionRows(reportDb, mf, ckOrder as ChecklistSupervisionOrderKey);
            const buf = await buildChecklistSupervisionExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "mutuos_acuerdos") {
            const mf = normalizeMutuosAcuerdosFilters(parsed.moduleFilters || {});
            const rows = await queryMutuosAcuerdosRows(reportDb, mf, orderKey as MutuosAcuerdosOrderKey);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildMutuosAcuerdosExcelIndividual(rows, row.nombre)
                    : await buildMutuosAcuerdosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "evaluacion_personal") {
            const mf = normalizeEvaluacionPersonalFilters(parsed.moduleFilters || {});
            const evpOrder = String(row.order_by || "empresa_id").trim();
            const rows = await queryEvaluacionEmpleadoRows(reportDb, mf, evpOrder as EvaluacionPersonalOrderKey);
            const buf = await buildEvaluacionPersonalExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "producto_no_conforme") {
            const mf = normalizeProductoNoConformeFilters(parsed.moduleFilters || {});
            const pncOrder = String(row.order_by || "empresa_id").trim() as ProductoNoConformeOrderKey;
            const rows = await queryProductoNoConformeRows(reportDb, mf, pncOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildProductoNoConformeExcelIndividual(rows, row.nombre)
                    : await buildProductoNoConformeExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "registro_induccion_recorrido") {
            const mf = normalizeInduccionRecorridoFilters(parsed.moduleFilters || {});
            const irOrder = String(row.order_by || "empresa_id").trim() as InduccionRecorridoOrderKey;
            const rows = await queryInduccionRecorridoRows(reportDb, mf, irOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const buf =
                reportType === "Individual"
                    ? await buildInduccionRecorridoExcelIndividual(rows, row.nombre)
                    : await buildInduccionRecorridoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "manuales_puesto") {
            const mf = normalizeManualesPuestoFilters(parsed.moduleFilters || {});
            const mpOrder = String(row.order_by || "title").trim() as ManualesPuestoOrderKey;
            const rows = await queryManualesPuestoRows(reportDb, mf, mpOrder);
            const buf = await buildManualesPuestoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "articulos_puesto") {
            const mf = normalizeArticulosPuestoFilters(parsed.moduleFilters || {});
            const apOrder = String(row.order_by || "empresa_id").trim() as ArticulosPuestoOrderKey;
            const rows = await queryArticulosPuestoRows(reportDb, mf, apOrder);
            const buf = await buildArticulosPuestoExcelConsolidado(reportDb, rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "mantenimiento_articulos") {
            const mf = normalizeMantenimientoArticulosFilters(parsed.moduleFilters || {});
            const maOrder = String(row.order_by || "puesto_id").trim() as MantenimientoArticulosOrderKey;
            const rows = await queryMantenimientoArticulosRows(reportDb, mf, maOrder);
            const buf = await buildMantenimientoArticulosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "registro_vehiculos_corporativos") {
            const mf = normalizeRegistroVehiculosCorporativosFilters(parsed.moduleFilters || {});
            const rvcOrder = String(row.order_by || "puesto_id").trim() as RegistroVehiculosCorporativosOrderKey;
            const rows = await queryRegistroVehiculosCorporativosRows(reportDb, mf, rvcOrder);
            const buf = await buildRegistroVehiculosCorporativosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "revision_vehiculos") {
            const mf = normalizeRevisionVehiculosFilters(parsed.moduleFilters || {});
            const revOrder = String(row.order_by || "puesto_id").trim() as RevisionVehiculosOrderKey;
            const rows = await queryRevisionVehiculosRows(reportDb, mf, revOrder);
            const reportType = resolveMobileReportTipoFromRow(row);
            const buf =
                reportType === "Individual"
                    ? await buildRevisionVehiculosExcelIndividual(rows, String(row.nombre ?? ""))
                    : await buildRevisionVehiculosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "registro_visitas") {
            const mf = normalizeRegistroVisitasFilters(parsed.moduleFilters || {});
            const rvOrder = String(row.order_by || "empresa_id").trim() as RegistroVisitasOrderKey;
            const rows = await queryRegistroVisitasRows(reportDb, mf, rvOrder);
            const reportType = String(row.tipo_reporte || "Grupal").trim();
            const ext = reportType === "Individual" ? "zip" : "xlsx";
            const buf =
                reportType === "Individual"
                    ? await buildRegistroVisitasIndividualZip(rows, String(row.nombre ?? ""))
                    : await buildRegistroVisitasExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }

        if (moduleKey === "notas_voz") {
            const mf = normalizeNotasVozFilters(parsed.moduleFilters || {});
            const nvOrder = String(row.order_by || "empresa_id").trim() as NotasVozOrderKey;
            const rows = await queryNotasVozRows(reportDb, mf, nvOrder);
            const buf = await buildNotasVozExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "cambios_ubicacion_puesto") {
            const mf = normalizeCambiosUbicacionPuestoFilters(parsed.moduleFilters || {});
            const cupOrder = String(row.order_by || "empresa_id").trim() as CambiosUbicacionPuestoOrderKey;
            const rows = await queryCambiosUbicacionPuestoRows(reportDb, mf, cupOrder);
            const buf = await buildCambiosUbicacionPuestoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "registro_capacitaciones") {
            const mf = normalizeRegistroCapacitacionesFilters(parsed.moduleFilters || {});
            const rcOrder = String(row.order_by || "empresa_id").trim() as RegistroCapacitacionesOrderKey;
            const rows = await queryRegistroCapacitacionesRows(reportDb, mf, rcOrder);
            const buf = await buildRegistroCapacitacionesExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "registro_induccion_general") {
            const mf = normalizeRegistroInduccionGeneralFilters(parsed.moduleFilters || {});
            const rigOrder = String(row.order_by || "empresa_id").trim() as RegistroInduccionGeneralOrderKey;
            const rows = await queryRegistroInduccionGeneralRows(reportDb, mf, rigOrder);
            const reportType = resolveMobileReportTipoFromRow(row);
            const isIndividual = reportType === "Individual";
            const ext = isIndividual ? "zip" : "xlsx";
            const buf = isIndividual
                ? await buildRegistroInduccionGeneralIndividualZip(rows, row.nombre)
                : await buildRegistroInduccionGeneralExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }

        if (moduleKey === "tiempo_almuerzo") {
            const mf = normalizeTiempoAlmuerzoFilters(parsed.moduleFilters || {});
            const taOrder = String(row.order_by || "empresa_id").trim() as TiempoAlmuerzoOrderKey;
            const rows = await queryTiempoAlmuerzoRows(reportDb, mf, taOrder);
            const buf = await buildTiempoAlmuerzoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "login_marca") {
            const mf = normalizeLoginMarcaFilters(parsed.moduleFilters || {});
            const lmOrder = String(row.order_by || "cedula_empleado").trim() as LoginMarcaOrderKey;
            const rows = await queryLoginMarcaRows(reportDb, mf, lmOrder);
            const buf = await buildLoginMarcaExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: "xlsx" });
            return;
        }

        if (moduleKey === "solicitudes_permiso") {
            const mf = normalizeSolicitudesPermisoFilters(parsed.moduleFilters || {});
            const spOrder = String(row.order_by || "empresa_id").trim() as SolicitudesPermisoOrderKey;
            const rows = await querySolicitudesPermisoRows(reportDb, mf, spOrder);
            const reportType = resolveMobileReportTipoFromRow(row);
            const isIndividual = reportType === "Individual";
            const ext = isIndividual ? "xlsx" : "xlsx";
            const buf = isIndividual
                ? await buildSolicitudesPermisoExcelIndividual(rows, row.nombre)
                : await buildSolicitudesPermisoExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }

        if (moduleKey === "visitas_vehiculos") {
            const mf = normalizeVisitasVehiculosFilters(parsed.moduleFilters || {});
            const vvOrder = String(row.order_by || "empresa_id").trim() as VisitasVehiculosOrderKey;
            const rows = await queryVisitasVehiculosRows(reportDb, mf, vvOrder);
            const reportType = resolveMobileReportTipoFromRow(row);
            const isIndividual = reportType === "Individual";
            const ext = isIndividual ? "zip" : "xlsx";
            const buf = isIndividual
                ? await buildVisitasVehiculosIndividualZip(rows, String(row.nombre ?? ""))
                : await buildVisitasVehiculosExcelConsolidado(rows);
            await completeReportJob({ req, reportDb: queueDb, reportId, row, buffer: buf, extension: ext });
            return;
        }

        await queueDb.e_reportes_mobile.update({
            where: { id: reportId },
            data: {
                estado: "error",
                error_message: `Módulo de reporte no soportado: ${moduleKey}`,
            },
        });
    } catch (e) {
        console.error("runMobileReportJob", reportId, e);
        const msg = e instanceof Error ? e.message : String(e);
        await queueDb.e_reportes_mobile.update({
            where: { id: reportId },
            data: { estado: "error", error_message: msg },
        });
    }
}
