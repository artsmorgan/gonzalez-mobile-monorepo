/* eslint-disable @typescript-eslint/no-explicit-any */
import { toZonedTime } from "date-fns-tz";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utils/prismaClient";
import { resolveReportMobileAbsolutePath } from "../../../../utils/reportesMobileFile";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../../utils/verifyTokenFromBody";
import {
    normalizeActaEntregaFilters,
    queryActaEntregaProductos,
    type ActaEntregaModuleFilters,
    type ActaEntregaOrderKey,
} from "../../../../utils/reports-functions/actaEntregaProductos";
import {
    collectEmpleadoIngresoIdsFromFilters,
    queryRefreshTokensUserLogin,
    type UserLoginModuleFilters,
    type UserLoginOrderKey,
} from "../../../../utils/reports-functions/userLogin";
import { purgeOldMobileReports } from "../../../../utils/purgeOldMobileReports";
import { DEFAULT_REPORT_MAX_ATTEMPTS } from "../../../../utils/reportJobQueue";
import {
    normalizeMobileReportTipo,
    resolveMobileReportTipoFromModuleFilters,
} from "../../../../utils/mobileReportTipo";
import {
    filtersMatchAgendaListQuery,
    hasAgendaListModuleFiltersContent,
    normalizeAgendaMinutaFilters,
    queryAgendaMinutaReportRows,
    type AgendaMinutaModuleFilters,
    type AgendaMinutaOrderKey,
} from "../../../../utils/reports-functions/agendaMinutaReport";
import {
    filtersMatchAperturaCierreListQuery,
    hasAperturaCierreListModuleFiltersContent,
    normalizeAperturaCierrePuestoFilters,
    queryAperturaCierrePuestoRows,
    type AperturaCierrePuestoModuleFilters,
    type AperturaCierrePuestoOrderKey,
} from "../../../../utils/reports-functions/aperturaCierrePuestoReport";
import {
    filtersMatchVulnerabilidadListQuery,
    hasVulnerabilidadListModuleFiltersContent,
    normalizeVulnerabilidadFilters,
    queryVulnerabilidadRows,
    type VulnerabilidadModuleFilters,
    type VulnerabilidadOrderKey,
} from "../../../../utils/reports-functions/vulnerabilidadReport";
import {
    filtersMatchActividadesListQuery,
    hasActividadesListModuleFiltersContent,
    normalizeActividadesFilters,
    queryActividadesReportRows,
    type ActividadesModuleFilters,
    type ActividadesOrderKey,
} from "../../../../utils/reports-functions/actividadesReport";
import {
    filtersMatchControlAsistenciaListQuery,
    hasControlAsistenciaListModuleFiltersContent,
    normalizeControlAsistenciaFilters,
    queryControlAsistenciaRows,
    type ControlAsistenciaModuleFilters,
    type ControlAsistenciaOrderKey,
} from "../../../../utils/reports-functions/controlAsistenciaReport";
import {
    filtersMatchDocumentosEntregadosListQuery,
    hasDocumentosEntregadosListModuleFiltersContent,
    normalizeDocumentosEntregadosFilters,
    queryDocumentosEntregadosRows,
    type DocumentosEntregadosModuleFilters,
    type DocumentosEntregadosOrderKey,
} from "../../../../utils/reports-functions/documentosEntregadosReport";
import {
    filtersMatchEncuestaSatisfaccionListQuery,
    hasEncuestaSatisfaccionListModuleFiltersContent,
    normalizeEncuestaSatisfaccionFilters,
    queryEncuestaSatisfaccionRows,
    type EncuestaSatisfaccionOrderKey,
} from "../../../../utils/reports-functions/encuestaSatisfaccionReport";
import {
    filtersMatchMutuosAcuerdosListQuery,
    hasMutuosAcuerdosListModuleFiltersContent,
    normalizeMutuosAcuerdosFilters,
    queryMutuosAcuerdosRows,
    type MutuosAcuerdosOrderKey,
} from "../../../../utils/reports-functions/mutuosAcuerdosReport";
import {
    filtersMatchAccionesPersonalesListQuery,
    hasAccionesPersonalesListModuleFiltersContent,
    normalizeAccionesPersonalesFilters,
    queryAccionesPersonalesRows,
    type AccionesPersonalesModuleFilters,
    type AccionesPersonalesOrderKey,
} from "../../../../utils/reports-functions/accionesPersonalesReport";
import {
    filtersMatchEntregaPuestoListQuery,
    hasEntregaPuestoListModuleFiltersContent,
    normalizeEntregaPuestoFilters,
    queryEntregaPuestoRows,
    type EntregaPuestoModuleFilters,
    type EntregaPuestoOrderKey,
} from "../../../../utils/reports-functions/entregaPuestoReport";
import {
    filtersMatchIncidenteListQuery,
    hasIncidenteListModuleFiltersContent,
    normalizeIncidenteFilters,
    queryIncidenteRows,
    type IncidenteModuleFilters,
    type IncidenteOrderKey,
} from "../../../../utils/reports-functions/incidentesReport";
import {
    filtersMatchLlavesListQuery,
    hasLlavesListModuleFiltersContent,
    normalizeLlavesFilters,
    queryLlavesRows,
    type LlavesModuleFilters,
    type LlavesOrderKey,
} from "../../../../utils/reports-functions/llavesReport";
import {
    filtersMatchLlaverosListQuery,
    hasLlaverosListModuleFiltersContent,
    normalizeLlaverosFilters,
    queryLlaverosRows,
    type LlaverosModuleFilters,
    type LlaverosOrderKey,
} from "../../../../utils/reports-functions/llaverosReport";
import {
    filtersMatchBitacoraNovedadesListQuery,
    hasBitacoraNovedadesListModuleFiltersContent,
    normalizeBitacoraNovedadesFilters,
    queryBitacoraNovedadesRows,
    type BitacoraNovedadesModuleFilters,
    type BitacoraNovedadesOrderKey,
} from "../../../../utils/reports-functions/bitacoraNovedadesReport";
import {
    filtersMatchMaestroQuejasListQuery,
    hasMaestroQuejasListModuleFiltersContent,
    normalizeMaestroQuejasFilters,
    queryMaestroQuejasRows,
    type MaestroQuejasModuleFilters,
    type MaestroQuejasOrderKey,
} from "../../../../utils/reports-functions/maestroQuejasReport";
import {
    filtersMatchChecklistSupervisionListQuery,
    hasChecklistSupervisionListModuleFiltersContent,
    normalizeChecklistSupervisionFilters,
    queryChecklistSupervisionRows,
    type ChecklistSupervisionModuleFilters,
    type ChecklistSupervisionOrderKey,
} from "../../../../utils/reports-functions/checklistSupervisionReport";
import {
    filtersMatchEvaluacionPersonalListQuery,
    hasEvaluacionPersonalListModuleFiltersContent,
    normalizeEvaluacionPersonalFilters,
    queryEvaluacionEmpleadoRows,
    type EvaluacionPersonalOrderKey,
} from "../../../../utils/reports-functions/evaluacionEmpleadoReport";
import {
    filtersMatchProductoNoConformeListQuery,
    hasProductoNoConformeListModuleFiltersContent,
    normalizeProductoNoConformeFilters,
    queryProductoNoConformeRows,
    type ProductoNoConformeModuleFilters,
    type ProductoNoConformeOrderKey,
} from "../../../../utils/reports-functions/productoNoConformeReport";
import {
    filtersMatchInduccionRecorridoListQuery,
    hasInduccionRecorridoListModuleFiltersContent,
    normalizeInduccionRecorridoFilters,
    queryInduccionRecorridoRows,
    type InduccionRecorridoModuleFilters,
    type InduccionRecorridoOrderKey,
} from "../../../../utils/reports-functions/induccionRecorridoReport";
import {
    filtersMatchManualesPuestoListQuery,
    hasManualesPuestoListModuleFiltersContent,
    normalizeManualesPuestoFilters,
    queryManualesPuestoRows,
    type ManualesPuestoOrderKey,
} from "../../../../utils/reports-functions/manualesPuestoReport";
import {
    filtersMatchArticulosPuestoListQuery,
    hasArticulosPuestoListModuleFiltersContent,
    normalizeArticulosPuestoFilters,
    queryArticulosPuestoRows,
    type ArticulosPuestoOrderKey,
} from "../../../../utils/reports-functions/articulosPuestoReport";
import {
    filtersMatchMantenimientoArticulosListQuery,
    hasMantenimientoArticulosListModuleFiltersContent,
    normalizeMantenimientoArticulosFilters,
    queryMantenimientoArticulosRows,
    type MantenimientoArticulosOrderKey,
} from "../../../../utils/reports-functions/mantenimientoArticulosReport";
import {
    filtersMatchRegistroVehiculosCorporativosListQuery,
    hasRegistroVehiculosCorporativosListModuleFiltersContent,
    normalizeRegistroVehiculosCorporativosFilters,
    queryRegistroVehiculosCorporativosRows,
    type RegistroVehiculosCorporativosOrderKey,
} from "../../../../utils/reports-functions/registroVehiculosCorporativosReport";
import {
    filtersMatchRevisionVehiculosListQuery,
    hasRevisionVehiculosListModuleFiltersContent,
    normalizeRevisionVehiculosFilters,
    queryRevisionVehiculosRows,
    searchCorporateVehiclesForReport,
    type RevisionVehiculosOrderKey,
} from "../../../../utils/reports-functions/revisionVehiculosReport";
import {
    filtersMatchRegistroVisitasListQuery,
    hasRegistroVisitasListModuleFiltersContent,
    normalizeRegistroVisitasFilters,
    queryRegistroVisitasRows,
    type RegistroVisitasOrderKey,
} from "../../../../utils/reports-functions/registroVisitasReport";
import {
    filtersMatchNotasVozListQuery,
    hasNotasVozListModuleFiltersContent,
    normalizeNotasVozFilters,
    queryNotasVozRows,
    type NotasVozOrderKey,
} from "../../../../utils/reports-functions/notasVozReport";
import {
    filtersMatchCambiosUbicacionPuestoListQuery,
    hasCambiosUbicacionPuestoListModuleFiltersContent,
    normalizeCambiosUbicacionPuestoFilters,
    queryCambiosUbicacionPuestoRows,
    type CambiosUbicacionPuestoOrderKey,
} from "../../../../utils/reports-functions/cambiosUbicacionPuestoReport";
import {
    filtersMatchRegistroCapacitacionesListQuery,
    hasRegistroCapacitacionesListModuleFiltersContent,
    normalizeRegistroCapacitacionesFilters,
    queryRegistroCapacitacionesRows,
    type RegistroCapacitacionesOrderKey,
} from "../../../../utils/reports-functions/registroCapacitacionesReport";
import {
    filtersMatchRegistroInduccionGeneralListQuery,
    hasRegistroInduccionGeneralListModuleFiltersContent,
    normalizeRegistroInduccionGeneralFilters,
    queryRegistroInduccionGeneralRows,
    type RegistroInduccionGeneralOrderKey,
} from "../../../../utils/reports-functions/registroInduccionGeneralReport";
import {
    filtersMatchTiempoAlmuerzoListQuery,
    hasTiempoAlmuerzoListModuleFiltersContent,
    normalizeTiempoAlmuerzoFilters,
    queryTiempoAlmuerzoRows,
    type TiempoAlmuerzoOrderKey,
} from "../../../../utils/reports-functions/tiempoAlmuerzoReport";
import {
    filtersMatchSolicitudesPermisoListQuery,
    hasSolicitudesPermisoListModuleFiltersContent,
    normalizeSolicitudesPermisoFilters,
    querySolicitudesPermisoRows,
    type SolicitudesPermisoOrderKey,
} from "../../../../utils/reports-functions/solicitudesPermisoReport";
import {
    filtersMatchVisitasVehiculosListQuery,
    hasVisitasVehiculosListModuleFiltersContent,
    normalizeVisitasVehiculosFilters,
    queryVisitasVehiculosRows,
    type VisitasVehiculosOrderKey,
} from "../../../../utils/reports-functions/visitasVehiculosReport";

