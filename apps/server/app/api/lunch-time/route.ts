import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";


export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { empleadoId, inicio, fin, pausas, es_manual, firma_empleado } = await req.json();

        const decodedFirma = (() => {
            try {
                if (!firma_empleado || String(firma_empleado).trim().length === 0) return null;
                const decoded = Buffer.from(String(firma_empleado), "base64").toString("utf-8");
                const parts = decoded.split(":");
                if (parts.length !== 5) return null;
                return {
                    sessionId: parts[0],
                    empleadoId: parts[1],
                    latitud: parts[2],
                    longitud: parts[3],
                    timestamp: parts[4],
                };
            } catch {
                return null;
            }
        })();

        const empleadoIdFromFirma = decodedFirma?.empleadoId ? parseInt(decodedFirma.empleadoId, 10) : NaN;
        const empleadoIdToUse = Number.isFinite(empleadoIdFromFirma) && empleadoIdFromFirma > 0
            ? empleadoIdFromFirma
            : parseInt(String(empleadoId), 10);

        if (!empleadoIdToUse || !inicio || !fin || !firma_empleado) {
            console.log('Faltan datos requeridos', { empleadoIdToUse, inicio, fin, firma_empleado });
            return NextResponse.json({ status: false, message: "Faltan datos requeridos" }, { status: 400 });
        }

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id: empleadoIdToUse },
            },
        });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const inicioDate = new Date(inicio);
        const finDate = new Date(fin);
        if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) {
            return NextResponse.json({ status: false, message: "Fechas de inicio/fin inválidas" }, { status: 400 });
        }

        // Calcular minutos totales entre inicio y fin
        const minutosTotales = Math.max(0, (finDate.getTime() - inicioDate.getTime()) / 60000);

        // Restar el tiempo transcurrido en pausas (si vienen)
        let minutosPausas = 0;
        try {
            const pausasParsed = JSON.parse(String(pausas || "[]"));
            const pausasArray = Array.isArray(pausasParsed) ? pausasParsed : [];
            for (const p of pausasArray) {
                const startRaw = (p.startTime ?? p.inicio ?? p.start) as any;
                const endRaw = (p.endTime ?? p.fin ?? p.end) as any;
                const pInicio = new Date(startRaw);
                const pFin = new Date(endRaw);
                if (!isNaN(pInicio.getTime()) && !isNaN(pFin.getTime()) && pFin.getTime() > pInicio.getTime()) {
                    minutosPausas += (pFin.getTime() - pInicio.getTime()) / 60000;
                }
            }
        } catch {
            minutosPausas = 0;
        }

        let minutosAlmuerzo = minutosTotales - minutosPausas;
        if (!Number.isFinite(minutosAlmuerzo) || minutosAlmuerzo < 0) minutosAlmuerzo = 0;
        // Limitar a 2 decimales
        minutosAlmuerzo = Number(minutosAlmuerzo.toFixed(2));
        const empleadoNombre = `${empleado.nombre || ""} ${empleado.primer_apellido || ""} ${empleado.segundo_apellido || ""}`.trim();
        const cedulaEmpleado = String(empleado.cedula || "");

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_empleado_almuerzo",
                data: {
                    empleadoId: empleadoIdToUse,
                    empleado_nombre: empleadoNombre,
                    cedula_empleado: cedulaEmpleado,
                    minutos_almuerzo: minutosAlmuerzo,
                    firma_empleado,
                    inicio: inicioDate.toISOString(),
                    fin: finDate.toISOString(),
                    pausas: String(pausas || "[]"),
                    es_manual: Boolean(es_manual),
                },
                returning: false
            }
        });
        return NextResponse.json({ status: true, message: "Almuerzo registrado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}