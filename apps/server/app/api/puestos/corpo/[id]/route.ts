import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../../utils/prismaClient";
import { reportError } from "../../../../../utils/reportError";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await prisma.e_estructura_sucursal.findFirst({ where: { id } });
        if (!corpo) {
            await reportError(req, "api/puestos/corpo/[id]", "GET", 404, "Corpo no encontrado");
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 404 });
        }

        const puestos = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpo.id } });
        const puestoIds = puestos.map((p) => p.id);
        const plazas = puestoIds.length
            ? await prisma.e_estructura_plazas.findMany({ where: { puesto_id: { in: puestoIds } } })
            : [];
        const plazaIds = plazas.map((p) => p.id);
        const empleadosPlaza = plazaIds.length
            ? await prisma.c_empleado_plaza.findMany({ where: { plaza_id: { in: plazaIds } } })
            : [];
        const empleadoIds = Array.from(
            new Set(
                empleadosPlaza
                    .map((ep) => ep.empleado_id)
                    .filter((eid): eid is number => typeof eid === "number" && eid > 0)
            )
        );
        const empleados = empleadoIds.length
            ? await prisma.c_empleado.findMany({ where: { id: { in: empleadoIds } } })
            : [];
        const empleadoById = new Map(empleados.map((e) => [e.id, e]));

        const plazasByPuestoId = new Map<number, typeof plazas>();
        for (const plaza of plazas) {
            const pid = plaza.puesto_id;
            if (pid == null) continue;
            const list = plazasByPuestoId.get(pid) ?? [];
            list.push(plaza);
            plazasByPuestoId.set(pid, list);
        }

        const empleadosPlazaByPlazaId = new Map<number, typeof empleadosPlaza>();
        for (const ep of empleadosPlaza) {
            const plid = ep.plaza_id;
            if (plid == null) continue;
            const list = empleadosPlazaByPlazaId.get(plid) ?? [];
            list.push(ep);
            empleadosPlazaByPlazaId.set(plid, list);
        }

        const puestos_return: { id: number; nombre: string; plazas: { id: number; nombre: string; empleados: { nombre: string; primer_apellido: string; segundo_apellido: string }[] }[] }[] = [];
        for (const puesto of puestos) {
            const plazas_return: { id: number; nombre: string; empleados: { nombre: string; primer_apellido: string; segundo_apellido: string }[] }[] = [];
            for (const plaza of plazasByPuestoId.get(puesto.id) ?? []) {
                const empleados_plaza_return: { nombre: string; primer_apellido: string; segundo_apellido: string }[] = [];
                for (const empleado_plaza of empleadosPlazaByPlazaId.get(plaza.id) ?? []) {
                    if (!empleado_plaza.empleado_id) continue;
                    const empleado = empleadoById.get(empleado_plaza.empleado_id);
                    if (!empleado) continue;
                    if (empleado.fecha_contratacion == null) continue;
                    if (empleado.estado === "BA") continue;
                    empleados_plaza_return.push({
                        nombre: empleado.nombre || "",
                        primer_apellido: empleado.primer_apellido || "",
                        segundo_apellido: empleado.segundo_apellido || "",
                    });
                }
                plazas_return.push({ id: plaza.id, nombre: plaza.nombre, empleados: empleados_plaza_return });
            }
            puestos_return.push({ id: puesto.id, nombre: puesto.nombre, plazas: plazas_return });
        }
        return NextResponse.json({ status: true, puestos: puestos_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/puestos/corpo/[id]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
