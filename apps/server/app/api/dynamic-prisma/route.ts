/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { verifyTokenFromBody } from "../../../utils/verifyTokenFromBody";

type DynamicAction = "GET" | "POST" | "UPDATE" | "DELETE";

type DynamicPrismaPayload = {
    token?: string;
    mobileAccessToken?: string;
    shouldVerifyAccessToken?: boolean;
    action?: DynamicAction | string;
    table?: string;
    where?: any;
    include?: any;
    select?: any;
    body?: any;
    data?: any;
    orderBy?: any;
    cursor?: any;
    take?: number;
    skip?: number;
    distinct?: any;
    operation?: string; // findMany | findFirst | findUnique | updateMany | deleteMany
    many?: boolean;
    returning?: boolean;
};

const isValidTableName = (value: string) => /^[a-zA-Z0-9_]+$/.test(value);


// Función auxiliar para convertir strings de fecha a DateTime completos y normalizar arrays
const normalizeDateValue = (value: any): any => {
    if (value === null || value === undefined) return value;

    // Si es un array, procesar cada elemento
    if (Array.isArray(value)) {
        return value.map(item => normalizeDateValue(item));
    }

    // Si es un objeto que parece un array serializado (tiene índices numéricos consecutivos)
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        const keys = Object.keys(value);
        const numericKeys = keys.filter(k => /^\d+$/.test(k)).map(k => parseInt(k)).sort((a, b) => a - b);

        // Si TODAS las claves son numéricas y consecutivas empezando desde 0, convertir a array
        // Esto maneja el caso donde un array se serializa como {0: {...}, 1: {...}}
        if (numericKeys.length > 0 &&
            numericKeys.length === keys.length && // Todas las claves son numéricas
            numericKeys[0] === 0 && // Empieza desde 0
            numericKeys.length === numericKeys[numericKeys.length - 1] + 1 && // Es consecutivo
            numericKeys.every((k, i) => k === i)) { // Verificar que sea consecutivo
            return numericKeys.map(k => normalizeDateValue(value[String(k)]));
        }

        // Si es un objeto con propiedades gt, lt, gte, lte, equals, OR, etc., procesar recursivamente
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
            // Caso especial: OR y AND deben ser arrays
            if ((key === 'OR' || key === 'AND') && typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date)) {
                const valObj = val as Record<string, any>;
                const valKeys = Object.keys(valObj);
                const valNumericKeys = valKeys.filter(k => /^\d+$/.test(k)).map(k => parseInt(k)).sort((a, b) => a - b);
                // Si todas las claves son numéricas, convertir a array
                if (valNumericKeys.length > 0 && valNumericKeys.length === valKeys.length) {
                    result[key] = valNumericKeys.map(k => normalizeDateValue(valObj[String(k)]));
                    continue;
                }
            }
            result[key] = normalizeDateValue(val);
        }
        return result;
    }

    if (typeof value === 'string') {
        // Si es un string que parece una fecha (YYYY-MM-DD), convertir a DateTime completo
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return new Date(value + 'T00:00:00.000Z');
        }
        // Si ya es un DateTime ISO completo, convertir a Date
        if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return new Date(value);
        }
    }

    if (value instanceof Date) {
        return value;
    }

    return value;
};

const buildReadArgs = (payload: DynamicPrismaPayload) => {
    const args: any = {};
    if (payload.where !== undefined) {
        args.where = normalizeDateValue(payload.where);
    }
    if (payload.include !== undefined) args.include = payload.include;
    if (payload.select !== undefined) args.select = payload.select;
    if (payload.orderBy !== undefined) args.orderBy = payload.orderBy;
    if (payload.cursor !== undefined) args.cursor = payload.cursor;
    if (payload.take !== undefined) args.take = payload.take;
    if (payload.skip !== undefined) args.skip = payload.skip;
    if (payload.distinct !== undefined) args.distinct = payload.distinct;
    return args;
};

