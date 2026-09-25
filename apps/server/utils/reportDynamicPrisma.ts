/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";
import { isLikelyJwt } from "./resolveUserAccessToken";

/** Tablas preexistentes del proyecto: acceso directo vía Prisma (no `/api/dynamic-prisma`). */
export const PREEXISTENT_REPORT_TABLES = new Set([
    "c_accion_personal",
    "c_cambio_guardia",
    "c_empleado",
    "c_empleado_plaza",
    "c_horario",
    "c_marca_dia",
    "c_salida_anticipada",
    "c_tipo_accion",
    "e_estructura_articulo_corpo_puesto_entrega",
    "e_estructura_articulo_corpo_puesto_plan",
    "e_estructura_cliente",
    "e_estructura_combo_articulo_cp",
    "e_estructura_contrato",
    "e_estructura_empresa",
    "e_estructura_plazas",
    "e_estructura_puesto",
    "e_estructura_sucursal",
    "n_articulo_corpo_puesto",
    "n_division",
    "n_ejecutivo_cuenta",
    "pg_categoria_empleado",
    "pg_categoria_salarial",
]);

type ReadArgs = {
    where?: any;
    select?: any;
    orderBy?: any;
    take?: number;
    skip?: number;
    include?: any;
    distinct?: any;
    cursor?: any;
};

type TableHandler = {
    findMany: (args?: ReadArgs) => Promise<any[]>;
    findFirst: (args?: ReadArgs) => Promise<any | null>;
    findUnique: (args: ReadArgs) => Promise<any | null>;
    create: (args: { data: any; select?: any; include?: any }) => Promise<any>;
    update: (args: { where: any; data: any; select?: any; include?: any }) => Promise<any>;
    delete: (args: { where: any; select?: any; include?: any }) => Promise<any>;
};

export type ReportDataAccess = {
    [table: string]: TableHandler;
};

function resolveServiceBaseUrl(): string {
    const serverUrl = process.env.SERVER_URL?.trim();
    if (serverUrl && serverUrl.length > 0) return serverUrl.replace(/\/+$/, "");
    return resolveInternalServiceBaseUrl();
}

/** Base URL del API para reportes/worker (`SERVER_URL` con fallback local). */
export function resolveReportServiceBaseUrl(): string {
    return resolveServiceBaseUrl();
}

/** URL local cuando `SERVER_URL` no está definido. */
export function resolveInternalServiceBaseUrl(): string {
    const port = process.env.PORT?.trim() || "3000";
    return `http://127.0.0.1:${port}`;
}

/** Request sintético del worker; apunta a `SERVER_URL` (mismo destino que `callDynamicPrisma`). */
export function createReportServiceRequest(accessToken?: string): NextRequest {
    const base = resolveServiceBaseUrl();
    const headers = new Headers({ "content-type": "application/json" });
    const token = String(accessToken || "").trim();
    if (isLikelyJwt(token)) {
        headers.set("authorization", `Bearer ${token}`);
    }
    return new NextRequest(`${base}/api/reportes/internal`, { headers });
}

function getDirectPrismaDelegate(table: string) {
    const delegate = (prisma as PrismaClient & Record<string, TableHandler>)[table];
    if (!delegate) {
        throw new Error(`Tabla preexistente sin delegate Prisma: ${table}`);
    }
    return delegate;
}

function createDirectPrismaTableHandler(table: string): TableHandler {
    const delegate = getDirectPrismaDelegate(table);
    return {
        findMany: async (args: ReadArgs = {}) => {
            const rows = await delegate.findMany(args);
            return Array.isArray(rows) ? rows : [];
        },
        findFirst: async (args: ReadArgs = {}) => delegate.findFirst(args),
        findUnique: async (args: ReadArgs) => delegate.findUnique(args),
        create: async (args: { data: any; select?: any; include?: any }) => delegate.create(args),
        update: async (args: { where: any; data: any; select?: any; include?: any }) => delegate.update(args),
        delete: async (args: { where: any; select?: any; include?: any }) => delegate.delete(args),
    };
}