type ReportesPayload = {
    token?: string;
    mobileAccessToken?: string;
    shouldVerifyAccessToken?: boolean;
    operation?: string;
    /** Búsqueda empleados */
    q?: string;
    entity?: "empresa" | "cliente" | "division" | "contrato" | "corpo" | "puesto" | "plaza" | "llavero" | "ejecutivo";
    /** listReports */
    modulo?: string;
    nombreContains?: string;
    numeroContains?: string;
    nomenclaturaContains?: string;
    descripcionContains?: string;
    tipoReporte?: string;
    estado?: string;
    createdByIds?: number[];
    fechaInicio?: string;
    fechaFin?: string;
    listModuleFilters?:
        | UserLoginModuleFilters
        | ActaEntregaModuleFilters
        | AgendaMinutaModuleFilters
        | AperturaCierrePuestoModuleFilters
        | VulnerabilidadModuleFilters
        | ActividadesModuleFilters
        | ControlAsistenciaModuleFilters
        | DocumentosEntregadosModuleFilters
        | AccionesPersonalesModuleFilters
        | IncidenteModuleFilters
        | LlavesModuleFilters
        | LlaverosModuleFilters
        | BitacoraNovedadesModuleFilters
        | MaestroQuejasModuleFilters
        | ChecklistSupervisionModuleFilters
        | ProductoNoConformeModuleFilters
        | InduccionRecorridoModuleFilters;
    /** previewUserLoginRefreshTokens */
    moduleFilters?:
        | UserLoginModuleFilters
        | ActaEntregaModuleFilters
        | AgendaMinutaModuleFilters
        | AperturaCierrePuestoModuleFilters
        | VulnerabilidadModuleFilters
        | ActividadesModuleFilters
        | ControlAsistenciaModuleFilters
        | DocumentosEntregadosModuleFilters
        | AccionesPersonalesModuleFilters
        | IncidenteModuleFilters
        | LlavesModuleFilters
        | LlaverosModuleFilters
        | BitacoraNovedadesModuleFilters
        | MaestroQuejasModuleFilters
        | ChecklistSupervisionModuleFilters
        | ProductoNoConformeModuleFilters
        | InduccionRecorridoModuleFilters;
    order_by?: string;
    /** createReportJob */
    nombre?: string;
    numero?: string;
    nomenclatura?: string;
    descripcion?: string;
    tipo_reporte?: string;
    firma_responsable?: string;
    /** JSON string opcional con snapshot de filas (solo UI) */
    filters_json?: string;
    /** mobileReportUploadsPath — reporte completado para resolver ruta en `uploads/` */
    reportId?: number;
};

