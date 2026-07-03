import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import axios from "axios";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const idNum = parseInt(String(id), 10);
        if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

        let horaAccion: number | undefined;
        let planillasToken = null;
        try {
            const body = await req.json();
            const raw = body?.horaAccion;
            planillasToken = body?.planillasToken ?? null;
            const n = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(n)) horaAccion = n;
        } catch {
            console.log("cuerpo vacío permitido por compatibilidad");
        }
        if (horaAccion == null || !Number.isFinite(horaAccion)) {
            return NextResponse.json({ status: false, message: "horaAccion requerida" }, { status: 200 });
        }

        if (planillasToken == null) {
            return NextResponse.json({ status: false, message: "planillasToken requerido" }, { status: 200 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: idNum } }
        });

        if (!marcaDia) return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 404 });

        const empleado = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: marcaDia.empleadoFijo_id } }
        });
        
        if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });

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
            return NextResponse.json({ status: false, message: "Error al marcar la salida en Planillas" }, { status: 200 });
        }

        return NextResponse.json({ status: true, message: "Salida revertida correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}