function createDynamicPrismaTableHandler(table: string, req: NextRequest, token?: string): TableHandler {
    const base = {
        req,
        token,
        shouldVerifyAccessToken: false as const,
    };

    return {
        findMany: async (args: ReadArgs = {}) => {
            const data = await callDynamicPrisma({
                ...base,
                data: {
                    action: "GET",
                    table,
                    operation: "findMany",
                    where: args.where,
                    select: args.select,
                    orderBy: args.orderBy,
                    take: args.take,
                    skip: args.skip,
                    include: args.include,
                    distinct: args.distinct,
                    cursor: args.cursor,
                },
            });
            return Array.isArray(data) ? data : [];
        },
        findFirst: async (args: ReadArgs = {}) => {
            const data = await callDynamicPrisma({
                ...base,
                data: {
                    action: "GET",
                    table,
                    operation: "findFirst",
                    where: args.where,
                    select: args.select,
                    orderBy: args.orderBy,
                    take: args.take,
                    skip: args.skip,
                    include: args.include,
                },
            });
            return data ?? null;
        },
        findUnique: async (args: ReadArgs) => {
            const data = await callDynamicPrisma({
                ...base,
                data: {
                    action: "GET",
                    table,
                    operation: "findUnique",
                    where: args.where,
                    select: args.select,
                    include: args.include,
                },
            });
            return data ?? null;
        },
        create: async (args: { data: any; select?: any; include?: any }) => {
            return callDynamicPrisma({
                ...base,
                data: {
                    action: "POST",
                    table,
                    operation: "create",
                    data: args.data,
                    select: args.select,
                    include: args.include,
                },
            });
        },
        update: async (args: { where: any; data: any; select?: any; include?: any }) => {
            return callDynamicPrisma({
                ...base,
                data: {
                    action: "UPDATE",
                    table,
                    operation: "update",
                    where: args.where,
                    data: args.data,
                    select: args.select,
                    include: args.include,
                },
            });
        },
        delete: async (args: { where: any; select?: any; include?: any }) => {
            return callDynamicPrisma({
                ...base,
                data: {
                    action: "DELETE",
                    table,
                    operation: "delete",
                    where: args.where,
                    select: args.select,
                    include: args.include,
                },
            });
        },
    };
}

function createTableHandler(table: string, req: NextRequest, token?: string): TableHandler {
    if (PREEXISTENT_REPORT_TABLES.has(table)) {
        return createDirectPrismaTableHandler(table);
    }
    return createDynamicPrismaTableHandler(table, req, token);
}

/**
 * Proxy de acceso a datos para reportes.
 * - Tablas en `PREEXISTENT_REPORT_TABLES` → Prisma directo (`DATABASE_URL`).
 * - Resto de tablas creadas (p. ej. `e_reportes_mobile`) → `callDynamicPrisma` vía `SERVER_URL`.
 */
export function createWorkerReportDb(): ReportDataAccess {
    return createReportPrismaClient(createReportServiceRequest());
}

export function createReportPrismaClient(req: NextRequest, token?: string): ReportDataAccess {
    const handlers = new Map<string, TableHandler>();
    return new Proxy({} as ReportDataAccess, {
        get(_target, prop: string | symbol) {
            if (typeof prop !== "string") return undefined;
            if (!handlers.has(prop)) {
                handlers.set(prop, createTableHandler(prop, req, token));
            }
            return handlers.get(prop);
        },
    });
}

/** Carga en lote registros por id y devuelve un Map para filtrar en memoria. */
export async function batchFindManyByIds<T extends { id: number }>(
    prisma: ReportDataAccess,
    table: string,
    ids: number[],
    select?: Record<string, boolean>,
): Promise<Map<number, T>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
    if (unique.length === 0) return new Map();
    const rows = (await prisma[table].findMany({
        where: { id: { in: unique } },
        ...(select ? { select } : {}),
    })) as T[];
    return new Map(rows.map((r) => [Number(r.id), r]));
}
