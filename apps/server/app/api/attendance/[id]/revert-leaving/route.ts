import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../utils/reportError";
import axios from "axios";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const idNum = parseInt(String(id), 10);
        if (!idNum) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        let horaAccion: number | undefined;
        let planillasToken = null;
        try {
            const body = await req.json();
            const raw = body?.horaAccion;
            // Planillas token deben ser obtenido del header de la request
            planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
            if (!planillasToken) {
                await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 404, "Token de Planillas no encontrado");
                return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 404 });
            }
            const n = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(n)) horaAccion = n;
        } catch {
            console.log("cuerpo vacío permitido por compatibilidad");
        }
        if (horaAccion == null || !Number.isFinite(horaAccion)) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 400, "horaAccion requerida");
            return NextResponse.json({ status: false, message: "horaAccion requerida" }, { status: 400 });
        }

        if (planillasToken == null) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 400, "planillasToken requerido");
            return NextResponse.json({ status: false, message: "planillasToken requerido" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: idNum } });

        if (!marcaDia) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 404, "Marca del dia no encontrada");
            return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id } });

        if (!empleado) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const planillasResponse = await axios.post(`${process.env.PLANILLAS_URL}/marcas/revertir`, {
            marca_id: marcaDia.id,
            tipo: "salida",
            empleado_codigo: empleado.cedula
        }, {
            headers: {
                "Authorization": `Bearer ${planillasToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!planillasResponse.data.success) {
            await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 500, "Error al marcar la salida en Planillas");
            return NextResponse.json({ status: false, message: "Error al marcar la salida en Planillas" }, { status: 500 });
        }

        return NextResponse.json({ status: true, message: "Salida revertida correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        await reportError(req, "api/attendance/[id]/revert-leaving", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
