import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../utils/reportError";


export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            empleadoId,
            inicio,
            fin,
            pausas,
            es_manual,
            firma_empleado,
            marca_id: bodyMarcaId,
            empresa_id: bodyEmpresaId,
            cliente_id: bodyClienteId,
            division_id: bodyDivisionId,
            contrato_id: bodyContratoId,
            corpo_id: bodyCorpoId,
            puesto_id: bodyPuestoId,
        } = await req.json();

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
            await reportError(req, "api/lunch-time", "POST", 400, "Faltan datos requeridos");
            return NextResponse.json({ status: false, message: "Faltan datos requeridos" }, { status: 400 });
        }

        const marcaId = parseInt(String(bodyMarcaId), 10);
        const empresaId = parseInt(String(bodyEmpresaId), 10);
        const clienteId = parseInt(String(bodyClienteId), 10);
        const divisionId = parseInt(String(bodyDivisionId), 10);
        const contratoId = parseInt(String(bodyContratoId), 10);
        const corpoId = parseInt(String(bodyCorpoId), 10);
        const puestoId = parseInt(String(bodyPuestoId), 10);
        if (!Number.isFinite(marcaId) || marcaId <= 0) {
            await reportError(req, "api/lunch-time", "POST", 400, "Falta el identificador de la marca (marca_id). Verifique la marca actual.");
            return NextResponse.json(
                { status: false, message: "Falta el identificador de la marca (marca_id). Verifique la marca actual." },
                { status: 400 }
            );
        }
        if (
            !Number.isFinite(empresaId) || empresaId <= 0 ||
            !Number.isFinite(clienteId) || clienteId <= 0 ||
            !Number.isFinite(divisionId) || divisionId <= 0 ||
            !Number.isFinite(contratoId) || contratoId <= 0 ||
            !Number.isFinite(corpoId) || corpoId <= 0 ||
            !Number.isFinite(puestoId) || puestoId <= 0
        ) {
            await reportError(req, "api/lunch-time", "POST", 400, "Faltan datos de jerarquía (empresa, cliente, división, contrato, sucursal o puesto). Verifique la marca actual.");
            return NextResponse.json(
                { status: false, message: "Faltan datos de jerarquía (empresa, cliente, división, contrato, sucursal o puesto). Verifique la marca actual." },
                { status: 400 }
            );
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoIdToUse } });

        if (!empleado) {
            await reportError(req, "api/lunch-time", "POST", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const inicioDate = new Date(inicio);
        const finDate = new Date(fin);
        if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) {
            await reportError(req, "api/lunch-time", "POST", 400, "Fechas de inicio/fin inválidas");
            return NextResponse.json({ status: false, message: "Fechas de inicio/fin inválidas" }, { status: 400 });
        }

        let minutosPausas = 0;
        try {
            const pausasParsed = JSON.parse(String(pausas || "[]"));
            const pausasArray = Array.isArray(pausasParsed) ? pausasParsed : [];
            for (const p of pausasArray) {
                const startRaw = (p.startTime ?? p.inicio ?? p.start) as unknown;
                const endRaw = (p.endTime ?? p.fin ?? p.end) as unknown;
                const pInicio = new Date(startRaw as string | number | Date);
                const pFin = new Date(endRaw as string | number | Date);
                if (!isNaN(pInicio.getTime()) && !isNaN(pFin.getTime()) && pFin.getTime() > pInicio.getTime()) {
                    minutosPausas += (pFin.getTime() - pInicio.getTime()) / 60000;
                }
            }
        } catch {
            minutosPausas = 0;
        }

        const minutosTotales = Math.max(0, (finDate.getTime() - inicioDate.getTime()) / 60000);
        let minutosAlmuerzo = minutosTotales - minutosPausas;
        if (!Number.isFinite(minutosAlmuerzo) || minutosAlmuerzo < 0) minutosAlmuerzo = 0;
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
                    marca_id: marcaId,
                    empresa_id: empresaId,
                    cliente_id: clienteId,
                    division_id: divisionId,
                    contrato_id: contratoId,
                    corpo_id: corpoId,
                    puesto_id: puestoId,
                    isActive: true,
                },
                returning: false
            }
        });
        return NextResponse.json({ status: true, message: "Almuerzo registrado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        await reportError(req, "api/lunch-time", "POST", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
