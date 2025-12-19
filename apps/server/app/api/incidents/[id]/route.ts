/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { sendNotificationByRole } from "../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        if (!incidentId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const incident = await prisma.c_incidente.findUnique({ where: { id: incidentId } });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        const {
            marca_id,
            solucion,
            fecha_solucion,
            fecha_real_solucion,
            costo_asociado,
            consecutivo_informe,
            link_informe,
        } = await req.json();
        
        if (marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }
        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const updated = await prisma.c_incidente.update({
            where: { id: incidentId },
            data: {
                solucion: typeof solucion === "string" ? solucion : incident.solucion,
                fecha_solucion:
                    typeof fecha_solucion === "string"
                        ? (fecha_solucion.trim().length > 0 ? new Date(fecha_solucion) : null)
                        : incident.fecha_solucion,
                fecha_real_solucion:
                    typeof fecha_real_solucion === "string"
                        ? (fecha_real_solucion.trim().length > 0 ? new Date(fecha_real_solucion) : null)
                        : incident.fecha_real_solucion,
                costo_asociado:
                    typeof costo_asociado === "string" ? (costo_asociado.trim().length > 0 ? costo_asociado : null) : incident.costo_asociado,
                consecutivo_informe:
                    typeof consecutivo_informe === "string" ? (consecutivo_informe.trim().length > 0 ? consecutivo_informe : null) : incident.consecutivo_informe,
                link_informe:
                    typeof link_informe === "string" ? (link_informe.trim().length > 0 ? link_informe : null) : incident.link_informe,
            },
        });

        if (updated && incident.fecha_solucion) {
            const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: incident.clasificacion } });
            const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: incident.corpo_id } });
            const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: incident.cliente_id } });
            if (clasificacion && sucursal && cliente) {
                const fecha_string = incident.fecha_solucion.toISOString().split("T")[0];
                const hora_string = incident.fecha_solucion.toISOString().split("T")[1].split(".")[0];
                const description = `Se ha actualizado el incidente de tipo ${clasificacion.nombre} en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
                sendNotificationByRole(marca.id, "Incidente actualizado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

        return NextResponse.json({ status: true, message: "Incidente actualizado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/incidents/[id]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        if (!incidentId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const incident = await prisma.c_incidente.findUnique({
            where: { id: incidentId },
            include: { c_archivos_incidente: true },
        });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        // Borra registro (archivos en DB por cascade, y borramos directorio físico)
        await prisma.c_incidente.delete({ where: { id: incidentId } });

        const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`);
        if (fs.existsSync(dir)) {
            // eliminar contenido
            for (const f of fs.readdirSync(dir)) {
                try {
                    fs.unlinkSync(path.join(dir, f));
                } catch {
                    // ignore
                }
            }
            try {
                fs.rmdirSync(dir);
            } catch {
                // ignore
            }
        }

        return NextResponse.json({ status: true, message: "Incidente eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/incidents/[id]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


