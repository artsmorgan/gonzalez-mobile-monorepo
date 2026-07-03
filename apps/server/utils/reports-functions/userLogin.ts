/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";

import ExcelJS from "exceljs";

export type UserLoginModuleFilters = {
    creadoDesde?: string | null;
    creadoHasta?: string | null;
    /** Un solo empleado (reportes antiguos o filtro simple). */
    empleadoIngresoId?: number | null;
    /** Varios empleados (tokens de cualquiera de ellos). */
    empleadoIngresoIds?: number[] | null;
    soloMultiDispositivo?: boolean;
};

export type UserLoginOrderKey =
    | "nombre_usuario"
    | "token"
    | "createdAt"
    | "expiresAt"
    | "sessionId";

const ORDER_LABELS: Record<UserLoginOrderKey, string> = {
    nombre_usuario: "Nombre de usuario",
    token: "Token",
    createdAt: "Creado en",
    expiresAt: "Expirado en",
    sessionId: "Id de sesión",
};

function parseDeviceEntries(device: string | null | undefined): unknown[] {
    if (!device || String(device).trim() === "") return [];
    try {
        const p = JSON.parse(String(device));
        if (Array.isArray(p)) return p;
    } catch {
        /* ignore */
    }
    return [device];
}

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function buildEmpleadoNombre(row: {
    nombre?: string | null;
    primer_apellido?: string | null;
    segundo_apellido?: string | null;
}): string {
    return [row.nombre, row.primer_apellido, row.segundo_apellido].filter(Boolean).join(" ").trim();
}

/**
 * Une `empleadoIngresoId` y `empleadoIngresoIds` en un solo conjunto de ids válidos.
 * Debe coincidir con la semántica del modal / URL de listado.
 */
export function collectEmpleadoIngresoIdsFromFilters(filters: UserLoginModuleFilters): number[] {
    const out: number[] = [];
    const sid = filters.empleadoIngresoId;
    if (sid != null && String(sid).trim() !== "" && Number.isFinite(Number(sid)) && Number(sid) > 0) {
        out.push(Number(sid));
    }
    const raw = filters.empleadoIngresoIds;
    if (Array.isArray(raw)) {
        for (const x of raw) {
            const n = Number(x);
            if (Number.isFinite(n) && n > 0) out.push(n);
        }
    }
    return [...new Set(out)];
}

export async function queryRefreshTokensUserLogin(
    prisma: ReportDataAccess,
    filters: UserLoginModuleFilters,
    orderKey: UserLoginOrderKey,
): Promise<any[]> {
    const where: any = {};

    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.createdAt = {};
        if (desde) where.createdAt.gte = desde;
        if (hasta) where.createdAt.lte = hasta;
    }

    const empleadoIds = collectEmpleadoIngresoIdsFromFilters(filters);
    if (empleadoIds.length > 0) {
        console.log("empleadoIds", empleadoIds);
        where.empleadoId = empleadoIds.length === 1 ? empleadoIds[0] : { in: empleadoIds };
    }

    let orderBy: any = { id: "desc" as const };
    switch (orderKey) {
        case "nombre_usuario":
            orderBy = { c_empleado: { nombre: "asc" } };
            break;
        case "token":
            orderBy = { token: "asc" };
            break;
        case "createdAt":
            orderBy = { createdAt: "desc" };
            break;
        case "expiresAt":
            orderBy = { expiresAt: "desc" };
            break;
        case "sessionId":
            orderBy = { sessionId: "asc" };
            break;
        default:
            orderBy = { createdAt: "desc" };
    }

    const rows = await prisma.refresh_token.findMany({
        where,
        include: { c_empleado: true },
        orderBy,
        take: 50_000,
    });

    let next = rows;
    /* Refuerzo: solo filas cuyo empleadoId está en el filtro (evita filas ajenas si el where no aplicó como se espera). */
    if (empleadoIds.length > 0) {
        const allow = new Set(empleadoIds);
        next = next.filter((r) => allow.has(Number(r.empleadoId)));
    }
    if (filters.soloMultiDispositivo) {
        next = next.filter((r) => parseDeviceEntries(r.device).length > 1);
    }

    return next;
}

export async function buildUserLoginExcelBuffer(rows: any[]): Promise<Buffer> {
    const workbook = new ExcelWriter();
    await workbook.fillUserLoginSheet(rows);
    const buf = await workbook.toBuffer();
    return buf;
}

/** Excel con secciones, cabeceras y columnas agrupables (outline) para mostrar/ocultar en Excel. */
class ExcelWriter {
    private workbook: ExcelJS.Workbook;

    constructor() {
        this.workbook = new ExcelJS.Workbook();
    }

    async fillUserLoginSheet(rows: any[]): Promise<void> {
        const sheet = this.workbook.addWorksheet("Ingresos de usuario", {
            properties: { outlineProperties: { summaryBelow: false, summaryRight: false } },
            views: [{ state: "frozen", ySplit: 3 }],
        });

        sheet.mergeCells("A1:H1");
        const title = sheet.getCell("A1");
        title.value = "Reporte — Ingresos de usuario";
        title.font = { bold: true, size: 14 };
        title.alignment = { vertical: "middle", horizontal: "center" };

        sheet.mergeCells("A2:H2");
        const sub = sheet.getCell("A2");
        sub.value = "Datos de sesión / tokens";
        sub.font = { bold: true };
        sub.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE7EEF7" },
        };

        const headers = [
            { key: "empleado", header: "Empleado", outlineLevel: 1 },
            { key: "token", header: "Token", outlineLevel: 1 },
            { key: "createdAt", header: "Creado en", outlineLevel: 1 },
            { key: "expiresAt", header: "Expira en", outlineLevel: 1 },
            { key: "sessionId", header: "Id de sesión", outlineLevel: 1 },
            { key: "revoked", header: "Revocado", outlineLevel: 1 },
            { key: "device", header: "Dispositivo (JSON)", outlineLevel: 1 },
        ];

        const headerRow = sheet.getRow(3);
        headerRow.height = 22;
        headers.forEach((h, i) => {
            const c = sheet.getColumn(i + 1);
            c.outlineLevel = h.outlineLevel ?? 0;
            const cell = headerRow.getCell(i + 1);
            cell.value = h.header;
            cell.font = { bold: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFD9E3F0" },
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });

        let r = 4;
        for (const row of rows) {
            const empName = row.c_empleado ? buildEmpleadoNombre(row.c_empleado) : "";
            const line = sheet.getRow(r);
            const values = [
                empName,
                row.token,
                row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
                row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt ?? ""),
                row.sessionId,
                row.revoked ? "Sí" : "No",
                typeof row.device === "string" ? row.device : JSON.stringify(row.device ?? ""),
            ];
            values.forEach((v, i) => {
                line.getCell(i + 1).value = v;
            });
            r += 1;
        }

        sheet.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: Math.max(3, r - 1), column: headers.length },
        };

        for (let i = 1; i <= headers.length; i++) {
            sheet.getColumn(i).width = i === 1 ? 28 : i === 7 ? 40 : 22;
        }
    }

    async toBuffer(): Promise<Buffer> {
        const ab = await this.workbook.xlsx.writeBuffer();
        return Buffer.from(ab);
    }
}

export { ORDER_LABELS };