function assertMobileToken(payload: ReportesPayload) {
    const expected = process.env.MOBILE_ACCESS_TOKEN?.trim();
    const incoming = String(payload.mobileAccessToken || "").trim();
    if (!expected) {
        throw new Error("MOBILE_ACCESS_TOKEN no configurado en el servidor");
    }
    if (!incoming || incoming !== expected) {
        throw new Error("mobileAccessToken inválido");
    }
}

function getJwtPayload(req: NextRequest, payload: ReportesPayload) {
    const shouldVerify = payload.shouldVerifyAccessToken !== false;
    const headerVal = verifyAccessToken(req);
    const bodyVal = verifyTokenFromBody(payload.token);
    const tokenValidation = headerVal.valid ? headerVal : bodyVal;
    if (shouldVerify && !tokenValidation.valid) {
        const status = tokenValidation.expired ? 401 : 403;
        return { ok: false as const, status, message: tokenValidation.message };
    }
    const id = (tokenValidation.payload as any)?.id;
    if (shouldVerify && (id === undefined || id === null)) {
        return { ok: false as const, status: 403, message: "Token sin id de empleado" };
    }
    return { ok: true as const, empleadoId: Number(id), payload: tokenValidation.payload };
}

function formatEmpleadoNombre(e: {
    nombre?: string | null;
    primer_apellido?: string | null;
    segundo_apellido?: string | null;
    codigo?: string | null;
}): string {
    const parts = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(
        (p) => p != null && String(p).trim() !== "",
    );
    const name = parts.map((p) => String(p).trim()).join(" ").trim();
    if (name) return name;
    const cod = e.codigo != null ? String(e.codigo).trim() : "";
    return cod || "—";
}

async function enrichReportRowsWithCreatorNames<
    T extends { created_by: number; created_at: Date | string },
>(rows: T[]) {
    const creatorIds = [
        ...new Set(rows.map((r) => Number(r.created_by)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    const empleados =
        creatorIds.length > 0
            ? await prisma.c_empleado.findMany({
                  where: { id: { in: creatorIds } },
                  select: {
                      id: true,
                      nombre: true,
                      primer_apellido: true,
                      segundo_apellido: true,
                      codigo: true,
                  },
              })
            : [];
    const byId = new Map(empleados.map((e) => [e.id, e]));
    return rows.map((r) => {
        const emp = byId.get(Number(r.created_by));
        const createdAt = r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at;
        return {
            ...r,
            created_at: createdAt,
            created_by_nombre: emp ? formatEmpleadoNombre(emp) : null,
        };
    });
}

function parseDayStart(s?: string): Date | undefined {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    return new Date(`${s}T00:00:00.000Z`);
}

function parseDayEnd(s?: string): Date | undefined {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    return new Date(`${s}T23:59:59.999Z`);
}

/** Ids de «usuario que ingresó» guardados en `filters.moduleFilters` (soporta legacy solo `empleadoIngresoId` o lista). */
function collectSavedIngresoIds(mf: Record<string, unknown>): number[] {
    const out: number[] = [];
    const single = mf.empleadoIngresoId;
    if (single != null && single !== "") {
        const n = Number(single);
        if (Number.isFinite(n) && n > 0) out.push(n);
    }
    const arr = mf.empleadoIngresoIds;
    if (Array.isArray(arr)) {
        for (const x of arr) {
            const n = Number(x);
            if (Number.isFinite(n) && n > 0) out.push(n);
        }
    }
    return [...new Set(out)];
}

/** Acepta objeto o JSON string (algunos clientes serializan mal el body). */
function coerceModuleFiltersInput(raw: unknown): unknown {
    if (raw == null) return {};
    if (typeof raw === "string") {
        try {
            const p = JSON.parse(raw);
            return typeof p === "object" && p !== null && !Array.isArray(p) ? p : {};
        } catch {
            return {};
        }
    }
    return raw;
}

/** Normaliza filtros enviados por cliente / proxy (arrays, strings con comas). */
function normalizeUserLoginModuleFilters(raw: unknown): UserLoginModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: UserLoginModuleFilters = {};
    const cds = o.creadoDesde;
    const chs = o.creadoHasta;
    if (cds != null && String(cds).trim() !== "") next.creadoDesde = String(cds);
    if (chs != null && String(chs).trim() !== "") next.creadoHasta = String(chs);
    if (o.soloMultiDispositivo === true || o.soloMultiDispositivo === 1 || o.soloMultiDispositivo === "1") {
        next.soloMultiDispositivo = true;
    }

    let ids: number[] = [];
    if (o.empleadoIngresoId != null && o.empleadoIngresoId !== "") {
        const n = Number(o.empleadoIngresoId);
        if (Number.isFinite(n) && n > 0) ids.push(n);
    }
    if (Array.isArray(o.empleadoIngresoIds)) {
        for (const x of o.empleadoIngresoIds) {
            const n = Number(x);
            if (Number.isFinite(n) && n > 0) ids.push(n);
        }
    } else if (typeof o.empleadoIngresoIds === "string" && String(o.empleadoIngresoIds).trim() !== "") {
        ids.push(
            ...String(o.empleadoIngresoIds)
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n > 0),
        );
    }
    ids = [...new Set(ids)];
    /* Siempre exponer lista para preview/consultas; un solo id también va en el array para un solo código de ruta. */
    if (ids.length > 0) {
        next.empleadoIngresoIds = ids;
    }
    return next;
}

function hasListModuleFiltersContent(f: UserLoginModuleFilters): boolean {
    if (f.empleadoIngresoId != null) return true;
    if (f.empleadoIngresoIds != null && f.empleadoIngresoIds.length > 0) return true;
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.soloMultiDispositivo) return true;
    return false;
}

function hasActaListModuleFiltersContent(f: ActaEntregaModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds && f.empresaIds.length > 0) return true;
    if (f.clienteIds && f.clienteIds.length > 0) return true;
    if (f.divisionIds && f.divisionIds.length > 0) return true;
    if (f.contratoIds && f.contratoIds.length > 0) return true;
    if (f.corpoIds && f.corpoIds.length > 0) return true;
    if (f.puestoIds && f.puestoIds.length > 0) return true;
    return false;
}

