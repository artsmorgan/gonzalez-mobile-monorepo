/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const empleadoId = payload?.id ? parseInt(String(payload.id), 10) : 0;
        if (!empleadoId) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado en token" }, { status: 401 });
        }

        const acciones = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_accion_personal",
                operation: "findMany",
                where: {
                    empleado_id: empleadoId,
                    document: null,
                },
                orderBy: { fecha_insercion: "desc" },
            },
        });

        const accionesArray = Array.isArray(acciones) ? acciones : [];
        const acciones_return: any[] = [];

        for (const accion of accionesArray) {
            const [cliente, sucursal, puesto, tipoAccion] = await Promise.all([
                accion.cliente_id
                    ? callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: accion.cliente_id } },
                    })
                    : null,
                accion.corpo_id
                    ? callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: accion.corpo_id } },
                    })
                    : null,
                accion.puesto_id
                    ? callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: accion.puesto_id } },
                    })
                    : null,
                accion.tipoAccion_id
                    ? callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "c_tipo_accion", operation: "findUnique", where: { id: accion.tipoAccion_id } },
                    })
                    : null,
            ]);

            acciones_return.push({
                id: accion.id,
                consecutivo: accion.consecutivo || null,
                cliente: cliente?.nombre || null,
                sucursal: sucursal?.nombre || null,
                puesto: puesto?.nombre || null,
                tipo_accion: tipoAccion?.nombre || null,
                fecha_vence_subir_adjunto: accion.fecha_vence_subir_adjunto || null,
                document: accion.document || null,
                mobile_upload: accion.mobile_upload ?? false,
            });
        }

        return NextResponse.json({ status: true, acciones_return }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ status: false, message: "Error al obtener archivos de acciones" }, { status: 500 });
    }
}