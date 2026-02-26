/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
const dotenv = require('dotenv');
dotenv.config();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }


        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id }
            }
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({ status: true, manualSignature: empleado.firma_manual }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const body = await req.json();

        const { manualSignature } = body;

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id }
            }
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 404 }
            );
        }

        const updatedEmpleado = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_empleado",
                where: { id },
                data: { firma_manual: manualSignature }
            }
        });

        return NextResponse.json({ status: true, updatedEmpleado }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
            { status: 500 }
        );
    }
}
