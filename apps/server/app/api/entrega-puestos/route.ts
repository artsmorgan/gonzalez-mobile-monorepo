import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime, format } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { sanitizeArticulosPuestoForPersistence } from "../../../utils/sanitizeArticulosPuestoForPersistence";
import { processEntregaPuestosArticulosMantenimiento } from "./articulosMantenimiento";

// Función auxiliar para convertir hora a formato Time
function parseTimeValue(timeValue: any): Date | null {
    if (!timeValue) return null;
    if (timeValue instanceof Date) return timeValue;
    const timeStr = String(timeValue);
    // Si es un string ISO completo, extraer solo la parte de tiempo
    if (timeStr.includes("T")) {
        const timePart = timeStr.split("T")[1]?.split(".")[0] || timeStr.split("T")[1]?.split("Z")[0];
        if (timePart) {
            return new Date(`1970-01-01T${timePart}`);
        }
    }
    // Si es solo tiempo (HH:MM:SS o HH:MM)
    if (timeStr.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        return new Date(`1970-01-01T${timeStr}`);
    }
    // Intentar parsear como fecha completa
    const parsed = new Date(timeStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// Función auxiliar para parsear fecha del body (puede venir como DD-MM-YYYY o YYYY-MM-DD)
function parseDateValue(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    const dateStr = String(dateValue).trim();
    // Si es un string ISO completo, parsearlo directamente
    if (dateStr.includes("T") || dateStr.includes("Z")) {
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    // Si viene como DD-MM-YYYY, convertir a YYYY-MM-DD
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const parts = dateStr.split("-");
        const converted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const parsed = new Date(converted);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    // Intentar parsear directamente (YYYY-MM-DD o formato estándar)
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const params = req.nextUrl.searchParams;
        const puestoIdParam = params.get("puesto_id");
        const empleadoIdParam = params.get("empleado_id");
        const marcaId = params.get("m");

        // Listado de registros de entrega de puesto por puesto (y opcionalmente por empleado)
        // Este flujo se usa desde la app móvil para consultar el historial de entregas.
        if (puestoIdParam) {
            const puestoId = parseInt(puestoIdParam, 10);
            if (isNaN(puestoId)) {
                return NextResponse.json({ status: false, message: "puesto_id inválido" }, { status: 400 });
            }

            const where: any = {
                puesto_id: puestoId,
            };

            if (empleadoIdParam) {
                const empleadoId = parseInt(empleadoIdParam, 10);
                if (!isNaN(empleadoId)) {
                    where.created_by = empleadoId;
                }
            }

            const registros = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_registro_entrega_puesto",
                    operation: "findMany",
                    where,
                    orderBy: {
                        created_at: "desc",
                    },
                },
            });

            const registrosArray = Array.isArray(registros) ? registros : (registros ? [registros] : []);

            const registros_return = registrosArray.map((reg: any) => {
                let articulosParsed: any[] = [];
                try {
                    if (reg.articulos_puesto) {
                        const parsed = typeof reg.articulos_puesto === "string" ? JSON.parse(reg.articulos_puesto) : reg.articulos_puesto;
                        if (Array.isArray(parsed)) {
                            articulosParsed = parsed;
                        }
                    }
                } catch {
                    articulosParsed = [];
                }

                return {
                    id: reg.id,
                    oficial_entrega: reg.oficial_entrega,
                    fecha_entrada_entrega: reg.fecha_entrada_entrega,
                    fecha_salida_entrega: reg.fecha_salida_entrega,
                    hora_entrada_entrega: reg.hora_entrada_entrega,
                    hora_salida_entrega: reg.hora_salida_entrega,
                    turno_entrega: reg.turno_entrega,
                    oficial_recibe: reg.oficial_recibe,
                    fecha_entrada_recibe: reg.fecha_entrada_recibe,
                    fecha_salida_recibe: reg.fecha_salida_recibe,
                    hora_entrada_recibe: reg.hora_entrada_recibe,
                    hora_salida_recibe: reg.hora_salida_recibe,
                    turno_recibe: reg.turno_recibe,
                    articulos_puesto: articulosParsed,
                    observaciones: reg.observaciones,
                    firma_recibe: reg.firma_recibe,
                    firma_entrega: reg.firma_entrega,
                    firma_responsable: reg.firma_responsable,
                    created_at: reg.created_at,
                    created_by: reg.created_by,
                };
            });

            return NextResponse.json({
                status: true,
                registros: registros_return,
            }, { status: 200 });
        }

        if (!marcaId) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: parseInt(marcaId) },
            },
        });
        if (!marca || !marca.id) {
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

            const entregaPuestos = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_registro_entrega_puesto",
                    operation: "findMany",
                    where: { created_at: { lte: marcaFechaHoraFin instanceof Date ? marcaFechaHoraFin.toISOString() : marcaFechaHoraFin, gte: marcaFechaHoraInicio instanceof Date ? marcaFechaHoraInicio.toISOString() : marcaFechaHoraInicio }, created_by: marca.empleadoFijo_id },
                },
            });
            const entregaPuestosArray = Array.isArray(entregaPuestos) ? entregaPuestos : [];
            if (entregaPuestosArray.length > 0) {
                return NextResponse.json({ status: false, message: "Ya has registrado la entrega de puesto para este turno" }, { status: 200 });
            }
        }

        // Construir la fecha de la marca actual para comparación
        const marcaFecha = marca.fecha instanceof Date ? marca.fecha : new Date(marca.fecha);
        if (isNaN(marcaFecha.getTime())) {
            return NextResponse.json({ status: false, message: "Fecha de marca inválida" }, { status: 400 });
        }
        const marcaFechaStr = marcaFecha.toISOString().split("T")[0];

        // Construir la hora_inicio de la marca actual para comparación (formato Time)
        const marcaHoraInicioTime = parseTimeValue(marca.hora_inicio);

        // Construir la hora_fin de la marca actual para comparación (formato Time)
        const marcaHoraFinTime = parseTimeValue(marca.hora_fin);

        // Buscar registro anterior con empleadoFijo_id diferente
        // Un registro es anterior si:
        // 1. La fecha es anterior, O
        // 2. La fecha es igual pero hora_inicio es anterior
        const marcaFechaISO = marcaFecha.toISOString();
        const marcaHoraInicioISO = marcaHoraInicioTime ? marcaHoraInicioTime.toISOString() : null;

        const marcaAnterior = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findFirst",
                where: {
                    puesto_id: marca.puesto_id,
                    OR: [
                        // Fecha anterior
                        {
                            fecha: {
                                lt: marcaFechaISO,
                            },
                        },
                        // Misma fecha pero hora_inicio anterior
                        marcaHoraInicioISO ? {
                            fecha: {
                                equals: marcaFechaISO,
                            },
                            hora_inicio: {
                                lt: marcaHoraInicioISO,
                            },
                        } : {
                            fecha: {
                                equals: marcaFechaISO,
                            },
                        },
                    ],
                },
                orderBy: [
                    { fecha: "desc" },
                    { hora_inicio: "desc" },
                ],
            },
        });

        if (!marcaAnterior || !marcaAnterior.id) {
            return NextResponse.json({ status: false, message: "No se encontró el registro anterior" }, { status: 200 });
        }

        let previous_employee = { id: 0, nombre: "Desconocido" };
        if (marcaAnterior.empleadoFijo_id) {
            const empleado_bd = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: marcaAnterior.empleadoFijo_id },
                },
            });
            if (empleado_bd && empleado_bd.id) {
                previous_employee = {
                    id: empleado_bd.id,
                    nombre: (empleado_bd.nombre || "") + " " + (empleado_bd.primer_apellido || "") + " " + (empleado_bd.segundo_apellido || ""),
                };
            }
        }

        const marcaAnteriorFecha = marcaAnterior.fecha instanceof Date ? marcaAnterior.fecha : new Date(marcaAnterior.fecha);
        if (isNaN(marcaAnteriorFecha.getTime())) {
            return NextResponse.json({ status: false, message: "Fecha de marca anterior inválida" }, { status: 400 });
        }
        const marcaAnteriorHoraInicio = parseTimeValue(marcaAnterior.hora_inicio);
        const marcaAnteriorHoraFin = parseTimeValue(marcaAnterior.hora_fin);

        const dateInicioString = marcaAnteriorFecha.toISOString().split("T")[0];
        const timeInicioString = marcaAnteriorHoraInicio ? marcaAnteriorHoraInicio.toTimeString().slice(0, 8) : "00:00:00";

        const dateFinString = marcaAnteriorFecha.toISOString().split("T")[0];
        const timeFinString = marcaAnteriorHoraFin ? marcaAnteriorHoraFin.toTimeString().slice(0, 8) : "23:59:59";

        const fechaHoraInicio = new Date(`${dateInicioString}T${timeInicioString}`);
        if (isNaN(fechaHoraInicio.getTime())) {
            return NextResponse.json({ status: false, message: "Fecha/hora de inicio inválida" }, { status: 400 });
        }
        let fechaHoraFin = new Date(`${dateFinString}T${timeFinString}`);
        if (isNaN(fechaHoraFin.getTime())) {
            return NextResponse.json({ status: false, message: "Fecha/hora de fin inválida" }, { status: 400 });
        }

        if (fechaHoraInicio < fechaHoraFin) { // Si hora_inicio es menor a hora_fin, entonces la fecha de fin es el día siguiente
            const newDateFinString = marcaAnteriorFecha.toISOString().split("T")[0].split("-");
            newDateFinString[2] = (Number(newDateFinString[2]) + 1).toString().padStart(2, '0');
            fechaHoraFin = new Date(`${newDateFinString[0]}-${newDateFinString[1]}-${newDateFinString[2]}T${timeFinString}`);
        }

        const notas_return: { id: number, titulo: string, description: string, categoria: string | null, empleado: string, updated_at: Date }[] = [];

        // Obtener notas del puesto solicitado y filtrar por relevancia alta
        const all_notas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findMany",
                where: { puesto_id: marcaAnterior.puesto_id, relevancia: "Alta" },
            },
        });

        const allNotasArray = Array.isArray(all_notas) ? all_notas : [];
        if (allNotasArray.length > 0) {
            const notaIds = allNotasArray.map((nota: any) => nota.id);

            // La bitácora de cambios de notas ahora se obtiene desde c_cambios_apps_modules
            // usando el registro_id de la nota y la tabla a la que pertenece.
            const cambiosNotas = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_cambios_apps_modules",
                    operation: "findMany",
                    where: {
                        nombre_tabla: "c_puesto_notas",
                        registro_id: { in: notaIds },
                        created_at: { lte: fechaHoraFin.toISOString(), gte: fechaHoraInicio.toISOString() },
                    },
                    orderBy: { created_at: "desc" },
                },
            });

            // Quedarse con el último cambio por nota dentro del lapso
            const cambiosNotasArray = Array.isArray(cambiosNotas) ? cambiosNotas : [];
            const latestCambioByNotaId = new Map<number, any>();
            for (const cambio of cambiosNotasArray) {
                if (!latestCambioByNotaId.has(cambio.registro_id)) {
                    latestCambioByNotaId.set(cambio.registro_id, cambio);
                }
            }

            const changedNotaIds = Array.from(latestCambioByNotaId.keys());
            if (changedNotaIds.length > 0) {
                const notasMap = new Map<number, any>(
                    allNotasArray.map((nota: any) => [nota.id, nota])
                );

                const empleadoIds = Array.from(
                    new Set(
                        Array.from(latestCambioByNotaId.values())
                            .map((cambio) => cambio.created_by)
                            .filter((id) => id > 0)
                    )
                );

                const empleados = empleadoIds.length > 0
                    ? await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "c_empleado",
                            operation: "findMany",
                            where: { id: { in: empleadoIds } },
                            select: {
                                id: true,
                                nombre: true,
                                primer_apellido: true,
                                segundo_apellido: true,
                            },
                        },
                    })
                    : [];
                const empleadosArray = Array.isArray(empleados) ? empleados : [];
                const empleadosMap = new Map<number, any>(
                    empleadosArray.map((empleado: any) => [empleado.id, empleado])
                );

                const categoriaIds = Array.from(
                    new Set(
                        changedNotaIds
                            .map((id) => notasMap.get(id)?.categoria_id)
                            .filter((id): id is number => id !== null && id !== undefined)
                    )
                );
                const categorias = categoriaIds.length > 0
                    ? await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "n_novedades_categoria",
                            operation: "findMany",
                            where: { id: { in: categoriaIds } },
                            select: { id: true, nombre: true },
                        },
                    })
                    : [];
                const categoriasArray = Array.isArray(categorias) ? categorias : [];
                const categoriasMap = new Map<number, string>(
                    categoriasArray.map((categoria: any) => [categoria.id, categoria.nombre])
                );

                for (const notaId of changedNotaIds) {
                    const nota = notasMap.get(notaId);
                    const cambio = latestCambioByNotaId.get(notaId);
                    if (!nota || !cambio) continue;

                    const empleado = empleadosMap.get(cambio.created_by);
                    const cambioCreatedAt = cambio.created_at instanceof Date ? cambio.created_at : new Date(cambio.created_at);
                    notas_return.push({
                        id: nota.id,
                        titulo: nota.titulo,
                        description: nota.description,
                        categoria: nota.categoria_id ? (categoriasMap.get(nota.categoria_id) || null) : null,
                        empleado: empleado
                            ? `${empleado.nombre || ""} ${empleado.primer_apellido || ""} ${empleado.segundo_apellido || ""}`.trim()
                            : "Desconocido",
                        updated_at: cambioCreatedAt,
                    });
                }

                notas_return.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
            }
        }

        const incidentes = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_incidente",
                operation: "findMany",
                where: { corpo_id: marcaAnterior.corpo_id, created_at: { lte: fechaHoraFin.toISOString(), gte: fechaHoraInicio.toISOString() } },
            },
        });
        const incidentesArray = Array.isArray(incidentes) ? incidentes : [];
        const incidentes_return: { id: number, clasificacion: string, description: string, involucrados: string, estado: boolean, responsable: string }[] = [];
        for (const incidente of incidentesArray) {
            const clasificacion = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "n_clasificacion_incidente",
                    operation: "findUnique",
                    where: { id: incidente.clasificacion },
                },
            });
            incidentes_return.push({
                id: incidente.id,
                clasificacion: clasificacion && clasificacion.id ? clasificacion.nombre : "Desconocido",
                description: incidente.descripcion,
                involucrados: incidente.involucrados,
                estado: incidente.estado,
                responsable: incidente.nombre_responsable
            });
        }

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id: marcaAnterior.puesto_id },
            },
        });
        if (!puesto || !puesto.id) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const articulos_return: { id: number, tipo: string, nombre: string, marca: string, serie: string, cantidad: number }[] = [];

        if (puesto.comboArticulosCP_id) {
            const combo_articulo_cp = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_combo_articulo_cp",
                    operation: "findUnique",
                    where: { id: puesto.comboArticulosCP_id },
                },
            });
            if (combo_articulo_cp && combo_articulo_cp.id) {
                const articulos_combo_articulo_cp = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_articulo_corpo_puesto_plan",
                        operation: "findMany",
                        where: { combo_id: combo_articulo_cp.id },
                    },
                });
                const articulosComboArray = Array.isArray(articulos_combo_articulo_cp) ? articulos_combo_articulo_cp : [];
                for (const articulo of articulosComboArray) {
                    let art_bd = null;
                    if (articulo.articuloCP_id) {
                        art_bd = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "n_articulo_corpo_puesto",
                                operation: "findUnique",
                                where: { id: articulo.articuloCP_id },
                            },
                        });
                    }
                    articulos_return.push({
                        id: articulo.id,
                        nombre: art_bd ? art_bd.nombre : `Artículo inidentificable`,
                        tipo: "Plan",
                        marca: "",
                        serie: "",
                        cantidad: articulo.cantidad,
                    });
                }
            }
        }

        const articulos_puesto_plan = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_articulo_corpo_puesto_plan",
                operation: "findMany",
                where: { OR: [{ puesto_id: marcaAnterior.puesto_id }, { corpo_id: marcaAnterior.corpo_id }],
                    id: { notIn: articulos_return.map((articulo: any) => articulo.id) }
                },
            },
        });
        const articulosPlanArray = Array.isArray(articulos_puesto_plan) ? articulos_puesto_plan : [];
        for (const articulo of articulosPlanArray) {
            let art_bd = null;
            if (articulo.articuloCP_id) {
                art_bd = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "n_articulo_corpo_puesto",
                        operation: "findUnique",
                        where: { id: articulo.articuloCP_id },
                    },
                });
            }
            articulos_return.push({
                id: articulo.id,
                nombre: art_bd ? art_bd.nombre : `Artículo inidentificable`,
                tipo: "Plan",
                marca: "",
                serie: "",
                cantidad: articulo.cantidad,
            });
        }

        const articulos_puesto_entrega = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_articulo_corpo_puesto_entrega",
                operation: "findMany",
                where: { OR: [{ puesto_id: marcaAnterior.puesto_id }, { corpo_id: marcaAnterior.corpo_id }] },
            },
        });
        const articulosEntregaArray = Array.isArray(articulos_puesto_entrega) ? articulos_puesto_entrega : [];
        for (const articulo of articulosEntregaArray) {
            let art_bd = null;
            if (articulo.nomencladorArticuloCP_id) {
                art_bd = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "n_articulo_corpo_puesto",
                        operation: "findUnique",
                        where: { id: articulo.nomencladorArticuloCP_id },
                    },
                });
            }
            articulos_return.push({
                id: articulo.id,
                nombre: art_bd ? art_bd.nombre : `Artículo inidentificable`,
                tipo: "Asignado",
                marca: articulo.marca,
                serie: articulo.serie,
                cantidad: 1,
            });
        }

        // Adjuntar último mantenimiento a cada artículo del puesto
        const planIds = articulos_return.filter((a) => a.tipo === "Plan").map((a) => a.id);
        const asignadoIds = articulos_return.filter((a) => a.tipo === "Asignado").map((a) => a.id);

        if (planIds.length > 0 || asignadoIds.length > 0) {
            const or: any[] = [];
            if (planIds.length) or.push({ articulo_plan_id: { in: planIds } });
            if (asignadoIds.length) or.push({ articulo_asignado_id: { in: asignadoIds } });

            const mantenimientos = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_articulo_mantenimiento",
                    operation: "findMany",
                    where: { OR: or },
                    orderBy: { id: "desc" },
                    select: {
                        id: true,
                        articulo_plan_id: true,
                        articulo_asignado_id: true,
                        estado: true,
                        cantidad_necesaria: true,
                        cantidad_real: true,
                        observaciones: true,
                        fecha_solucion: true,
                        mant_armas_form: true,
                    },
                },
            });

            const mantenimientosArray = Array.isArray(mantenimientos) ? mantenimientos : [];
            const latestByPlanId = new Map<number, any>();
            const latestByAsignadoId = new Map<number, any>();
            for (const m of mantenimientosArray) {
                if (m.articulo_plan_id && !latestByPlanId.has(m.articulo_plan_id)) latestByPlanId.set(m.articulo_plan_id, m);
                if (m.articulo_asignado_id && !latestByAsignadoId.has(m.articulo_asignado_id)) latestByAsignadoId.set(m.articulo_asignado_id, m);
            }

            for (const a of articulos_return as any[]) {
                a.ultimo_mantenimiento =
                    a.tipo === "Plan"
                        ? latestByPlanId.get(a.id) ?? null
                        : a.tipo === "Asignado"
                            ? latestByAsignadoId.get(a.id) ?? null
                            : null;
            }
        } else {
            for (const a of articulos_return as any[]) a.ultimo_mantenimiento = null;
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
        console.log("Error in GET /api/entrega-puestos:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const body = await req.json();
        const {
            cliente_id,
            corpo_id,
            puesto_id,
            division,
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
            firma_recibe,
            firma_entrega,
            firma_responsable,
            marca_id,
        } = body;

        const firmaRecibeFinal = typeof firma_recibe === "string" && firma_recibe.trim().length > 0
            ? firma_recibe.trim()
            : (typeof firma_responsable === "string" ? firma_responsable.trim() : "");
        const firmaEntregaFinal = typeof firma_entrega === "string" && firma_entrega.trim().length > 0
            ? firma_entrega.trim()
            : null;
        const firmaResponsableFinal = typeof firma_responsable === "string" && firma_responsable.trim().length > 0
            ? firma_responsable.trim()
            : firmaRecibeFinal;

        if (!cliente_id || !corpo_id || !puesto_id || !oficial_entrega || !oficial_recibe || !firmaRecibeFinal) {
            return NextResponse.json({ status: false, message: "Faltan campos requeridos" }, { status: 400 });
        }

        // Obtener empleado_id del token
        const empleadoId = payload?.empleadoId || payload?.id;
        if (!empleadoId || typeof empleadoId !== 'number') {
            return NextResponse.json({ status: false, message: "No se pudo obtener el ID del empleado" }, { status: 401 });
        }

        // Validar que no exista ya un registro para este turno
        if (marca_id) {
            const marca = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_marca_dia",
                    operation: "findUnique",
                    where: { id: parseInt(marca_id) },
                },
            });
            if (marca && marca.id && marca.empleadoFijo_id) {
                const marcaFecha = marca.fecha instanceof Date ? marca.fecha : new Date(marca.fecha);
                if (isNaN(marcaFecha.getTime())) {
                    return NextResponse.json({ status: false, message: "Fecha de marca inválida" }, { status: 400 });
                }
                const marcaHoraInicio = parseTimeValue(marca.hora_inicio);
                const marcaHoraFin = parseTimeValue(marca.hora_fin);

                const dateInicioString = marcaFecha.toISOString().split("T")[0];
                const timeInicioString = marcaHoraInicio ? marcaHoraInicio.toTimeString().slice(0, 8) : "00:00:00";

                const dateFinString = marcaFecha.toISOString().split("T")[0];
                const timeFinString = marcaHoraFin ? marcaHoraFin.toTimeString().slice(0, 8) : "23:59:59";

                const marcaFechaHoraInicio = new Date(`${dateInicioString}T${timeInicioString}`);
                if (isNaN(marcaFechaHoraInicio.getTime())) {
                    return NextResponse.json({ status: false, message: "Fecha/hora de inicio inválida" }, { status: 400 });
                }
                let marcaFechaHoraFin = new Date(`${dateFinString}T${timeFinString}`);
                if (isNaN(marcaFechaHoraFin.getTime())) {
                    return NextResponse.json({ status: false, message: "Fecha/hora de fin inválida" }, { status: 400 });
                }

                if (marcaFechaHoraInicio < marcaFechaHoraFin) { // Si hora_inicio es menor a hora_fin, entonces la fecha de fin es el día siguiente
                    const newDateFinString = marcaFecha.toISOString().split("T")[0].split("-");
                    newDateFinString[2] = (Number(newDateFinString[2]) + 1).toString().padStart(2, '0');
                    marcaFechaHoraFin = new Date(`${newDateFinString[0]}-${newDateFinString[1]}-${newDateFinString[2]}T${timeFinString}`);
                }

                const entregaPuestos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_registro_entrega_puesto",
                        operation: "findMany",
                        where: {
                            created_at: { lte: marcaFechaHoraFin.toISOString(), gte: marcaFechaHoraInicio.toISOString() },
                            created_by: marca.empleadoFijo_id
                        },
                    },
                });
                const entregaPuestosArray = Array.isArray(entregaPuestos) ? entregaPuestos : [];
                if (entregaPuestosArray.length > 0) {
                    return NextResponse.json({ status: false, message: "Ya has registrado la entrega de puesto para este turno" }, { status: 200 });
                }
            }
        }

        const now = toZonedTime(new Date(), 'America/Costa_Rica');

        // Parsear fechas y horas del body
        const fechaEntradaEntregaParsed = parseDateValue(fecha_entrada_entrega);
        const fechaSalidaEntregaParsed = parseDateValue(fecha_salida_entrega);
        const horaEntradaEntregaParsed = `${hora_entrada_entrega}:00.000Z`;
        const horaSalidaEntregaParsed = `${hora_salida_entrega}:00.000Z`;
        const fechaEntradaRecibeParsed = parseDateValue(fecha_entrada_recibe);
        const fechaSalidaRecibeParsed = parseDateValue(fecha_salida_recibe);
        const horaEntradaRecibeParsed = `${hora_entrada_recibe}:00.000Z`;
        const horaSalidaRecibeParsed = `${hora_salida_recibe}:00.000Z`;

        console.log('horaEntradaEntregaParsed', horaEntradaEntregaParsed);
        console.log('horaSalidaEntregaParsed', horaSalidaEntregaParsed);
        console.log('horaEntradaRecibeParsed', horaEntradaRecibeParsed);
        console.log('horaSalidaRecibeParsed', horaSalidaRecibeParsed);

        // Validar que todas las fechas y horas sean válidas
        if (!fechaEntradaEntregaParsed || !fechaSalidaEntregaParsed || !horaEntradaEntregaParsed || !horaSalidaEntregaParsed ||
            !fechaEntradaRecibeParsed || !fechaSalidaRecibeParsed || !horaEntradaRecibeParsed || !horaSalidaRecibeParsed) {
            return NextResponse.json({
                status: false,
                message: "Una o más fechas u horas son inválidas. Verifique el formato de los datos enviados."
            }, { status: 400 });
        }

        // Convertir a ISO strings
        const fechaEntradaEntregaISO = fechaEntradaEntregaParsed.toISOString();
        const fechaSalidaEntregaISO = fechaSalidaEntregaParsed.toISOString();
        const horaEntradaEntregaISO = new Date(horaEntradaEntregaParsed).toISOString();
        const horaSalidaEntregaISO = new Date(horaSalidaEntregaParsed).toISOString();
        const fechaEntradaRecibeISO = fechaEntradaRecibeParsed.toISOString();
        const fechaSalidaRecibeISO = fechaSalidaRecibeParsed.toISOString();
        const horaEntradaRecibeISO = new Date(horaEntradaRecibeParsed).toISOString();
        const horaSalidaRecibeISO = new Date(horaSalidaRecibeParsed).toISOString();

        // Validar que todas las fechas y horas sean válidas
        if (!fechaEntradaEntregaISO || !fechaSalidaEntregaISO || !horaEntradaEntregaISO || !horaSalidaEntregaISO ||
            !fechaEntradaRecibeISO || !fechaSalidaRecibeISO || !horaEntradaRecibeISO || !horaSalidaRecibeISO) {
            return NextResponse.json({
                status: false,
                message: "Una o más fechas u horas son inválidas. Verifique el formato de los datos enviados."
            }, { status: 400 });
        }

        // Crear el registro
        const nuevoRegistro = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_registro_entrega_puesto",
                data: {
                    cliente_id: parseInt(cliente_id),
                    corpo_id: parseInt(corpo_id),
                    puesto_id: parseInt(puesto_id),
                    oficial_entrega,
                    fecha_entrada_entrega: fechaEntradaEntregaISO,
                    fecha_salida_entrega: fechaSalidaEntregaISO,
                    hora_entrada_entrega: horaEntradaEntregaISO,
                    hora_salida_entrega: horaSalidaEntregaISO,
                    turno_entrega,
                    oficial_recibe,
                    fecha_entrada_recibe: fechaEntradaRecibeISO,
                    fecha_salida_recibe: fechaSalidaRecibeISO,
                    hora_entrada_recibe: horaEntradaRecibeISO,
                    hora_salida_recibe: horaSalidaRecibeISO,
                    turno_recibe,
                    articulos_puesto: sanitizeArticulosPuestoForPersistence(articulos_puesto),
                    observaciones: observaciones || '',
                    firma_recibe: firmaRecibeFinal,
                    firma_entrega: firmaEntregaFinal,
                    firma_responsable: firmaResponsableFinal,
                    created_at: now.toISOString(),
                    created_by: empleadoId,
                },
            },
        });

        if (nuevoRegistro) {
            if (marca_id) {
                const marca = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_marca_dia",
                        operation: "findUnique",
                        where: { id: Number(marca_id) },
                    },
                });
                if (marca?.plaza_id && marca?.puesto_id) {
                    const actividadesPuesto = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_actividades_puesto",
                            operation: "findMany",
                            where: { puesto_id: marca.puesto_id },
                        },
                    });
                    const actividadIds = Array.from(
                        new Set(
                            (Array.isArray(actividadesPuesto) ? actividadesPuesto : [])
                                .map((x: any) => Number(x.actividad_id))
                                .filter(Boolean)
                        )
                    );
                    if (actividadIds.length > 0) {
                        const actividades = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "e_actividades",
                                operation: "findMany",
                                where: { id: { in: actividadIds }, es_revision_equipo: true },
                                select: { id: true },
                            },
                        });
                        const revisionActividadIds = new Set((Array.isArray(actividades) ? actividades : []).map((a: any) => Number(a.id)));
                        const actividadPuestoIds = (Array.isArray(actividadesPuesto) ? actividadesPuesto : [])
                            .filter((x: any) => revisionActividadIds.has(Number(x.actividad_id)))
                            .map((x: any) => Number(x.id));
                        if (actividadPuestoIds.length > 0) {
                            await callDynamicPrisma({
                                req,
                                data: {
                                    action: "UPDATE",
                                    table: "e_actividades_puesto_plaza",
                                    operation: "updateMany",
                                    many: true,
                                    where: {
                                        plaza_id: marca.plaza_id,
                                        actividad_puesto_id: { in: actividadPuestoIds },
                                        marcada: false,
                                    },
                                    data: {
                                        marcada: true,
                                        updated_at: now.toISOString(),
                                    },
                                    returning: false,
                                },
                            });
                        }
                    }
                }
            }

            let location = "";
            if (puesto_id) {
                const puesto = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: puesto_id },
                    },
                });
                if (puesto && puesto.id) {
                    location = `para el puesto "${puesto.nombre || ""}"`;
                    const cliente = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_cliente",
                            operation: "findUnique",
                            where: { id: cliente_id },
                        },
                    });
                    if (cliente && cliente.id) {
                        location += ` del cliente "${cliente.nombre || ""}"`;
                    }
                }
            }

            let employee = "Desconocido";
            const empleado = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: empleadoId },
                },
            });
            if (empleado && empleado.id) {
                employee = `${empleado.nombre || ""} ${empleado.primer_apellido || ""} ${empleado.segundo_apellido || ""}`;
            }

            const mantResult = await processEntregaPuestosArticulosMantenimiento(
                req,
                articulos_puesto,
                now,
            );
            const { send_notification, articulos_desc } = mantResult;

            if (nuevoRegistro?.id) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "UPDATE",
                        table: "e_registro_entrega_puesto",
                        where: { id: nuevoRegistro.id },
                        data: { articulos_puesto: mantResult.articulos_puesto_stored },
                    },
                });
            }

            if (send_notification) {
                const fechaEntradaFormatted = fecha_entrada_entrega.includes("T") ? fecha_entrada_entrega.split("T")[0] : fecha_entrada_entrega;
                const horaEntradaFormatted = hora_entrada_entrega.includes("T") ? hora_entrada_entrega.split("T")[1].split(".")[0] : hora_entrada_entrega;
                const description = `El usuario ${employee} ha registrado una entrega de puesto${location} (Ocupado anteriormente por ${oficial_entrega}) el día ${fechaEntradaFormatted} a las ${horaEntradaFormatted}${articulos_desc}`;
                await sendNotificationByRole(req, nuevoRegistro.corpo_id, [], "Registro de entrega de puesto creado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

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