import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";
import { reportError } from "../../../../utils/reportError";
import { armarMisPuestos, hoyEnCostaRicaComoFecha, proximaFechaPorPuesto } from "../../../../utils/misPuestos";

/**
 * «Mis puestos» (módulo Ubicación del puesto): los puestos del empleado que consulta (el del token) según `puesto_id` de sus marcas en `c_marca_dia`
 * donde es el fijo (`empleadoFijo_id`) o el reemplazo (`empleadoReemplaza_id`), solo con marcas de la fecha de hoy (Costa Rica) en adelante.
 * Cada puesto trae sus coordenadas (si las tiene) para mostrarlo en el mapa y llegar con Waze.
 */
export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const empleadoId = Number(payload?.id);
        if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
            await reportError(req, "api/puestos/mis-puestos", "GET", 400, "Empleado inválido");
            return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
        }

        const marcas = await prisma.c_marca_dia.findMany({
            where: {
                OR: [{ empleadoFijo_id: empleadoId }, { empleadoReemplaza_id: empleadoId }],
                fecha: { gte: hoyEnCostaRicaComoFecha() },
                puesto_id: { not: null },
            },
            select: { puesto_id: true, fecha: true },
        });

        const proximas = proximaFechaPorPuesto(marcas);
        const puestoIds = Array.from(proximas.keys());
        if (puestoIds.length === 0) {
            return NextResponse.json({ status: true, puestos: [] }, { status: 200 });
        }

        const puestos = await prisma.e_estructura_puesto.findMany({
            where: { id: { in: puestoIds } },
            select: { id: true, nombre: true, codigo: true, sucursal_id: true, coordenadas_gpslat: true, coordenadas_gpslng: true },
        });

        const sucursalIds = Array.from(new Set(puestos.map((p) => p.sucursal_id).filter((v): v is number => typeof v === "number" && v > 0)));
        const sucursales = new Map<number, string>();
        if (sucursalIds.length > 0) {
            const rows = await prisma.e_estructura_sucursal.findMany({ where: { id: { in: sucursalIds } }, select: { id: true, nombre: true } });
            for (const row of rows) sucursales.set(row.id, String(row.nombre ?? "").trim());
        }

        return NextResponse.json({ status: true, puestos: armarMisPuestos(puestos, proximas, sucursales) }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/puestos/mis-puestos", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