function parseCreatedByIdsPayload(raw: unknown): number[] {
    if (Array.isArray(raw)) {
        return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    }
    if (typeof raw === "string" && raw.trim() !== "") {
        return raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
    }
    return [];
}

function filtersMatchListQuery(parsedRowFilters: any, listModuleFilters?: UserLoginModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const wanted = collectEmpleadoIngresoIdsFromFilters(listModuleFilters);
    const savedIds = collectSavedIngresoIds(mf);

    if (wanted.length > 0) {
        const overlaps = savedIds.some((id) => wanted.includes(id));
        if (!overlaps) return false;
    }
    if (listModuleFilters.creadoDesde && String(mf.creadoDesde ?? "") !== String(listModuleFilters.creadoDesde)) {
        return false;
    }
    if (listModuleFilters.creadoHasta && String(mf.creadoHasta ?? "") !== String(listModuleFilters.creadoHasta)) {
        return false;
    }
    if (listModuleFilters.soloMultiDispositivo) {
        if (!Boolean(mf.soloMultiDispositivo)) return false;
    }
    return true;
}

function filtersMatchActaListQuery(parsedRowFilters: any, listModuleFilters?: ActaEntregaModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeActaEntregaFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    return true;
}

export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as ReportesPayload;
        assertMobileToken(payload);

        const auth = getJwtPayload(req, payload);
        if (!auth.ok) {
            return NextResponse.json({ status: false, message: auth.message }, { status: auth.status });
        }

        const op = String(payload.operation || "").trim();

        if (op === "purgeOldReports") {
            const result = await purgeOldMobileReports(prisma);
            return NextResponse.json({ status: true, data: result }, { status: 200 });
        }

        if (op === "searchEmployees") {
            const q = String(payload.q || "").trim();
            if (q.length < 1) {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
            const rows = await prisma.c_empleado.findMany({
                where: {
                    OR: [
                        { codigo: { contains: q } },
                        { nombre: { contains: q } },
                        { primer_apellido: { contains: q } },
                        { segundo_apellido: { contains: q } },
                    ],
                    NOT: [{ cedula: { contains: "@" } }],
                },
                take: 50,
                select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                    primer_apellido: true,
                    segundo_apellido: true,
                },
            });
            return NextResponse.json({ status: true, data: rows }, { status: 200 });
        }

        if (op === "searchActaStructure") {
            const entity = String(payload.entity || "").trim();
            const q = String(payload.q || "").trim();
            if (!entity) {
                return NextResponse.json({ status: false, message: "entity es obligatorio" }, { status: 400 });
            }
            if (q.length < 1) {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
            const now = new Date();
            const activeOrNoInactiveDate = [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: now } }];
            if (entity === "empresa") {
                const rows = await prisma.e_estructura_empresa.findMany({
                    where: {
                        deleted: null,
                        OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }],
                        NOT: [{ cedula_juridica: { contains: "@" } }],
                    },
                    take: 50,
                    select: { id: true, nombre: true, codigo: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "cliente") {
                const numId = Number(q);
                const idMatch = Number.isFinite(numId) && numId > 0 && String(numId) === q.trim();
                const andParts: any[] = [{ OR: activeOrNoInactiveDate }, { nombre: { not: { contains: "@" } } }];
                if (idMatch) andParts.push({ OR: [{ id: numId }, { nombre: { contains: q } }] });
                else andParts.push({ nombre: { contains: q } });
                const rows = await prisma.e_estructura_cliente.findMany({
                    where: { deleted: null, AND: andParts },
                    take: 50,
                    select: { id: true, nombre: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "division") {
                
                const rows = await prisma.n_division.findMany({
                    where: {
                        OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }],
                    },
                    take: 50,
                    select: { id: true, nombre: true, codigo: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "contrato") {
                const rows = await prisma.e_estructura_contrato.findMany({
                    where: {
                        deleted: null,
                        AND: [
                            { OR: activeOrNoInactiveDate },
                            {
                                OR: [{ nombre: { contains: q } }, { nro_contrato: { contains: q } }],
                            },
                        ],
                        nombre: { not: { contains: "@" } },
                    } as any,
                    take: 50,
                    select: { id: true, nombre: true, nro_contrato: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "corpo") {
                const rows = await prisma.e_estructura_sucursal.findMany({
                    where: {
                        deleted: null,
                        AND: [
                            { OR: activeOrNoInactiveDate },
                            {
                                OR: [{ nombre: { contains: q } }, { nro_sucursal: { contains: q } }],
                            },
                        ],
                        nro_sucursal: { not: { contains: "@" } },
                    } as any,
                    take: 50,
                    select: { id: true, nombre: true, nro_sucursal: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "puesto") {
                const rows = await prisma.e_estructura_puesto.findMany({
                    where: {
                        deleted: null,
                        AND: [
                            { OR: activeOrNoInactiveDate },
                            {
                                OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }],
                            },
                        ],
                        codigo: { not: { contains: "@" } },
                    } as any,
                    take: 50,
                    select: { id: true, nombre: true, codigo: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            if (entity === "plaza") {
                const rows = await prisma.e_estructura_plazas.findMany({
                    where: {
                        deleted: null,
                        AND: [
                            { OR: activeOrNoInactiveDate },
                            {
                                OR: [{ nombre: { contains: q } }, { codigo_plaza: { contains: q } }],
                            },
                        ],
                        codigo_plaza: { not: { contains: "@" } },
                    } as any,
                    take: 50,
                    select: { id: true, nombre: true, codigo_plaza: true },
                    orderBy: { nombre: "asc" },
                });
                const mapped = rows.map((r) => ({
                    id: r.id,
                    nombre: r.nombre,
                    codigo: r.codigo_plaza ?? null,
                }));
                return NextResponse.json({ status: true, data: mapped }, { status: 200 });
            }
            if (entity === "llavero") {
                const rows = await prisma.e_llavero.findMany({
                    where: {
                        isActive: true,
                        nombre_llavero: { contains: q },
                    },
                    take: 50,
                    select: { id: true, nombre_llavero: true },
                    orderBy: { nombre_llavero: "asc" },
                });
                const mapped = rows.map((r) => ({
                    id: r.id,
                    nombre: r.nombre_llavero,
                }));
                return NextResponse.json({ status: true, data: mapped }, { status: 200 });
            }
            if (entity === "ejecutivo") {
                const rows = await prisma.n_ejecutivo_cuenta.findMany({
                    where: { nombre: { contains: q } },
                    take: 50,
                    select: { id: true, nombre: true },
                    orderBy: { nombre: "asc" },
                });
                return NextResponse.json({ status: true, data: rows }, { status: 200 });
            }
            return NextResponse.json({ status: false, message: `entity no soportada: ${entity}` }, { status: 400 });
        }

        if (op === "searchAlmuerzoCedulas") {
            const q = String(payload.q || "").trim();
            if (q.length < 1) {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
            const rows = await prisma.c_empleado_almuerzo.findMany({
                where: {
                    isActive: true,
                    cedula_empleado: { contains: q },
                },
                take: 200,
                select: { cedula_empleado: true, empleado_nombre: true },
                orderBy: { cedula_empleado: "asc" },
            });
            const seen = new Set<string>();
            const data: { cedula: string; empleado_nombre: string }[] = [];
            for (const r of rows) {
                const cedula = String(r.cedula_empleado || "").trim();
                if (!cedula || seen.has(cedula)) continue;
                seen.add(cedula);
                data.push({
                    cedula,
                    empleado_nombre: String(r.empleado_nombre || "").trim(),
                });
                if (data.length >= 50) break;
            }
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (op === "previewUserLoginRefreshTokens") {
            const mf = normalizeUserLoginModuleFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "nombre_usuario") as UserLoginOrderKey;
            const rows = await queryRefreshTokensUserLogin(prisma, mf, orderKey);
            const slim = rows.map((r) => ({
                id: r.id,
                token: r.token,
                createdAt: r.createdAt,
                expiresAt: r.expiresAt,
                sessionId: r.sessionId,
                revoked: r.revoked,
                empleadoId: r.empleadoId,
                device: r.device,
                c_empleado: r.c_empleado
                    ? {
                          id: r.c_empleado.id,
                          nombre: r.c_empleado.nombre,
                          primer_apellido: r.c_empleado.primer_apellido,
                          segundo_apellido: r.c_empleado.segundo_apellido,
                          codigo: r.c_empleado.codigo,
                      }
                    : null,
            }));
            return NextResponse.json({ status: true, data: slim, count: slim.length }, { status: 200 });
        }

        if (op === "previewActaEntregaProductos") {
            const mf = normalizeActaEntregaFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as ActaEntregaOrderKey;
            const rows = await queryActaEntregaProductos(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewEntregaPuesto") {
            const mf = normalizeEntregaPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as EntregaPuestoOrderKey;
            const rows = await queryEntregaPuestoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewAgendaMinuta") {
            const mf = normalizeAgendaMinutaFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as AgendaMinutaOrderKey;
            const rows = await queryAgendaMinutaReportRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewAperturaCierrePuesto") {
            const mf = normalizeAperturaCierrePuestoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "created_by") as AperturaCierrePuestoOrderKey;
            const rows = await queryAperturaCierrePuestoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewVulnerabilidad") {
            const mf = normalizeVulnerabilidadFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as VulnerabilidadOrderKey;
            const rows = await queryVulnerabilidadRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewActividades") {
            const mf = normalizeActividadesFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "fecha") as ActividadesOrderKey;
            const rows = await queryActividadesReportRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewControlAsistencia") {
            const mf = normalizeControlAsistenciaFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as ControlAsistenciaOrderKey;
            const rows = await queryControlAsistenciaRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewDocumentosEntregados") {
            const mf = normalizeDocumentosEntregadosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as DocumentosEntregadosOrderKey;
            const rows = await queryDocumentosEntregadosRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewEncuestaSatisfaccion") {
            const mf = normalizeEncuestaSatisfaccionFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as EncuestaSatisfaccionOrderKey;
            const rows = await queryEncuestaSatisfaccionRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewMutuosAcuerdos") {
            const mf = normalizeMutuosAcuerdosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as MutuosAcuerdosOrderKey;
            const rows = await queryMutuosAcuerdosRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewAccionesPersonales") {
            const mf = normalizeAccionesPersonalesFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as AccionesPersonalesOrderKey;
            const rows = await queryAccionesPersonalesRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewIncidentes") {
            const mf = normalizeIncidenteFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "created_at") as IncidenteOrderKey;
            const rows = await queryIncidenteRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewLlaves") {
            const mf = normalizeLlavesFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as LlavesOrderKey;
            const rows = await queryLlavesRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewLlaveros") {
            const mf = normalizeLlaverosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as LlaverosOrderKey;
            const rows = await queryLlaverosRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewBitacoraNovedades") {
            const mf = normalizeBitacoraNovedadesFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "titulo") as BitacoraNovedadesOrderKey;
            const rows = await queryBitacoraNovedadesRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewMaestroQuejas") {
            const mf = normalizeMaestroQuejasFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as MaestroQuejasOrderKey;
            const rows = await queryMaestroQuejasRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewChecklistSupervision") {
            const mf = normalizeChecklistSupervisionFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as ChecklistSupervisionOrderKey;
            const rows = await queryChecklistSupervisionRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewEvaluacionPersonal") {
            const mf = normalizeEvaluacionPersonalFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as EvaluacionPersonalOrderKey;
            const rows = await queryEvaluacionEmpleadoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewProductoNoConforme") {
            const mf = normalizeProductoNoConformeFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as ProductoNoConformeOrderKey;
            const rows = await queryProductoNoConformeRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewInduccionRecorrido") {
            const mf = normalizeInduccionRecorridoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as InduccionRecorridoOrderKey;
            const rows = await queryInduccionRecorridoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewManualesPuesto") {
            const mf = normalizeManualesPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "title") as ManualesPuestoOrderKey;
            const rows = await queryManualesPuestoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewArticulosPuesto") {
            const mf = normalizeArticulosPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as ArticulosPuestoOrderKey;
            const rows = await queryArticulosPuestoRows(prisma, mf, orderKey);
            return NextResponse.json(
                { status: true, data: rows.slice(0, 100), count: rows.length },
                { status: 200 },
            );
        }

        if (op === "previewMantenimientoArticulos") {
            const mf = normalizeMantenimientoArticulosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "puesto_id") as MantenimientoArticulosOrderKey;
            const rows = await queryMantenimientoArticulosRows(prisma, mf, orderKey);
            return NextResponse.json(
                { status: true, data: rows.slice(0, 100), count: rows.length },
                { status: 200 },
            );
        }

        if (op === "previewRegistroVehiculosCorporativos") {
            const mf = normalizeRegistroVehiculosCorporativosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "puesto_id") as RegistroVehiculosCorporativosOrderKey;
            const rows = await queryRegistroVehiculosCorporativosRows(prisma, mf, orderKey);
            return NextResponse.json(
                { status: true, data: rows.slice(0, 100), count: rows.length },
                { status: 200 },
            );
        }

        if (op === "previewRevisionVehiculos") {
            const mf = normalizeRevisionVehiculosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "puesto_id") as RevisionVehiculosOrderKey;
            const rows = await queryRevisionVehiculosRows(prisma, mf, orderKey);
            return NextResponse.json(
                { status: true, data: rows.slice(0, 100), count: rows.length },
                { status: 200 },
            );
        }

        if (op === "searchCorporateVehicles") {
            const q = String(payload.q || "").trim();
            if (!q) {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
            const rows = await searchCorporateVehiclesForReport(prisma, q);
            return NextResponse.json({ status: true, data: rows }, { status: 200 });
        }

        if (op === "previewRegistroVisitas") {
            const mf = normalizeRegistroVisitasFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as RegistroVisitasOrderKey;
            const rows = await queryRegistroVisitasRows(prisma, mf, orderKey, { take: 100 });
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }

        if (op === "previewVisitasVehiculos") {
            const mf = normalizeVisitasVehiculosFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as VisitasVehiculosOrderKey;
            const rows = await queryVisitasVehiculosRows(prisma, mf, orderKey, { take: 100 });
            return NextResponse.json({ status: true, data: rows, count: rows.length }, { status: 200 });
        }
        if (op === "previewNotasVoz") {
            const mf = normalizeNotasVozFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as NotasVozOrderKey;
            const rows = await queryNotasVozRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }
        if (op === "previewCambiosUbicacionPuesto") {
            const mf = normalizeCambiosUbicacionPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as CambiosUbicacionPuestoOrderKey;
            const rows = await queryCambiosUbicacionPuestoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }
        if (op === "previewRegistroCapacitaciones") {
            const mf = normalizeRegistroCapacitacionesFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as RegistroCapacitacionesOrderKey;
            const rows = await queryRegistroCapacitacionesRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }

        if (op === "previewRegistroInduccionGeneral") {
            const mf = normalizeRegistroInduccionGeneralFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as RegistroInduccionGeneralOrderKey;
            const rows = await queryRegistroInduccionGeneralRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }

        if (op === "previewTiempoAlmuerzo") {
            const mf = normalizeTiempoAlmuerzoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as TiempoAlmuerzoOrderKey;
            const rows = await queryTiempoAlmuerzoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }

        if (op === "previewSolicitudesPermiso") {
            const mf = normalizeSolicitudesPermisoFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const orderKey = (payload.order_by || "empresa_id") as SolicitudesPermisoOrderKey;
            const rows = await querySolicitudesPermisoRows(prisma, mf, orderKey);
            return NextResponse.json({ status: true, data: rows.slice(0, 100), count: rows.length }, { status: 200 });
        }

        if (op === "listReports") {
            const where: any = {};
            if (payload.modulo) where.modulo = payload.modulo;
            if (payload.nombreContains) {
                where.nombre = { contains: payload.nombreContains };
            }
            if (payload.numeroContains) {
                where.numero = { contains: payload.numeroContains };
            }
            if (payload.nomenclaturaContains) {
                where.nomenclatura = { contains: payload.nomenclaturaContains };
            }
            if (payload.descripcionContains) {
                where.descripcion = { contains: payload.descripcionContains };
            }
            if (payload.tipoReporte) {
                where.tipo_reporte = payload.tipoReporte;
            }
            if (payload.estado) {
                where.estado = String(payload.estado).toLowerCase();
            }
            const createdByIds = parseCreatedByIdsPayload(payload.createdByIds);
            if (createdByIds.length > 0) {
                where.created_by = { in: createdByIds };
            }
            const r0 = parseDayStart(payload.fechaInicio);
            const r1 = parseDayEnd(payload.fechaFin);
            if (r0 || r1) {
                where.created_at = {};
                if (r0) where.created_at.gte = r0;
                if (r1) where.created_at.lte = r1;
            }

            let rows = await prisma.e_reportes_mobile.findMany({
                where,
                orderBy: { id: "desc" },
                take: 300,
            });

            if (payload.modulo === "ingresos_usuario") {
                const listModuleFilters = normalizeUserLoginModuleFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasListModuleFiltersContent(listModuleFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchListQuery(p, listModuleFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "acta_entrega_productos") {
                const listActaFilters = normalizeActaEntregaFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasActaListModuleFiltersContent(listActaFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchActaListQuery(p, listActaFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "agenda_minuta") {
                const listAgendaFilters = normalizeAgendaMinutaFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasAgendaListModuleFiltersContent(listAgendaFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchAgendaListQuery(p, listAgendaFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "apertura_cierre_puesto") {
                const listAcpFilters = normalizeAperturaCierrePuestoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasAperturaCierreListModuleFiltersContent(listAcpFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchAperturaCierreListQuery(p, listAcpFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "apreciacion_vulnerabilidad") {
                const listVulnFilters = normalizeVulnerabilidadFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasVulnerabilidadListModuleFiltersContent(listVulnFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchVulnerabilidadListQuery(p, listVulnFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "actividades") {
                const listActivFilters = normalizeActividadesFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasActividadesListModuleFiltersContent(listActivFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchActividadesListQuery(p, listActivFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "control_asistencia") {
                const listAsisFilters = normalizeControlAsistenciaFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasControlAsistenciaListModuleFiltersContent(listAsisFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchControlAsistenciaListQuery(p, listAsisFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "documentos_entregados") {
                const listDocFilters = normalizeDocumentosEntregadosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasDocumentosEntregadosListModuleFiltersContent(listDocFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchDocumentosEntregadosListQuery(p, listDocFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "encuesta_satisfaccion") {
                const listEncFilters = normalizeEncuestaSatisfaccionFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasEncuestaSatisfaccionListModuleFiltersContent(listEncFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchEncuestaSatisfaccionListQuery(p, listEncFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "acciones_personales") {
                const listApFilters = normalizeAccionesPersonalesFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasAccionesPersonalesListModuleFiltersContent(listApFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchAccionesPersonalesListQuery(p, listApFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "entrega_puesto") {
                const listEpFilters = normalizeEntregaPuestoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasEntregaPuestoListModuleFiltersContent(listEpFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchEntregaPuestoListQuery(p, listEpFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "incidentes") {
                const listIncFilters = normalizeIncidenteFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasIncidenteListModuleFiltersContent(listIncFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchIncidenteListQuery(p, listIncFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "llaves") {
                const listLlavesFilters = normalizeLlavesFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasLlavesListModuleFiltersContent(listLlavesFilters)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchLlavesListQuery(p, listLlavesFilters);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "llaveros") {
                const listLlr = normalizeLlaverosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasLlaverosListModuleFiltersContent(listLlr)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchLlaverosListQuery(p, listLlr);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "bitacora_novedades") {
                const listBitacora = normalizeBitacoraNovedadesFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasBitacoraNovedadesListModuleFiltersContent(listBitacora)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchBitacoraNovedadesListQuery(p, listBitacora);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "maestro_quejas") {
                const listMq = normalizeMaestroQuejasFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasMaestroQuejasListModuleFiltersContent(listMq)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchMaestroQuejasListQuery(p, listMq);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "checklist_supervision") {
                const listCks = normalizeChecklistSupervisionFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasChecklistSupervisionListModuleFiltersContent(listCks)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchChecklistSupervisionListQuery(p, listCks);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "mutuos_acuerdos") {
                const listMut = normalizeMutuosAcuerdosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasMutuosAcuerdosListModuleFiltersContent(listMut)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchMutuosAcuerdosListQuery(p, listMut);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "evaluacion_personal") {
                const listEvp = normalizeEvaluacionPersonalFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasEvaluacionPersonalListModuleFiltersContent(listEvp)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchEvaluacionPersonalListQuery(p, listEvp);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "producto_no_conforme") {
                const listPnc = normalizeProductoNoConformeFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasProductoNoConformeListModuleFiltersContent(listPnc)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchProductoNoConformeListQuery(p, listPnc);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "registro_induccion_recorrido") {
                const listIr = normalizeInduccionRecorridoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasInduccionRecorridoListModuleFiltersContent(listIr)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchInduccionRecorridoListQuery(p, listIr);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "manuales_puesto") {
                const listMp = normalizeManualesPuestoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasManualesPuestoListModuleFiltersContent(listMp)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchManualesPuestoListQuery(p, listMp);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "articulos_puesto") {
                const listAp = normalizeArticulosPuestoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasArticulosPuestoListModuleFiltersContent(listAp)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchArticulosPuestoListQuery(p, listAp);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "mantenimiento_articulos") {
                const listMa = normalizeMantenimientoArticulosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasMantenimientoArticulosListModuleFiltersContent(listMa)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchMantenimientoArticulosListQuery(p, listMa);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "registro_vehiculos_corporativos") {
                const listRvc = normalizeRegistroVehiculosCorporativosFilters(
                    coerceModuleFiltersInput(payload.listModuleFilters),
                );
                if (hasRegistroVehiculosCorporativosListModuleFiltersContent(listRvc)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchRegistroVehiculosCorporativosListQuery(p, listRvc);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "revision_vehiculos") {
                const listRev = normalizeRevisionVehiculosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasRevisionVehiculosListModuleFiltersContent(listRev)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchRevisionVehiculosListQuery(p, listRev);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "registro_visitas") {
                const listRv = normalizeRegistroVisitasFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasRegistroVisitasListModuleFiltersContent(listRv)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchRegistroVisitasListQuery(p, listRv);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "notas_voz") {
                const listNv = normalizeNotasVozFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasNotasVozListModuleFiltersContent(listNv)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchNotasVozListQuery(p, listNv);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "cambios_ubicacion_puesto") {
                const listCup = normalizeCambiosUbicacionPuestoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasCambiosUbicacionPuestoListModuleFiltersContent(listCup)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchCambiosUbicacionPuestoListQuery(p, listCup);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "registro_capacitaciones") {
                const listRc = normalizeRegistroCapacitacionesFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasRegistroCapacitacionesListModuleFiltersContent(listRc)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchRegistroCapacitacionesListQuery(p, listRc);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "registro_induccion_general") {
                const listRig = normalizeRegistroInduccionGeneralFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasRegistroInduccionGeneralListModuleFiltersContent(listRig)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchRegistroInduccionGeneralListQuery(p, listRig);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "tiempo_almuerzo") {
                const listTa = normalizeTiempoAlmuerzoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasTiempoAlmuerzoListModuleFiltersContent(listTa)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchTiempoAlmuerzoListQuery(p, listTa);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "solicitudes_permiso") {
                const listSp = normalizeSolicitudesPermisoFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasSolicitudesPermisoListModuleFiltersContent(listSp)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchSolicitudesPermisoListQuery(p, listSp);
                        } catch {
                            return false;
                        }
                    });
                }
            } else if (payload.modulo === "visitas_vehiculos") {
                const listVv = normalizeVisitasVehiculosFilters(coerceModuleFiltersInput(payload.listModuleFilters));
                if (hasVisitasVehiculosListModuleFiltersContent(listVv)) {
                    rows = rows.filter((row) => {
                        try {
                            const p = JSON.parse(row.filters || "{}");
                            return filtersMatchVisitasVehiculosListQuery(p, listVv);
                        } catch {
                            return false;
                        }
                    });
                }
            }

            const data = await enrichReportRowsWithCreatorNames(rows);
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        if (op === "createReportJob") {
            const modulo = String(payload.modulo || "").trim();
            if (!modulo) {
                return NextResponse.json({ status: false, message: "modulo es obligatorio" }, { status: 400 });
            }

            const nombre = String(payload.nombre || "").trim();
            const numero = String(payload.numero || "").trim();
            const nomenclatura = String(payload.nomenclatura || "").trim();
            const firma = String(payload.firma_responsable || "").trim();
            if (!nombre || !numero || !nomenclatura || !firma) {
                return NextResponse.json(
                    { status: false, message: "nombre, número, nomenclatura y firma_responsable son obligatorios" },
                    { status: 400 },
                );
            }

            const rawModuleFilters = coerceModuleFiltersInput(payload.moduleFilters) as Record<string, unknown>;
            let tipo =
                normalizeMobileReportTipo(payload.tipo_reporte) ??
                normalizeMobileReportTipo((payload as { tipoReporte?: string }).tipoReporte) ??
                "Grupal";
            const fromFilters = resolveMobileReportTipoFromModuleFilters(rawModuleFilters);
            if (fromFilters === "Individual" || fromFilters === "Consolidado") {
                tipo = fromFilters;
            }
            if (
                modulo === "ingresos_usuario" ||
                modulo === "acciones_personales" ||
                modulo === "bitacora_novedades" ||
                modulo === "checklist_supervision" ||
                modulo === "evaluacion_personal" ||
                modulo === "manuales_puesto" ||
                modulo === "notas_voz" ||
                modulo === "cambios_ubicacion_puesto" ||
                modulo === "registro_capacitaciones" ||
                modulo === "tiempo_almuerzo"
            ) {
                tipo = "Grupal";
            }
            if (modulo === "articulos_puesto" || modulo === "mantenimiento_articulos" || modulo === "registro_vehiculos_corporativos") {
                tipo = "Consolidado";
            }
            if (modulo === "revision_vehiculos" && tipo !== "Individual") {
                tipo = "Consolidado";
            }

            const orderByVal =
                modulo === "acta_entrega_productos" ||
                modulo === "entrega_puesto" ||
                modulo === "agenda_minuta" ||
                modulo === "apreciacion_vulnerabilidad" ||
                modulo === "control_asistencia" ||
                modulo === "documentos_entregados" ||
                modulo === "encuesta_satisfaccion" ||
                modulo === "mutuos_acuerdos" ||
                modulo === "evaluacion_personal" ||
                modulo === "producto_no_conforme" ||
                modulo === "registro_induccion_recorrido" ||
                modulo === "registro_visitas" ||
                modulo === "visitas_vehiculos" ||
                modulo === "notas_voz" ||
                modulo === "cambios_ubicacion_puesto" ||
                modulo === "registro_capacitaciones" ||
                modulo === "registro_induccion_general" ||
                modulo === "tiempo_almuerzo" ||
                modulo === "solicitudes_permiso" ||
                modulo === "visitas_vehiculos" ||
                modulo === "manuales_puesto" ||
                modulo === "articulos_puesto" ||
                modulo === "mantenimiento_articulos" ||
                modulo === "registro_vehiculos_corporativos" ||
                modulo === "revision_vehiculos" ||
                modulo === "acciones_personales" ||
                modulo === "incidentes" ||
                modulo === "llaves" ||
                modulo === "llaveros" ||
                modulo === "bitacora_novedades" ||
                modulo === "maestro_quejas" ||
                modulo === "checklist_supervision"
                    ? String(
                          payload.order_by ||
                              (modulo === "incidentes"
                                  ? "created_at"
                                  : modulo === "bitacora_novedades"
                                    ? "titulo"
                                    : modulo === "manuales_puesto"
                                      ? "title"
                                      : "empresa_id"),
                      ).trim()
                    : modulo === "actividades"
                      ? String(payload.order_by || "fecha").trim()
                      : modulo === "apertura_cierre_puesto"
                        ? String(payload.order_by || "created_by").trim()
                        : String(payload.order_by || "nombre_usuario").trim();

            const moduleFilters =
                modulo === "acta_entrega_productos"
                    ? normalizeActaEntregaFilters(coerceModuleFiltersInput(payload.moduleFilters))
                    : modulo === "entrega_puesto"
                      ? normalizeEntregaPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                    : modulo === "agenda_minuta"
                      ? normalizeAgendaMinutaFilters(coerceModuleFiltersInput(payload.moduleFilters))
                      : modulo === "apertura_cierre_puesto"
                        ? normalizeAperturaCierrePuestoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                        : modulo === "apreciacion_vulnerabilidad"
                          ? normalizeVulnerabilidadFilters(coerceModuleFiltersInput(payload.moduleFilters))
                          : modulo === "actividades"
                            ? normalizeActividadesFilters(coerceModuleFiltersInput(payload.moduleFilters))
                            : modulo === "control_asistencia"
                              ? normalizeControlAsistenciaFilters(coerceModuleFiltersInput(payload.moduleFilters))
                              : modulo === "documentos_entregados"
                                ? normalizeDocumentosEntregadosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                : modulo === "encuesta_satisfaccion"
                                  ? normalizeEncuestaSatisfaccionFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "registro_visitas"
                                    ? normalizeRegistroVisitasFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "visitas_vehiculos"
                                    ? normalizeVisitasVehiculosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "notas_voz"
                                    ? normalizeNotasVozFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "cambios_ubicacion_puesto"
                                    ? normalizeCambiosUbicacionPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "registro_capacitaciones"
                                    ? normalizeRegistroCapacitacionesFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "registro_induccion_general"
                                    ? normalizeRegistroInduccionGeneralFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "tiempo_almuerzo"
                                    ? normalizeTiempoAlmuerzoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "solicitudes_permiso"
                                    ? normalizeSolicitudesPermisoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "mutuos_acuerdos"
                                    ? normalizeMutuosAcuerdosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                    : modulo === "evaluacion_personal"
                                      ? normalizeEvaluacionPersonalFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                : modulo === "producto_no_conforme"
                                  ? normalizeProductoNoConformeFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                : modulo === "registro_induccion_recorrido"
                                  ? normalizeInduccionRecorridoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "manuales_puesto"
                                    ? normalizeManualesPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "articulos_puesto"
                                    ? normalizeArticulosPuestoFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "mantenimiento_articulos"
                                    ? normalizeMantenimientoArticulosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                  : modulo === "registro_vehiculos_corporativos"
                                    ? normalizeRegistroVehiculosCorporativosFilters(
                                          coerceModuleFiltersInput(payload.moduleFilters),
                                      )
                                  : modulo === "revision_vehiculos"
                                    ? normalizeRevisionVehiculosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                : modulo === "acciones_personales"
                                  ? normalizeAccionesPersonalesFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                    : modulo === "incidentes"
                                      ? normalizeIncidenteFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                      : modulo === "llaves"
                                        ? normalizeLlavesFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                        : modulo === "llaveros"
                                          ? normalizeLlaverosFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                        : modulo === "bitacora_novedades"
                                          ? normalizeBitacoraNovedadesFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                          : modulo === "maestro_quejas"
                                            ? normalizeMaestroQuejasFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                            : modulo === "checklist_supervision"
                                              ? normalizeChecklistSupervisionFilters(coerceModuleFiltersInput(payload.moduleFilters))
                                              : normalizeUserLoginModuleFilters(coerceModuleFiltersInput(payload.moduleFilters));
            const filtersObj = {
                moduleKey: modulo,
                moduleFilters,
                formMeta: {
                    nombre,
                    numero,
                    nomenclatura,
                    descripcion: payload.descripcion ?? "",
                    tipo_reporte: tipo,
                    reportOutputType: tipo,
                },
            };

            const created = await prisma.e_reportes_mobile.create({
                data: {
                    nombre,
                    numero,
                    nomenclatura,
                    descripcion: payload.descripcion ?? null,
                    modulo,
                    tipo_reporte: tipo,
                    created_by: auth.empleadoId,
                    created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                    estado: "pendiente",
                    filters: JSON.stringify(filtersObj),
                    order_by: orderByVal,
                    firma_responsable: firma,
                    attemps: 0,
                    max_attempts: DEFAULT_REPORT_MAX_ATTEMPTS,
                    progress: 0,
                },
            });

            return NextResponse.json(
                {
                    status: true,
                    message: "El reporte se encoló y se generará en segundo plano.",
                    data: { id: created.id, estado: created.estado },
                },
                { status: 200 },
            );
        }

        if (op === "mobileReportUploadsPath") {
            const reportIdRaw = (payload as any).reportId ?? (payload as any).report_id;
            const reportId = Number(reportIdRaw);
            if (!Number.isFinite(reportId) || reportId <= 0) {
                return NextResponse.json({ status: false, message: "reportId es obligatorio" }, { status: 400 });
            }

            const row = await prisma.e_reportes_mobile.findUnique({ where: { id: reportId } });
            if (!row) {
                return NextResponse.json({ status: false, message: "Reporte no encontrado" }, { status: 404 });
            }
            if (String(row.estado || "").toLowerCase() !== "completado") {
                return NextResponse.json({ status: false, message: "El reporte aún no está completado" }, { status: 409 });
            }

            try {
                const absolutePath = await resolveReportMobileAbsolutePath(row.id, row.filters);
                const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
                const relativeForFiles = path.relative(uploadsRoot, absolutePath).replace(/\\/g, "/");
                if (relativeForFiles.startsWith("..")) {
                    return NextResponse.json({ status: false, message: "Ruta de archivo inválida" }, { status: 500 });
                }
                return NextResponse.json({ status: true, data: { url: relativeForFiles } }, { status: 200 });
            } catch {
                return NextResponse.json({ status: false, message: "Archivo no encontrado en el servidor" }, { status: 404 });
            }
        }

        return NextResponse.json({ status: false, message: `Operación no soportada: ${op}` }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("POST /api/dynamic-prisma/reportes:", msg);
        return NextResponse.json({ status: false, message: msg }, { status: 500 });
    }
}
