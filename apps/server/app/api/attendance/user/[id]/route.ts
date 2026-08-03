import { NextRequest, NextResponse } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import getRoleDivision from "../../../../../utils/getRoleDivision";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { getMonitoringPreviousMinutes } from "../../../../../utils/getMonitoringPreviousMinutes";
import { getMonitoringPostMinutes } from "../../../../../utils/getMonitoringPostMinutes";
import axios from "axios";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const searchParams = req.nextUrl.searchParams;
        const latitude = searchParams.get("lat");
        const longitude = searchParams.get("long");
        // Planillas token deben ser obtenido del header de la request
        const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;

        if (!planillasToken) {
            return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 200 });
        }

        // Ubicación: validación en el dispositivo; lat/long opcionales en este endpoint.

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        let now = toZonedTime(new Date(), "America/Costa_Rica");
        //now = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restarle 6 horas para que sea en la zona horaria de Costa Rica
        const monitoringPreviousMinutes = await getMonitoringPreviousMinutes(req);
        const monitoringPostMinutes = await getMonitoringPostMinutes(req);
        const nowPlusMonitoringWindow = new Date(now.getTime() + monitoringPreviousMinutes * 60 * 1000);
        const currentDate = new Date(now.toISOString().split("T")[0]);
        const currentTime = new Date("1970-01-01 " + now.toTimeString().slice(0, 8));

        const employeeWhere = {
            OR: [
                { empleadoFijo_id: empleado.id },
                { empleadoReemplaza_id: empleado.id },
            ],
        };

        const buildMarcaDateTime = (marca: { fecha: Date; hora_inicio: Date | null }) => {
            if (!marca.hora_inicio) marca.hora_inicio = new Date("1970-01-01 00:00:00");
            const fechaIso = new Date(marca.fecha).toISOString().split("T")[0];
            const horaIso = new Date(marca.hora_inicio).toISOString().split("T")[1];
            return new Date(`${fechaIso}T${horaIso}`);
        };

        /*
        const previousWhere = {
            AND: [
                employeeWhere,
                {
                    fecha: {
                        gte: currentDate,
                    }
                },
                {
                    tipo_turno: {
                        not: "L",
                    },
                },
                {
                    tipo_turno: {
                        not: null,
                    },
                },
            ],
        },*/

        let dias_transcurridos = 0;
        let date_while = currentDate;
        let marcas_planillas: any[] = [];

        while (dias_transcurridos < 14 && marcas_planillas.length == 0) {
            const planillasResponse = await axios.get(`${process.env.PLANILLAS_URL}/marcas`, {
                headers: {
                    "Authorization": `Bearer ${planillasToken}`
                },
                params: {
                    empleado_codigo: empleado.codigo,
                    fecha: date_while.toISOString().split("T")[0],
                }
            });

            dias_transcurridos++;
            date_while = new Date(date_while.getTime() + 1 * 24 * 60 * 60 * 1000);
            marcas_planillas = planillasResponse.data.data.marcas;
        }

        let marcas_ids = [ 0 ];
        if (marcas_planillas.length > 0) {
            marcas_ids = marcas_planillas.map((marca: any) => marca.id);
        }

        let proximasMarcas = await prisma.c_marca_dia.findMany({
            where: { id: { in: marcas_ids } },
            orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
        });

        // Eliminar aquellas marcas donde "empleadoReemplaza_id" sea diferente de null y diferente a "empleado.id"
        proximasMarcas = proximasMarcas.filter((marca: any) => !(marca.empleadoFijo_id === empleado.id && marca.empleadoReemplaza_id !== null));
        let marcaDia = null;
        if (Array.isArray(proximasMarcas)) {
            for (const marca of proximasMarcas) {
                const marcaDateTime = buildMarcaDateTime(marca);
                if (!marcaDateTime) {
                    continue;
                }
                if (marcaDateTime >= now && marcaDateTime <= nowPlusMonitoringWindow) {
                    marcaDia = marca;
                    console.log(`Usaremos próximo en ventana +${monitoringPreviousMinutes} min`);
                    break;
                }
            }
        }

        if (!marcaDia) {

            dias_transcurridos = 0;
            date_while = currentDate;
            marcas_planillas = [];
    
            while (dias_transcurridos < 14 && marcas_planillas.length == 0) {
                const planillasResponse = await axios.get(`${process.env.PLANILLAS_URL}/marcas`, {
                    headers: {
                        "Authorization": `Bearer ${planillasToken}`
                    },
                    params: {
                        empleado_codigo: empleado.codigo,
                        fecha: date_while.toISOString().split("T")[0],
                    }
                });
    
    
                dias_transcurridos++;
                date_while = new Date(date_while.getTime() - 1 * 24 * 60 * 60 * 1000); // Retroceder 1 día
                marcas_planillas = planillasResponse.data.data.marcas;
            }
    
            let marcas_ids = [ 0 ];
            if (marcas_planillas.length > 0) {
                marcas_ids = marcas_planillas.map((marca: any) => marca.id);
            }

            let ultimasMarcas = await prisma.c_marca_dia.findMany({
                where: { id: { in: marcas_ids } },
                orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }],
            });

            // Eliminar aquellas marcas donde "empleadoReemplaza_id" sea diferente de null y diferente a "empleado.id"
            ultimasMarcas = ultimasMarcas.filter((marca: any) => !(marca.empleadoFijo_id === empleado.id && marca.empleadoReemplaza_id !== null));

            if (Array.isArray(ultimasMarcas)) {
                for (const marca of ultimasMarcas) {
                    const marcaDateTime = buildMarcaDateTime(marca);
                    if (!marcaDateTime) {
                        continue;
                    }
                    if (marcaDateTime < now) {
                        marcaDia = marca;
                        break;
                    }
                }
            }
        }

        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        if (!marcaDia.empresa_id) {
            return NextResponse.json({ status: false, message: "No se encontró la empresa" }, { status: 200 });
        }

        if (!marcaDia.cliente_id) {
            return NextResponse.json({ status: false, message: "No se encontró el cliente" }, { status: 200 });
        }

        if (!marcaDia.contrato_id) {
            return NextResponse.json({ status: false, message: "No se encontró el contrato" }, { status: 200 });
        }

        if (!marcaDia.corpo_id) {
            return NextResponse.json({ status: false, message: "No se encontró la sucursal" }, { status: 200 });
        }

        if (!marcaDia.puesto_id) {
            return NextResponse.json({ status: false, message: "No se encontró el puesto" }, { status: 200 });
        }

        if (!marcaDia.plaza_id) {
            return NextResponse.json({ status: false, message: "No se encontró la plaza" }, { status: 200 });
        }

        if (!marcaDia.horario_id) {
            return NextResponse.json({ status: false, message: "No se encontró el horario" }, { status: 200 });
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

        let puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id ?? 0 } });

        let plaza = null;
        if (puesto) {
            plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id ?? 0 } });
            if (!plaza) {
                plaza = null;
            }
        }
        else {
            puesto = null;
        }

        let horario = await prisma.c_horario.findUnique({ where: { id: marcaDia.horario_id ?? 0 } });

        if (!horario) {
            horario = null;
        }

        const roleDivision = await getRoleDivision(req, plaza, contrato);

        const nomenclatores = await getNomenclators(req);

        const razonAusencia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_razon_ausencia",
                operation: "findFirst",
                where: { marca_id: marcaDia.id },
            },
        });

        const isSalidaAnticipada = marcaDia.hora_salida_anticipada != null;

        const marca_return = {
            id: marcaDia.id,
            hora_entrada_digitada: marcaDia.hora_entrada_digitada ?? null,
            hora_salida_digitada: marcaDia.hora_salida_digitada ?? null,
            hora_salida_anticipada: marcaDia.hora_salida_anticipada ?? null,
            hora_inicio: marcaDia.hora_inicio,
            hora_fin: marcaDia.hora_fin,
            fecha: marcaDia.fecha,
            tipo_turno: marcaDia.tipo_turno,
            horas_duracion: marcaDia.horas_duracion,
            roleDivision: roleDivision,
            empleadoFijo_id: empleado.id,
            nomencladores: nomenclatores,
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
                id: puesto?.id ?? 0,
                nombre: puesto?.nombre ?? "Indefinido",
                tiene_relevo: puesto?.tiene_relevo ?? false,
                ubicacion: {
                    lat: puesto?.coordenadas_gpslat ? parseFloat(puesto?.coordenadas_gpslat) : null,
                    lng: puesto?.coordenadas_gpslng ? parseFloat(puesto?.coordenadas_gpslng) : null
                }
            },
            plaza: {
                id: plaza?.id ?? 0,
                nombre: plaza?.nombre ?? "Indefinido"
            },
            horario: {
                id: horario?.id ?? 0,
                nombre: horario?.titulo ?? "Indefinido"
            },
            ausencia_comentario: razonAusencia?.razon ? String(razonAusencia.razon) : null,
        };

        console.log("marca_return: ", marca_return);

        const blockedMarcaResponse = (
            message: string,
            extra: Record<string, unknown> = {}
        ) =>
            NextResponse.json(
                {
                    status: false,
                    mark_blocked: true,
                    current_time: currentTime,
                    marca: marca_return,
                    marca_id: marca_return.id,
                    monitoring_previous_minutes: monitoringPreviousMinutes,
                    monitoring_post_minutes: monitoringPostMinutes,
                    is_salida_anticipada: isSalidaAnticipada,
                    message,
                    ...extra,
                },
                { status: 200 }
            );

        if (marcaDia.empleadoFijo_id == empleado.id && marcaDia.empleadoReemplaza_id != null) {
            const empleadoReemplaza = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoReemplaza_id } });
            if (!empleadoReemplaza) {
                return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
            }
            const nombreCompleto = [empleadoReemplaza.nombre, empleadoReemplaza.primer_apellido, empleadoReemplaza.segundo_apellido]
                .filter(Boolean)
                .join(" ")
                .trim();
            const nombreReemplaza = nombreCompleto || `con código ${empleadoReemplaza.codigo ?? "indefinido"}`;
            return blockedMarcaResponse("El empleado " + nombreReemplaza + " está cubriendo tu turno");
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
                    plaza_id: marcaDia.plaza_id ?? 0,
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
            let puesto_name = puesto?.nombre ?? "Indefinido";
            return blockedMarcaResponse(
                "Tienes un permiso aprobado para el puesto " +
                    puesto_name +
                    " para el día " +
                    new Date(marcaDia.fecha).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                    })
            );
        }

        const estado = marcaDia.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";
        if (marcaDia.hora_salida_digitada != null) {
            return blockedMarcaResponse("Ya has marcado la salida", { absent: false });
        }

        let change_available = true;
        let is_late = false;
        let next_time = null;

            const fecha_marca_string = marcaDia.fecha.toISOString().split("T")[0];
            const hora_inicio_string = marcaDia.hora_inicio?.toISOString().split("T")[1].split(".")[0] ?? "00:00:00"; 
            const inicio_marca = new Date(fecha_marca_string + "T" + hora_inicio_string);

            let fin_marca = null;
            if (marcaDia.horas_duracion) {
                const horas_duracion = parseFloat(marcaDia.horas_duracion.toString());
                fin_marca = new Date(inicio_marca.getTime() + horas_duracion * 60 * 60 * 1000);
            }
            else {
                // Definimos si marcaDia.hora_inicio es mayor a marcaDia.hora_fin, si es así, entonces la hora_fin es el siguiente día
                if (marcaDia.hora_inicio && marcaDia.hora_fin) {
                    if (new Date(marcaDia.hora_inicio) > new Date(marcaDia.hora_fin)) {
                        fin_marca = new Date(marcaDia.fecha.setDate(marcaDia.fecha.getDate() + 1));
                    }
                    else {
                        const hora_fin_string = marcaDia.hora_fin?.toISOString().split("T")[1].split(".")[0] ?? "00:00:00";
                        fin_marca = new Date(fecha_marca_string + "T" + hora_fin_string);
                    }
                }
                else {
                    fin_marca = new Date(fecha_marca_string + "T23:59:59.999Z");
                }
            }

            if (!marcaDia.hora_entrada_digitada && (now > fin_marca)) {
                const hora_inicio_string = inicio_marca.toISOString().split("T")[1].split(".")[0];
                const fecha_marca_string = marcaDia.fecha.toISOString().split("T")[0].split("-").reverse().join("-");

                let should_response = true;
                let extra_reason = "";
                if (razonAusencia?.razon && String(razonAusencia.razon).trim()) {
                    should_response = false;
                    extra_reason = " Razon: " + String(razonAusencia.razon).trim();
                }

                return blockedMarcaResponse(
                    "No has marcado la entrada para el turno del día " +
                        fecha_marca_string +
                        " a las " +
                        hora_inicio_string +
                        "." +
                        extra_reason,
                    { absent: true, should_response }
                );
            }

            next_time = new Date(estado == "No ingresado" ? inicio_marca : fin_marca);
            const next_change_time = new Date(next_time.getTime());
            next_change_time.setMinutes(next_change_time.getMinutes() - monitoringPreviousMinutes);
            if (toZonedTime(new Date(), "America/Costa_Rica") < next_change_time) {
                change_available = false;
            }

            const lateThresholdMs = inicio_marca.getTime() + monitoringPostMinutes * 60 * 1000;
            if (estado === "No ingresado") {
                if (toZonedTime(new Date(), "America/Costa_Rica").getTime() > lateThresholdMs) {
                    is_late = true;
                }
            } else if (marcaDia.hora_entrada_digitada) {
                is_late = new Date(marcaDia.hora_entrada_digitada).getTime() > lateThresholdMs;
            }

        const data = {
            status: true,
            current_time: currentTime,
            monitoring_previous_minutes: monitoringPreviousMinutes,
            monitoring_post_minutes: monitoringPostMinutes,
            change_available,
            is_late,
            is_salida_anticipada: isSalidaAnticipada,
            next_time,
            marca: marca_return
        }

        return NextResponse.json(data, { status: 200 });

    } catch (error: unknown) {
        console.log("Error en attendance/user/[id]:", error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

async function getNomenclators(req: NextRequest) {
    

    const categoriasMantenimiento = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_categoria_mantenimiento",
            operation: "findMany"
        }
    });

    const tiposProductoNoConforme = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_tipos_producto_no_conforme",
            operation: "findMany"
        }
    });

    const tipoDocumento = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_tipo_documento",
            operation: "findMany"
        }
    });

    const clasificacionIncidentes = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_clasificacion_incidente",
            operation: "findMany"
        }
    });

    const categoriasNovedades = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_novedades_categoria",
            operation: "findMany"
        }
    });

    const tipoActivosVisitas = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_tipo_activo_visitas",
            operation: "findMany"
        }
    });

    const tipoQuejasClientes = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_tipo_cliente_quejas",
            operation: "findMany"
        }
    });

    const tipoQuejas = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "n_tipo_quejas",
            operation: "findMany"
        }
    });

    return {
        categoriasMantenimiento,
        tiposProductoNoConforme,
        tipoDocumento,
        clasificacionIncidentes,
        categoriasNovedades,
        tipoActivosVisitas,
        tipoQuejasClientes,
        tipoQuejas,
    }
}