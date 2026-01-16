import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const params = req.nextUrl.searchParams;
        const marcaId = params.get("m");

        if (!marcaId) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaId) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        // Validar que la marca tenga los datos necesarios
        if (!marca.fecha || !marca.hora_inicio || !marca.hora_fin || !marca.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "La marca no tiene los datos necesarios para buscar el registro anterior" }, { status: 200 });
        }

        if (marca.hora_entrada_digitada) {
            //const marcaFechaHoraInicio = new Date(`${marca.fecha}T${marca.hora_entrada_digitada}`);
            const marcaFechaHoraInicio = marca.hora_entrada_digitada;
            let marcaFechaHoraFin = toZonedTime(new Date(), 'America/Costa_Rica');
            /*if (marcaFechaHoraInicio < marcaFechaHoraFin){ // Si hora_inicio es menor a hora_fin, entonces la fecha de fin es el día siguiente
                marcaFechaHoraFin = new Date(`${marca.fecha.getDate() + 1}T${marca.hora_fin}`);
            }*/

            const entregaPuestos = await prisma.e_registro_entrega_puesto.findMany({ where: { created_at: { lte: marcaFechaHoraFin, gte: marcaFechaHoraInicio }, created_by: marca.empleadoFijo_id } });
            if (entregaPuestos.length > 0) {
                return NextResponse.json({ status: false, message: "Ya has registrado la entrega de puesto para este turno" }, { status: 200 });
            }
        }

        // Construir la fecha de la marca actual para comparación
        const marcaFecha = new Date(marca.fecha);
        const marcaFechaStr = marcaFecha.toISOString().split("T")[0];
        
        // Construir la hora_inicio de la marca actual para comparación (formato Time)
        const marcaHoraInicioTime = marca.hora_inicio ? new Date("1970-01-01 " + marca.hora_inicio.toTimeString().slice(0, 8)) : null;
        
        // Construir la hora_fin de la marca actual para comparación (formato Time)
        const marcaHoraFinTime = marca.hora_fin ? new Date("1970-01-01 " + marca.hora_fin.toTimeString().slice(0, 8)) : null;

        // Buscar registro anterior con empleadoFijo_id diferente
        // Un registro es anterior si:
        // 1. La fecha es anterior, O
        // 2. La fecha es igual pero hora_inicio es anterior
        const marcaAnterior = await prisma.c_marca_dia.findFirst({
            where: {
                puesto_id: marca.puesto_id,
                OR: [
                    // Fecha anterior
                    {
                        fecha: {
                            lt: marca.fecha,
                        },
                    },
                    // Misma fecha pero hora_inicio anterior
                    {
                        fecha: {
                            equals: marca.fecha,
                        },
                        hora_inicio: {
                            lt: marca.hora_inicio,
                        } ,
                    },
                ],
            },
            orderBy: [
                { fecha: "desc" },
                { hora_inicio: "desc" },
            ],
        });

        if (!marcaAnterior) {
            return NextResponse.json({ status: false, message: "No se encontró el registro anterior" }, { status: 200 });
        }

        let previous_employee = { id: 0, nombre: "Desconocido" };
        if (marcaAnterior.empleadoFijo_id) {
            const empleado_bd = await prisma.c_empleado.findUnique({ where: { id: marcaAnterior.empleadoFijo_id } });
            if (empleado_bd) {
                previous_employee = {
                    id: empleado_bd.id,
                    nombre: empleado_bd.nombre + " " + empleado_bd.primer_apellido + " " + empleado_bd.segundo_apellido,
                };
            }
        }

        const dateInicioString = marcaAnterior.fecha.toISOString().split("T")[0];
        const timeInicioString = marcaAnterior.hora_inicio ? marcaAnterior.hora_inicio.toTimeString().slice(0, 8) : "00:00:00";

        const dateFinString = marcaAnterior.fecha.toISOString().split("T")[0];
        const timeFinString = marcaAnterior.hora_fin ? marcaAnterior.hora_fin.toTimeString().slice(0, 8) : "23:59:59";

        const fechaHoraInicio = new Date(`${dateInicioString}T${timeInicioString}`); // En su estado actual, resulta en Invalid Date
        let fechaHoraFin = new Date(`${dateFinString}T${timeFinString}`);
        
        if (fechaHoraInicio < fechaHoraFin){ // Si hora_inicio es menor a hora_fin, entonces la fecha de fin es el día siguiente
            const newDateFinString = marcaAnterior.fecha.toISOString().split("T")[0].split("-");
            newDateFinString[2] = (Number(newDateFinString[2]) + 1).toString();
            fechaHoraFin = new Date(`${newDateFinString[0]}-${newDateFinString[1]}-${newDateFinString[2]}T${timeFinString}`);
        }

        const notas_return: { id: number, titulo: string, description: string, categoria: string | null, empleado: string, updated_at: Date }[] = [];

        const all_notas = await prisma.c_puesto_notas.findMany({ where: { puesto_id: marcaAnterior.puesto_id, relevancia: "Alta" } });

        const notas_cambios = await prisma.c_puesto_notas_bitacora_cambios.findMany({ where: { nota_id: { in: all_notas.map(nota => nota.id) }, created_at: { lte: fechaHoraFin, gte: fechaHoraInicio } } });
        for (const cambio of notas_cambios) {
            const nota = await prisma.c_puesto_notas.findUnique({ where: { id: cambio.nota_id } });
            if (nota) {
                const empleado = await prisma.c_empleado.findUnique({ where: { id: cambio.empleado_id } });
                notas_return.push({
                    id: nota.id,
                    titulo: cambio.titulo,
                    description: cambio.description,
                    categoria: cambio.categoria,
                    empleado: empleado ? empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido : "Desconocido",
                    updated_at: cambio.created_at,
                });
            }
        }

        const incidentes = await prisma.c_incidente.findMany({ where: { corpo_id: marcaAnterior.corpo_id, created_at: { lte: fechaHoraFin, gte: fechaHoraInicio } } });
        const incidentes_return: { id: number, clasificacion: string, description: string, involucrados: string, estado: boolean, responsable: string}[] = [];
        for (const incidente of incidentes) {
            const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: incidente.clasificacion } });
            incidentes_return.push({
                id: incidente.id,
                clasificacion: clasificacion ? clasificacion.nombre : "Desconocido",
                description: incidente.descripcion,
                involucrados: incidente.involucrados,
                estado: incidente.estado,
                responsable: incidente.nombre_responsable
            });
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaAnterior.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const articulos_return: { id: number, nombre: string, cantidad: number }[] = [];

        if (puesto.comboArticulosCP_id) {
            const combo_articulo_cp = await prisma.e_estructura_combo_articulo_cp.findUnique({ where: { id: puesto.comboArticulosCP_id } });
            if (combo_articulo_cp) {
                const articulos_combo_articulo_cp = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { combo_id: combo_articulo_cp.id } });
                for (const articulo of articulos_combo_articulo_cp) {
                    let art_bd = null;
                    if (articulo.articuloCP_id) {
                        art_bd = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo.articuloCP_id } });
                    }
                    articulos_return.push({
                        id: articulo.id,
                        nombre: art_bd ? art_bd.nombre : "Desconocido",
                        cantidad: articulo.cantidad,
                    });
                }
            }
        }

        const articulos_puesto_plan = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { puesto_id: marcaAnterior.puesto_id, id: { notIn: articulos_return.map(articulo => articulo.id) } } });
        for (const articulo of articulos_puesto_plan) {
            let art_bd = null;
            if (articulo.articuloCP_id) {
                art_bd = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo.articuloCP_id } });
            }
            articulos_return.push({
                id: articulo.id,
                nombre: art_bd ? art_bd.nombre : "Desconocido",
                cantidad: articulo.cantidad,
            });
        }

        const info_return = {
            previous_marca: marcaAnterior,
            previous_employee: previous_employee,
            incidentes: incidentes_return,
            notas: notas_return,
            articulos: articulos_return,
        };

        return NextResponse.json({ 
            status: true,
            info: info_return,
        }, { status: 200 });
        
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const body = await req.json();
        const {
            cliente_id,
            corpo_id,
            puesto_id,
            oficial_entrega,
            fecha_entrada_entrega,
            fecha_salida_entrega,
            hora_entrada_entrega,
            hora_salida_entrega,
            turno_entrega,
            oficial_recibe,
            fecha_entrada_recibe,
            fecha_salida_recibe,
            hora_entrada_recibe,
            hora_salida_recibe,
            turno_recibe,
            articulos_puesto,
            observaciones,
            firma_responsable,
            marca_id,
        } = body;

        if (!cliente_id || !corpo_id || !puesto_id || !oficial_entrega || !oficial_recibe || !firma_responsable) {
            return NextResponse.json({ status: false, message: "Faltan campos requeridos" }, { status: 400 });
        }

        // Obtener empleado_id del token
        const empleadoId = payload?.empleadoId || payload?.id;
        if (!empleadoId || typeof empleadoId !== 'number') {
            return NextResponse.json({ status: false, message: "No se pudo obtener el ID del empleado" }, { status: 401 });
        }

        // Validar que no exista ya un registro para este turno
        if (marca_id) {
            const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
            if (marca && marca.empleadoFijo_id) {
                const marcaFechaHoraInicio = new Date(`${marca.fecha}T${marca.hora_entrada_digitada}`);
                let marcaFechaHoraFin = marca.hora_salida_digitada ? new Date(`${marca.fecha}T${marca.hora_salida_digitada}`) : toZonedTime(new Date(), 'America/Costa_Rica');
                if (marcaFechaHoraInicio < marcaFechaHoraFin) {
                    marcaFechaHoraFin = new Date(`${marca.fecha.getDate() + 1}T${marca.hora_fin}`);
                }

                const entregaPuestos = await prisma.e_registro_entrega_puesto.findMany({ 
                    where: { 
                        created_at: { lte: marcaFechaHoraFin, gte: marcaFechaHoraInicio }, 
                        created_by: marca.empleadoFijo_id 
                    } 
                });
                if (entregaPuestos.length > 0) {
                    return NextResponse.json({ status: false, message: "Ya has registrado la entrega de puesto para este turno" }, { status: 200 });
                }
            }
        }

        const now = toZonedTime(new Date(), 'America/Costa_Rica');

        // Crear el registro
        const nuevoRegistro = await prisma.e_registro_entrega_puesto.create({
            data: {
                cliente_id: parseInt(cliente_id),
                corpo_id: parseInt(corpo_id),
                puesto_id: parseInt(puesto_id),
                oficial_entrega,
                fecha_entrada_entrega: new Date(fecha_entrada_entrega),
                fecha_salida_entrega: new Date(fecha_salida_entrega),
                hora_entrada_entrega: new Date(`1970-01-01T${hora_entrada_entrega}`),
                hora_salida_entrega: new Date(`1970-01-01T${hora_salida_entrega}`),
                turno_entrega,
                oficial_recibe,
                fecha_entrada_recibe: new Date(fecha_entrada_recibe),
                fecha_salida_recibe: new Date(fecha_salida_recibe),
                hora_entrada_recibe: new Date(`1970-01-01T${hora_entrada_recibe}`),
                hora_salida_recibe: new Date(`1970-01-01T${hora_salida_recibe}`),
                turno_recibe,
                articulos_puesto: articulos_puesto || '',
                observaciones: observaciones || '',
                firma_responsable,
                created_at: now,
                created_by: empleadoId,
            },
        });

        return NextResponse.json({ 
            status: true, 
            message: "Registro de entrega de puesto creado correctamente",
            data: nuevoRegistro
        }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}