import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { sendNotificationByPlaza } from "../../../utils/sendNotification";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        return NextResponse.json({ status: true, message: "Método GET" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { marca_id, nombre_actividad, fecha_inicio, frecuencia, es_revision_equipo, descripcion_actividad, reglas, puestos_plazas, firma_responsable } = await req.json();

        if (!marca_id || !nombre_actividad || !fecha_inicio || !frecuencia || es_revision_equipo === undefined || !descripcion_actividad || !reglas || !firma_responsable) {
            console.log("marca_id", marca_id);
            console.log("nombre_actividad", nombre_actividad);
            console.log("fecha_inicio", fecha_inicio);
            console.log("frecuencia", frecuencia);
            console.log("es_revision_equipo", es_revision_equipo);
            console.log("descripcion_actividad", descripcion_actividad);
            console.log("reglas", reglas);
            console.log("puestos_plazas", puestos_plazas);
            console.log("firma_responsable", firma_responsable);
            console.log("--------------------------------");
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({ req, data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marca_id } } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const actividad = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_actividades",
                data: {
                    nombre_actividad: nombre_actividad,
                    fecha_inicio: new Date(fecha_inicio).toISOString(),
                    frecuencia: frecuencia,
                    es_revision_equipo: es_revision_equipo,
                    descripcion_actividad: descripcion_actividad,
                    firma_responsable: firma_responsable,
                }
            }
        });

        if (actividad) {
            const plazas_ids: number[] = [];
            const puestos_plazas_parse = Array.isArray(JSON.parse(puestos_plazas || "[]")) ? JSON.parse(puestos_plazas || "[]") : [];
            const uniquePuestoIds = Array.from(
                new Set(
                    puestos_plazas_parse
                        .map((p: any) => Number(p?.puesto_id))
                        .filter((v: number) => Number.isFinite(v) && v > 0)
                )
            );

            for (const puestoId of uniquePuestoIds) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_actividades_puesto",
                        data: { actividad_id: actividad.id, puesto_id: puestoId },
                    },
                });
            }

            for (const puesto of puestos_plazas_parse) {
                const puesto_id = Number(puesto?.puesto_id || 0);
                if (!puesto_id) continue;
                if (Array.isArray(puesto?.plazas) && puesto.plazas.length > 0) {
                    for (const plaza of puesto.plazas) {
                        const plaza_id = Number(plaza?.plaza_id || 0);
                        if (plaza_id && !plazas_ids.includes(plaza_id)) plazas_ids.push(plaza_id);
                    }
                } else {
                    const plzs = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_plazas", operation: "findMany", where: { puesto_id } },
                    });
                    for (const plz of Array.isArray(plzs) ? plzs : []) {
                        if (plz?.id && !plazas_ids.includes(plz.id)) plazas_ids.push(plz.id);
                    }
                }
            }

            const frecuencia_parse = JSON.parse(frecuencia);
            await sendNotificationByPlaza(req, marca_id, "Actividad asignada", `Se te ha asignado la actividad ${nombre_actividad}, la cual deberá realizarse "${frecuencia_parse.title}"`, plazas_ids);
        }

        return NextResponse.json({ status: true, message: "Actividad creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log("errorMessage", errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
