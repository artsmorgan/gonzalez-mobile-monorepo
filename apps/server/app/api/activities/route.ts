import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

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
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { marca_id, nombre_actividad, fecha_inicio, frecuencia, es_revision_equipo, descripcion_actividad, reglas, puestos_plazas, firma_responsable } = await req.json();

        if (!marca_id || !nombre_actividad || !fecha_inicio || !frecuencia || !es_revision_equipo || !descripcion_actividad || !reglas || !firma_responsable) {
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

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marca.empresa_id } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrada" }, { status: 200 });
        }

        const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: marca.contrato_id } });
        if (!contrato) {
            return NextResponse.json({ status: false, message: "Contrato no encontrada" }, { status: 200 });
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrada" }, { status: 200 });
        }

        const actividad_corpo = await prisma.e_actividad_corpo.create({
            data: {
                empresa_id: empresa.id,
                cliente_id: cliente.id,
                contrato_id: contrato.id,
                corpo_id: corpo.id,
                puesto_id: null,
                plaza_id: null,
                nombre_actividad: nombre_actividad,
                fecha_inicio: fecha_inicio,
                frecuencia: frecuencia,
                es_revision_equipo: es_revision_equipo,
                descripcion_actividad: descripcion_actividad,
                reglas: reglas,
                firma_responsable: firma_responsable,
            }
        });

        if (actividad_corpo) {
            for (const puesto of puestos_plazas) {
                const ps = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto.puesto_id } });
                if (ps) {
                    if (puesto.plazas.length > 0) {
                        for (const plaza of puesto.plazas) {
                            const pl = await prisma.e_estructura_plazas.findUnique({ where: { id: plaza.plaza_id } });
                            if (pl) {
                                await prisma.e_actividad_puesto_plaza.create({
                                    data: {
                                        actividadCorpo_id: actividad_corpo.id,
                                        puesto_id: ps.id,
                                        plaza_id: pl.id,
                                    }
                                });
                            }
                        }
                    }
                    else {
                        await prisma.e_actividad_puesto_plaza.create({
                            data: {
                                actividadCorpo_id: actividad_corpo.id,
                                puesto_id: ps.id,
                            }
                        });
                    }
                }
            }
        }

        return NextResponse.json({ status: true, message: "Actividad creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