export async function GET(req: NextRequest) {
    try {
        const tokenValidation = verifyAccessToken(req);
        return NextResponse.json(
            {
                status: tokenValidation.valid,
                valid: tokenValidation.valid,
                expired: tokenValidation.expired,
                payload: tokenValidation.payload,
                message: tokenValidation.message,
            },
            { status: tokenValidation.valid ? 200 : tokenValidation.expired ? 401 : 403 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/dynamic-prisma:", errorMessage);
        return NextResponse.json({ status: false, valid: false, expired: false, payload: null, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as DynamicPrismaPayload;
        if (!payload || typeof payload !== "object") {
            return NextResponse.json({ status: false, message: "Payload inválido" }, { status: 400 });
        }

        const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();
        const incomingMobileToken = String(payload.mobileAccessToken || "").trim();

        if (!expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
                { status: 500 }
            );
        }
        if (!incomingMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken es obligatorio" },
                { status: 403 }
            );
        }
        if (incomingMobileToken !== expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken inválido" },
                { status: 403 }
            );
        }

        const shouldVerifyAccessToken = payload.shouldVerifyAccessToken !== false;
        const tokenValidationHeader = verifyAccessToken(req);
        const tokenValidationBody = verifyTokenFromBody(payload.token);
        const tokenValidation = tokenValidationHeader.valid ? tokenValidationHeader : tokenValidationBody;

        if (shouldVerifyAccessToken && !tokenValidation.valid) {
            return NextResponse.json(
                { status: false, expired: tokenValidation.expired, message: tokenValidation.message },
                { status: tokenValidation.expired ? 401 : 403 }
            );
        }

        const actionRaw = String(payload.action || "").toUpperCase();
        const table = String(payload.table || "").trim();

        if (!actionRaw) {
            return NextResponse.json({ status: false, message: "Acción no especificada" }, { status: 400 });
        }
        if (!table) {
            return NextResponse.json({ status: false, message: "Tabla no especificada" }, { status: 400 });
        }
        if (!isValidTableName(table)) {
            return NextResponse.json({ status: false, message: "Nombre de tabla inválido" }, { status: 400 });
        }
        if (payload.include !== undefined && payload.select !== undefined) {
            return NextResponse.json(
                { status: false, message: "No se puede enviar include y select al mismo tiempo" },
                { status: 400 }
            );
        }

        const model = (prisma as any)[table];
        if (!model) {
            return NextResponse.json({ status: false, message: "Tabla no soportada o no encontrada en Prisma" }, { status: 400 });
        }

        if (!["GET", "POST", "UPDATE", "DELETE"].includes(actionRaw)) {
            return NextResponse.json({ status: false, message: "Acción no soportada" }, { status: 400 });
        }

        const action = actionRaw as DynamicAction;
        const bodyData = payload.body !== undefined ? payload.body : payload.data;

        if (action === "GET") {
            const readMethod = String(payload.operation || "").trim();
            const method = readMethod || (payload.many ? "findMany" : "findMany");
            if (!["findMany", "findFirst", "findUnique"].includes(method)) {
                return NextResponse.json({ status: false, message: "Operación GET no soportada" }, { status: 400 });
            }

            const args = buildReadArgs(payload);
            if (method === "findUnique" && !args.where) {
                return NextResponse.json({ status: false, message: "where es obligatorio para findUnique" }, { status: 400 });
            }

            const data = await model[method](args);
            return NextResponse.json({ status: true, action, table, data }, { status: 200 });
        }

        if (action === "POST") {
            if (bodyData === undefined) {
                return NextResponse.json({ status: false, message: "body/data es obligatorio para POST" }, { status: 400 });
            }

            const args: any = { data: bodyData };
            if (payload.include !== undefined) args.include = payload.include;
            if (payload.select !== undefined) args.select = payload.select;

            const created = await model.create(args);
            if (payload.returning === false) {
                return NextResponse.json({ status: true, action, table, message: "Registro creado" }, { status: 200 });
            }
            return NextResponse.json({ status: true, action, table, data: created }, { status: 200 });
        }

        if (action === "UPDATE") {
            if (!payload.where) {
                return NextResponse.json({ status: false, message: "where es obligatorio para UPDATE" }, { status: 400 });
            }
            if (bodyData === undefined) {
                return NextResponse.json({ status: false, message: "body/data es obligatorio para UPDATE" }, { status: 400 });
            }

            const updateMany = payload.many === true || payload.operation === "updateMany";
            if (updateMany) {
                const updated = await model.updateMany({ where: payload.where, data: bodyData });
                if (payload.include !== undefined || payload.select !== undefined || payload.returning !== false) {
                    const readArgs: any = { where: payload.where };
                    if (payload.include !== undefined) readArgs.include = payload.include;
                    if (payload.select !== undefined) readArgs.select = payload.select;
                    const rows = await model.findMany(readArgs);
                    return NextResponse.json({ status: true, action, table, count: updated.count, data: rows }, { status: 200 });
                }
                return NextResponse.json({ status: true, action, table, count: updated.count }, { status: 200 });
            }

            const args: any = { where: payload.where, data: bodyData };
            if (payload.include !== undefined) args.include = payload.include;
            if (payload.select !== undefined) args.select = payload.select;

            const updated = await model.update(args);
            if (payload.returning === false) {
                return NextResponse.json({ status: true, action, table, message: "Registro actualizado" }, { status: 200 });
            }
            return NextResponse.json({ status: true, action, table, data: updated }, { status: 200 });
        }

        // DELETE
        if (!payload.where) {
            return NextResponse.json({ status: false, message: "where es obligatorio para DELETE" }, { status: 400 });
        }

        const deleteMany = payload.many === true || payload.operation === "deleteMany";
        if (deleteMany) {
            const deleted = await model.deleteMany({ where: payload.where });
            return NextResponse.json({ status: true, action, table, count: deleted.count }, { status: 200 });
        }

        const args: any = { where: payload.where };
        if (payload.include !== undefined) args.include = payload.include;
        if (payload.select !== undefined) args.select = payload.select;
        const deleted = await model.delete(args);
        if (payload.returning === false) {
            return NextResponse.json({ status: true, action, table, message: "Registro eliminado" }, { status: 200 });
        }
        return NextResponse.json({ status: true, action, table, data: deleted }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/dynamic-prisma:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


