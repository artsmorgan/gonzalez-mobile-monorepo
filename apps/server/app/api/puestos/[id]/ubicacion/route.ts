import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";
import axios from "axios";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 }
            );
        }

        const resolvedParams = await context.params;
        const puestoId = parseInt(resolvedParams.id);

        if (!puestoId || isNaN(puestoId)) {
            await reportError(req, "api/puestos/[id]/ubicacion", "GET", 400, "ID de puesto inválido");
            return NextResponse.json(
                { status: false, message: "ID de puesto inválido" },
                { status: 400 }
            );
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } });
        if (!puesto) {
            await reportError(req, "api/puestos/[id]/ubicacion", "GET", 404, "Puesto no encontrado");
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                status: true,
                data: {
                    lat: puesto.coordenadas_gpslat ?? null,
                    lng: puesto.coordenadas_gpslng ?? null,
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error fetching puesto ubicacion:", errorMessage);
        await reportError(req, "api/puestos/[id]/ubicacion", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: 401 }
            );
        }

        const planillasToken = await req.headers.get("planillas-token");
        if (!planillasToken) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 400, "Token de Planillas requerido");
            return NextResponse.json(
                { status: false, message: "Token de Planillas requerido" },
                { status: 400 }
            );
        }

        const resolvedParams = await context.params;
        const puestoId = parseInt(resolvedParams.id);

        if (!puestoId || isNaN(puestoId)) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 400, "ID de puesto inválido");
            return NextResponse.json(
                { status: false, message: "ID de puesto inválido" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const latitud = body?.latitud;
        const longitud = body?.longitud;
        const horaAccionRaw = body?.horaAccion;
        const horaAccionNum =
            horaAccionRaw != null && horaAccionRaw !== "" ? Number(horaAccionRaw) : NaN;
        const createdAt = Number.isFinite(horaAccionNum)
            ? new Date(horaAccionNum)
            : toZonedTime(new Date(), "America/Costa_Rica");

        if (latitud === undefined || longitud === undefined) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 400, "Latitud y longitud son requeridas");
            return NextResponse.json(
                { status: false, message: "Latitud y longitud son requeridas" },
                { status: 400 }
            );
        }

        const clearing = latitud === null && longitud === null;
        if (!clearing && (latitud === null || longitud === null)) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 400, "Latitud y longitud deben enviarse ambas o ambas en null para borrar");
            return NextResponse.json(
                { status: false, message: "Latitud y longitud deben enviarse ambas o ambas en null para borrar" },
                { status: 400 }
            );
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } });

        if (!puesto) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 404, "Puesto no encontrado");
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 404 }
            );
        }

        const bodyUpdatePuesto = clearing ? { lat: null, lng: null } : { lat: String(latitud), lng: String(longitud), }

        const latitud_anterior = puesto.coordenadas_gpslat;
        const longitud_anterior = puesto.coordenadas_gpslng;
        
        const planillasResponse = await axios.put(`${process.env.PLANILLAS_URL}/puestos/${puestoId}/coordenadas`, bodyUpdatePuesto, { 
            headers: {
                "Authorization": `Bearer ${planillasToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!planillasResponse.data.success) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 500, "Error al actualizar la ubicación del puesto");
            return NextResponse.json(
                { status: false, message: "Error al actualizar la ubicación del puesto" },
                { status: 500 }
            );
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_ubicacion_puesto_registro_cambios",
                data: {
                    puesto_id: puestoId,
                    latitud_anterior: latitud_anterior ? String(latitud_anterior) : null,
                    longitud_anterior: longitud_anterior ? String(longitud_anterior) : null,
                    latitud_nueva: latitud ? String(latitud) : null,
                    longitud_nueva: longitud ? String(longitud) : null,
                    created_at: createdAt.toISOString(),
                    created_by: payload?.id,
                },
            },
        });

        const plazas = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puestoId } });

        if (plazas.length > 0) {
            const empleadoId = payload?.id;
            let marcaDiaId = puestoId;

            if (empleadoId) {
                const marcaDia = await prisma.c_marca_dia.findFirst({
                    where: { empleadoCDG_id: empleadoId },
                    orderBy: { id: "desc" },
                });

                if (marcaDia) {
                    marcaDiaId = marcaDia.id;
                }
            }

            const notifBody = clearing
                ? `Se ha eliminado la ubicación GPS del puesto ${puesto.nombre || puesto.codigo || "N/A"}`
                : `Se ha actualizado la ubicación del puesto ${puesto.nombre || puesto.codigo || "N/A"} a la latitud ${latitud} y longitud ${longitud}`;
            await sendNotificationByPlaza(
                req,
                marcaDiaId,
                clearing ? "Ubicación del puesto eliminada" : "Ubicación del puesto actualizada",
                notifBody,
                plazas.map((plaza) => plaza.id),
            );
        }

        const updatedPuesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } });
        if (!updatedPuesto) {
            await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 404, "Puesto no encontrado");
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 404 }
            );
        }

        const updatedPuestoData = {
            id: updatedPuesto.id,
            nombre: updatedPuesto.nombre,
            codigo: updatedPuesto.codigo,
            coordenadas_gpslat: updatedPuesto.coordenadas_gpslat,
            coordenadas_gpslng: updatedPuesto.coordenadas_gpslng,
        };
        return NextResponse.json(
            {
                status: true,
                message: clearing
                    ? "Ubicación del puesto eliminada correctamente"
                    : "Ubicación del puesto actualizada correctamente",
                data: updatedPuesto,
            },
            { status: 200 },
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error updating puesto ubicacion:", errorMessage);
        await reportError(req, "api/puestos/[id]/ubicacion", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
