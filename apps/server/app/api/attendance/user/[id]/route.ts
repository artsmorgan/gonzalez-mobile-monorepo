import { NextRequest, NextResponse } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 }
            );
        }

        console.log("Buscamos en el endpoint de attendance/user/[id]");

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const searchParams = req.nextUrl.searchParams;
        const latitude = searchParams.get("lat");
        const longitude = searchParams.get("long");

        if (!latitude || !longitude) {
            return NextResponse.json({ status: false, message: "Latitude y longitude no especificadas" }, { status: 200 });
        }

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }


        let now = toZonedTime(new Date(), "America/Costa_Rica");
        now = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restarle 6 horas para que sea en la zona horaria de Costa Rica
        const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
        const currentDate = new Date(now.toISOString().split("T")[0]);
        const currentTime = new Date("1970-01-01 " + now.toTimeString().slice(0, 8));

        const employeeWhere = {
            OR: [
                { empleadoFijo_id: empleado.id },
                { empleadoReemplaza_id: empleado.id },
            ],
        };

        const buildMarcaDateTime = (marca: { fecha: Date; hora_inicio: Date | null }) => {
            if (!marca.hora_inicio) return null;
            const fechaIso = new Date(marca.fecha).toISOString().split("T")[0];
            const horaIso = new Date(marca.hora_inicio).toISOString().split("T")[1];
            return new Date(`${fechaIso}T${horaIso}`);
        };

        console.log("now", now);
        console.log("nowPlus15", nowPlus15);
        console.log("currentDate", currentDate);
        console.log("currentTime", currentTime);

        const proximasMarcas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findMany",
                where: {
                    AND: [
                        employeeWhere,
                        {
                            fecha: {
                                gte: currentDate,
                            },
                        },
                    ],
                },
                orderBy: [
                    { fecha: "asc" },
                    { hora_inicio: "asc" },
                ],
                take: 24,
            }
        });

        let marcaDia = null;
        if (Array.isArray(proximasMarcas)) {
            for (const marca of proximasMarcas) {
                const marcaDateTime = buildMarcaDateTime(marca);
                if (!marcaDateTime) {
                    continue;
                }
                if (marcaDateTime >= now && marcaDateTime <= nowPlus15) {
                    marcaDia = marca;
                    console.log("Usaremos próximo en ventana +15 min");
                    break;
                }
            }
        }

        if (!marcaDia) {
            const ultimasMarcas = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_marca_dia",
                    operation: "findMany",
                    where: {
                        AND: [
                            employeeWhere,
                            {
                                fecha: {
                                    lte: currentDate,
                                },
                            },
                        ],
                    },
                    orderBy: [
                        { fecha: "desc" },
                        { hora_inicio: "desc" },
                    ],
                    take: 24,
                }
            });

            if (Array.isArray(ultimasMarcas)) {
                for (const marca of ultimasMarcas) {
                    const marcaDateTime = buildMarcaDateTime(marca);
                    console.log("marcaDateTime", marcaDateTime);
                    if (!marcaDateTime) {
                        continue;
                    }
                    if (marcaDateTime < now) {
                        marcaDia = marca;
                        console.log("Usaremos última anterior al momento actual");
                        break;
                    }
                }
            }
        }

        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        console.log("Marca dia", marcaDia.id);

        if (marcaDia.empleadoFijo_id == empleado.id && marcaDia.empleadoReemplaza_id != null) {
            const empleadoReemplaza = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: marcaDia.empleadoReemplaza_id }
                }
            });
            const nombreReemplaza = empleadoReemplaza ? empleadoReemplaza.nombre + " " + empleadoReemplaza.primer_apellido + " " + empleadoReemplaza.segundo_apellido : "con código " + empleadoReemplaza.codigo;
            return NextResponse.json({ status: false, message: "El empleado " + nombreReemplaza + " está cubriendo tu turno" }, { status: 200 });
        }

        const empresa = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_empresa",
                operation: "findUnique",
                where: { id: marcaDia.empresa_id }
            }
        });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_cliente",
                operation: "findUnique",
                where: { id: marcaDia.cliente_id }
            }
        });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
        }

        const contrato = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_contrato",
                operation: "findUnique",
                where: { id: marcaDia.contrato_id }
            }
        });
        if (!contrato) {
            return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 200 });
        }

        const corpo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_sucursal",
                operation: "findUnique",
                where: { id: marcaDia.corpo_id }
            }
        });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id: marcaDia.puesto_id }
            }
        });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const plaza = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_plazas",
                operation: "findUnique",
                where: { id: marcaDia.plaza_id }
            }
        });
        if (!plaza) {
            return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
        }

        const horario = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_horario",
                operation: "findUnique",
                where: { id: marcaDia.horario_id }
            }
        });
        if (!horario) {
            return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 200 });
        }
        
        // Obtener las solicitudes de permiso aprobadas del empleado cuyo rango de fechas contenga la fecha de la marca
        const solicitudesPermiso = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_solicitud_permiso",
                operation: "findMany",
                where: {
                    empleado_id: empleado.id,
                    plaza_id: marcaDia.plaza_id,
                    fecha_inicio: {
                        lte: marcaDia.fecha
                    },
                    fecha_fin: {
                        gte: marcaDia.fecha
                    },
                    estado: "aprobado"
                }
            }
        });

        if (solicitudesPermiso.length > 0) {
            return NextResponse.json({ status: false, message: "Tienes un permiso aprobado para el puesto " + puesto.nombre + " para el día " + marcaDia.fecha.toISOString().split("T")[0] }, { status: 200 });
        }

        const estado = marcaDia.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";
        if (marcaDia.hora_salida_digitada != null) {
            return NextResponse.json({ status: false, absent: false, message: "Ya has marcado la salida", marca_id: marcaDia.id }, { status: 200 });
        }

        let change_available = true;
        let is_late = false;
        let next_time = null;
        if (marcaDia.hora_inicio && marcaDia.hora_fin) {

            const fecha_marca_string = marcaDia.fecha.split("T")[0];
            const hora_inicio_string = marcaDia.hora_inicio.split("T")[1];
            const inicio_marca = new Date(fecha_marca_string + "T" + hora_inicio_string);

            let fin_marca = null;
            if (marcaDia.horas_duracion) {
                const horas_duracion = parseFloat(marcaDia.horas_duracion.toString());
                fin_marca = new Date(inicio_marca.getTime() + horas_duracion * 60 * 60 * 1000);
            }
            else {
                // Definimos si marcaDia.hora_inicio es mayor a marcaDia.hora_fin, si es así, entonces la hora_fin es el siguiente día
                if (new Date(marcaDia.hora_inicio) > new Date(marcaDia.hora_fin)) {
                    fin_marca = new Date(marcaDia.fecha.setDate(marcaDia.fecha.getDate() + 1));
                }
                else {
                    const hora_fin_string = marcaDia.hora_fin.split("T")[1];
                    fin_marca = new Date(fecha_marca_string + "T" + hora_fin_string);
                }
            }

            console.log("momento_inicio_marca", inicio_marca);
            console.log("momento_fin_marca", fin_marca);

            if (now > fin_marca && marcaDia.hora_entrada_digitada == null) {
                const hora_inicio_string = inicio_marca.toISOString().split("T")[1].split(".")[0];
                const fecha_marca_string = marcaDia.fecha.split("T")[0].split("-").reverse().join("-");

                let should_response = true;
                let extra_reason = "";
                if (marcaDia.accionPersonal_id != null) {
                    const accionPersonal = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "c_accion_personal",
                            operation: "findUnique",
                            where: { id: marcaDia.accionPersonal_id }
                        }
                    });
                    if (accionPersonal) {
                        if (accionPersonal.tipoAccion_id == 5 && accionPersonal.ausencia_id != null) {
                            const ausencia = await callDynamicPrisma({
                                req,
                                data: {
                                    action: "GET",
                                    table: "c_ausencia",
                                    operation: "findUnique",
                                    where: { id: accionPersonal.ausencia_id }
                                }
                            });
                            if (ausencia) {
                                if (ausencia.tipo == "JUS") {
                                    should_response = false;
                                    extra_reason = " Razon: " + accionPersonal.comentarios;
                                }
                            }
                        }
                    }
                }

                return NextResponse.json({ status: false, absent: true, should_response, message: "No has marcado la entrada para el turno del día " + fecha_marca_string + " a las " + hora_inicio_string + "." + extra_reason, marca_id: marcaDia.id }, { status: 200 });
            }

            next_time = new Date(estado == "No ingresado" ? inicio_marca : fin_marca);
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

        const empleado_plaza = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_plaza",
                operation: "findFirst",
                where: {
                    empleado_id: empleado.id,
                    plaza_id: marcaDia.plaza_id
                }
            }
        });

        const roleDivision: { role: { nombre: string, id: number }, division: { nombre: string, id: number } } = {
            role: { id: 0, nombre: "" },
            division: { id: 0, nombre: "" },
        };

        if (empleado_plaza && empleado_plaza.plaza_id && empleado_plaza.division_id) {
            const division = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "n_division",
                    operation: "findFirst",
                    where: {
                        id: empleado_plaza.division_id
                    }
                }
            });

            if (division) {
                roleDivision.division.id = division.id;
                roleDivision.division.nombre = division.nombre;
            }

            if (plaza.categoriaSalarial_id) {
                const categoria_salarial = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "pg_categoria_salarial",
                        operation: "findFirst",
                        where: {
                            id: plaza.categoriaSalarial_id
                        }
                    }
                });

                if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
                    const categoria_empleado = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "pg_categoria_empleado",
                            operation: "findFirst",
                            where: {
                                id: categoria_salarial.categoriaEmpleado_id
                            }
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
                            case "OFC":
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
            empleadoFijo_id: empleado.id,
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
                nombre: puesto.nombre,
                tiene_relevo: puesto.tiene_relevo ?? false,
                ubicacion: {
                    lat: puesto.coordenadas_gpslat ? parseFloat(puesto.coordenadas_gpslat) : null,
                    lng: puesto.coordenadas_gpslng ? parseFloat(puesto.coordenadas_gpslng) : null
                }
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