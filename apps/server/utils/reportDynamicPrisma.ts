/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { isLikelyJwt } from "./resolveUserAccessToken";

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
};

export type ReportDataAccess = {
    [table: string]: TableHandler;
};

function resolveServiceBaseUrl(): string {
    const serverUrl = process.env.SERVER_URL?.trim();
    if (serverUrl && serverUrl.length > 0) return serverUrl.replace(/\/+$/, "");
    return resolveInternalServiceBaseUrl();
}

/** URL local para worker / procesos internos (evita ngrok y bucles de reintento por timeout). */
export function resolveInternalServiceBaseUrl(): string {
    const port = process.env.PORT?.trim() || "3000";
    return `http://127.0.0.1:${port}`;
}

/** Request sintético para worker con JWT del usuario que encoló el reporte (patrón MantenimientoEquipo). */
export function createReportServiceRequest(accessToken?: string): NextRequest {
    const base = resolveInternalServiceBaseUrl();
    const headers = new Headers({ "content-type": "application/json" });
    const token = String(accessToken || "").trim();
    if (isLikelyJwt(token)) {
        headers.set("authorization", `Bearer ${token}`);
    }
    return new NextRequest(`${base}/api/reportes/internal`, { headers });
}

function createTableHandler(table: string, req: NextRequest, token?: string): TableHandler {
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
    };
}

/**
 * Proxy de acceso a datos para reportes vía `/api/dynamic-prisma`.
 * Las consultas `findMany` con `{ id: { in: [...] } }` se hacen en una sola petición por tabla.
 */
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
