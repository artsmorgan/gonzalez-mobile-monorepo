import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import { getUserMarca } from "../../../../../utils/getUserMarca";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const searchParams = req.nextUrl.searchParams;
        const latitude = searchParams.get("lat");
        const longitude = searchParams.get("long");

        if (!latitude || !longitude) {
            return NextResponse.json({ status: false, message: "Latitude y longitude no especificadas" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const marcaDia = await getUserMarca(empleado.id);
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marcaDia.empresa_id } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marcaDia.cliente_id } });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
        }

        const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: marcaDia.contrato_id } });
        if (!contrato) {
            return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 200 });
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id } });
        if (!plaza) {
            return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
        }

        const horario = await prisma.c_horario.findUnique({ where: { id: marcaDia.horario_id } });
        if (!horario) {
            return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 200 });
        }

        const estado = marcaDia.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";
        if (marcaDia.hora_salida_digitada != null) {
            return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
        }

        let change_available = true;
        let is_late = false;
        let next_time = null;
        if (marcaDia.hora_inicio && marcaDia.hora_fin) {

            const hora_inicio = toZonedTime(new Date(), "America/Costa_Rica");
            hora_inicio.setHours(marcaDia.hora_inicio.getHours(), marcaDia.hora_inicio.getMinutes(), marcaDia.hora_inicio.getSeconds(), 0);
            const hora_fin = toZonedTime(new Date(), "America/Costa_Rica");
            hora_fin.setHours(marcaDia.hora_fin.getHours(), marcaDia.hora_fin.getMinutes(), marcaDia.hora_fin.getSeconds(), 0);

            if (toZonedTime(new Date(), "America/Costa_Rica") > hora_fin && marcaDia.hora_entrada_digitada == null) {
                return NextResponse.json({ status: false, absent: true, message: "No has marcado la entrada y has sido declarado como ausente" }, { status: 200 });
            }

            next_time = new Date(estado == "No ingresado" ? hora_inicio : hora_fin);
            const next_change_time = new Date(next_time.getTime());
            next_change_time.setMinutes(next_change_time.getMinutes() - 15);
            if (toZonedTime(new Date(), "America/Costa_Rica") < next_change_time) { // Si la fecha del parámetro es menor a la fecha de la marca menos 15 menos minutos
                change_available = false;
            }

            if (toZonedTime(new Date(), "America/Costa_Rica") > next_time) {
                is_late = true;
            }
        }
        else {
            return NextResponse.json({ status: false, message: "Horario de entrada y salida no configurado" }, { status: 200 });
        }

        const empleado_plaza = await prisma.c_empleado_plaza.findFirst({
            where: {
                empleado_id: empleado.id,
                plaza_id: marcaDia.plaza_id
            }
        });

        const roleDivision: { role: { nombre: string, id: number }, division: { nombre: string, id: number } } = {
            role: { id: 0, nombre: "" },
            division: { id: 0, nombre: "" },
        };

        if (empleado_plaza && empleado_plaza.plaza_id && empleado_plaza.division_id) {
            const division = await prisma.n_division.findFirst({
                where: {
                    id: empleado_plaza.division_id
                }
            });

            if (division) {
                roleDivision.division.id = division.id;
                roleDivision.division.nombre = division.nombre;
            }

            if (plaza.categoriaSalarial_id) {
                const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
                    where: {
                        id: plaza.categoriaSalarial_id
                    }
                });

                if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
                    const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
                        where: {
                            id: categoria_salarial.categoriaEmpleado_id
                        }
                    });

                    if (categoria_empleado) {
                        let role = "OPERATIVO";
                        switch (categoria_empleado.codigo) {
                            case "OFI":
                                role = "OPERATIVO";
                                break;
                            case "MIS":
                                role = "OPERATIVO";
                                break;
                            case "ADM":
                                role = "ADMINISTRATIVO";
                                break;
                            case "COO":
                                role = "SUPERVISOR";
                                break;
                            case "SUP":
                                role = "SUPERVISOR";
                                break;
                            case "OFC":
                                role = "OPERATIVO";
                                break;
                        }

                        roleDivision.role.id = categoria_empleado.id;
                        roleDivision.role.nombre = role;
                    }
                }
            }
        }

        const marca_return = {
            id: marcaDia.id,
            hora_entrada_digitada: marcaDia.hora_entrada_digitada,
            hora_salida_digitada: marcaDia.hora_salida_digitada,
            hora_inicio: marcaDia.hora_inicio,
            hora_fin: marcaDia.hora_fin,
            fecha: marcaDia.fecha,
            tipo_turno: marcaDia.tipo_turno,
            horas_duracion: marcaDia.horas_duracion,
            roleDivision: roleDivision,
            empresa: {
                id: empresa.id,
                nombre: empresa.nombre
            },
            cliente: {
                id: cliente.id,
                nombre: cliente.nombre
            },
            contrato: {
                id: contrato.id,
                nombre: contrato.nombre
            },
            corpo: {
                id: corpo.id,
                nombre: corpo.nombre,
                ubicacion: {
                    lat: corpo.coordenadas_gpslat,
                    lng: corpo.coordenadas_gpslng
                }
            },
            puesto: {
                id: puesto.id,
                nombre: puesto.nombre
            },
            plaza: {
                id: plaza.id,
                nombre: plaza.nombre
            },
            horario: {
                id: horario.id,
                nombre: horario.titulo
            }
        };

        const data = {
            status: true,
            current_time: toZonedTime(new Date(), "America/Costa_Rica"), // Se define aquí
            marca: marca_return
        }

        return NextResponse.json(data, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}