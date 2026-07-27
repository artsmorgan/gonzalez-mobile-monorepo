/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
const dotenv = require("dotenv");
dotenv.config();

async function getLatestFirmaDigital(req: NextRequest, empleadoId: number): Promise<string | null> {
    const row = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_empleado_firma_digital",
            operation: "findFirst",
            where: { empleado_id: empleadoId },
            orderBy: { id: "desc" },
            select: { firma: true },
        },
    });
    return row?.firma ?? null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 },
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const manualSignature = await getLatestFirmaDigital(req, id);
        return NextResponse.json({ status: true, manualSignature }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ status: false, message: "Error interno en la firma" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 },
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);

        const body = await req.json();
        const { manualSignature } = body;

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const now = toZonedTime(new Date(), "America/Costa_Rica");
        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_firma_digital",
                operation: "findFirst",
                where: { empleado_id: id },
                orderBy: { id: "desc" },
            },
        });

        const firmaRecord = existing
            ? await callDynamicPrisma({
                  req,
                  data: {
                      action: "UPDATE",
                      table: "c_empleado_firma_digital",
                      operation: "update",
                      where: { id: existing.id },
                      data: { firma: manualSignature, created_at: now },
                  },
              })
            : await callDynamicPrisma({
                  req,
                  data: {
                      action: "POST",
                      table: "c_empleado_firma_digital",
                      operation: "create",
                      data: { empleado_id: id, firma: manualSignature, created_at: now },
                  },
              });

        return NextResponse.json({ status: true, firmaRecord }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ status: false, message: "Error interno en la firma" }, { status: 500 });
    }
}
