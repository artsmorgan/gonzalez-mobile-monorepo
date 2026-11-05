/**
 * Control de acceso por operación de `/api/reportes` (issue #169).
 *
 * `executeReportesOperation` solo comprobaba que el JWT fuera válido: cualquier empleado podía ejecutar CUALQUIER operación, incluidas las de
 * administración (`purgeOldReports`, `previewUserLoginRefreshTokens`). Ahora cada operación tiene una entrada EXPLÍCITA en esta tabla y lo que
 * no está en ella se **deniega** (una operación nueva sin entrada queda cerrada hasta que alguien decida quién la puede usar).
 *
 * - `authenticated`: cualquier empleado con sesión válida (el comportamiento de siempre para los reportes y búsquedas).
 * - `admin`: solo administración = empleados de `n_employees_superadmin` (el mismo criterio que Nomencladores y Módulos liberados).
 */
export type ReportesAccess = "authenticated" | "admin";

export const REPORTES_OPERATIONS: Readonly<Record<string, ReportesAccess>> = {
    // Administración
    purgeOldReports: "admin",
    previewUserLoginRefreshTokens: "admin",

    // Búsquedas y utilidades de las pantallas de reportes
    searchEmployees: "authenticated",
    searchActaStructure: "authenticated",
    searchAlmuerzoCedulas: "authenticated",
    searchCorporateVehicles: "authenticated",
    listReports: "authenticated",
    mobileReportUploadsPath: "authenticated",
    createReportJob: "authenticated",
    createReportePuesto: "authenticated",
    listReportesPuesto: "authenticated",

    // Vistas previas de cada módulo
    previewAccionesPersonales: "authenticated",
    previewActaEntregaProductos: "authenticated",
    previewActividades: "authenticated",
    previewAgendaMinuta: "authenticated",
    previewAperturaCierrePuesto: "authenticated",
    previewArticulosPuesto: "authenticated",
    previewBitacoraNovedades: "authenticated",
    previewCambiosUbicacionPuesto: "authenticated",
    previewChecklistSupervision: "authenticated",
    previewControlAsistencia: "authenticated",
    previewDocumentosEntregados: "authenticated",
    previewEncuestaSatisfaccion: "authenticated",
    previewEntregaPuesto: "authenticated",
    previewEvaluacionPersonal: "authenticated",
    previewIncidentes: "authenticated",
    previewInduccionRecorrido: "authenticated",
    previewLlaveros: "authenticated",
    previewLlaves: "authenticated",
    previewLoginMarca: "authenticated",
    previewMaestroQuejas: "authenticated",
    previewMantenimientoArticulos: "authenticated",
    previewManualesPuesto: "authenticated",
    previewMutuosAcuerdos: "authenticated",
    previewNotasVoz: "authenticated",
    previewProductoNoConforme: "authenticated",
    previewRegistroCapacitaciones: "authenticated",
    previewRegistroInduccionGeneral: "authenticated",
    previewRegistroVehiculosCorporativos: "authenticated",
    previewRegistroVisitas: "authenticated",
    previewRevisionVehiculos: "authenticated",
    previewSolicitudesPermiso: "authenticated",
    previewTiempoAlmuerzo: "authenticated",
    previewVisitasVehiculos: "authenticated",
    previewVulnerabilidad: "authenticated",
};

/** Error de `/api/reportes` con el código HTTP que le corresponde (403 por permiso, no un 500 genérico). */
export class ReportesApiError extends Error {
    constructor(
        message: string,
        public readonly httpStatus: number,
    ) {
        super(message);
        this.name = "ReportesApiError";
    }
}

export type ReportesAuthorization = { ok: true } | { ok: false; httpStatus: 403; message: string };

/** `isAdmin` es perezoso: solo se consulta (a la base) cuando la operación lo exige. */
export type ReportesActor = { empleadoId: number; isAdmin: () => Promise<boolean> };

/** ¿Puede este empleado ejecutar la operación? Lo que no está en la tabla se deniega. */
export async function authorizeReportesOperation(operation: string, actor: ReportesActor): Promise<ReportesAuthorization> {
    const op = String(operation ?? "").trim();
    const required = Object.prototype.hasOwnProperty.call(REPORTES_OPERATIONS, op) ? REPORTES_OPERATIONS[op] : undefined;
    if (!required) {
        return { ok: false, httpStatus: 403, message: "Operación no permitida" };
    }
    if (required === "authenticated") {
        return Number.isFinite(actor.empleadoId) && actor.empleadoId > 0 ? { ok: true } : { ok: false, httpStatus: 403, message: "Operación no permitida" };
    }
    let admin = false;
    try {
        admin = Number.isFinite(actor.empleadoId) && actor.empleadoId > 0 && (await actor.isAdmin());
    } catch {
        admin = false; // ante cualquier fallo al consultar el rol se deniega
    }
    return admin ? { ok: true } : { ok: false, httpStatus: 403, message: "No tienes permiso para esta operación" };
}
