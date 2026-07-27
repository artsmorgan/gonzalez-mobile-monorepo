import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

export async function getActivities(req: NextRequest, id: number) {
    try {
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }

        const fechaMarca = marcaDia.fecha instanceof Date ? marcaDia.fecha : new Date(marcaDia.fecha);
        const now = toZonedTime(new Date(), "America/Costa_Rica");

        if (!marcaDia.hora_inicio) {
            return { status: false, message: "Hora de inicio no establecida" };
        }

        const horaInicioMarca = marcaDia.hora_inicio instanceof Date
            ? marcaDia.hora_inicio
            : new Date(marcaDia.hora_inicio);
        const shiftStart = new Date(fechaMarca);
        shiftStart.setHours(
            horaInicioMarca.getHours(),
            horaInicioMarca.getMinutes(),
            horaInicioMarca.getSeconds(),
            horaInicioMarca.getMilliseconds()
        );

        const actividadesPuesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_actividades_puesto",
                operation: "findMany",
                where: { puesto_id: marcaDia.puesto_id },
            },
        });

        const actividadIds = Array.from(
            new Set((Array.isArray(actividadesPuesto) ? actividadesPuesto : []).map((item: any) => Number(item.actividad_id)).filter(Boolean))
        );
        if (actividadIds.length === 0) return { status: true, actividades: [] };

        const actividadesBd = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_actividades",
                operation: "findMany",
                where: { id: { in: actividadIds } },
            },
        });
        const actividadById = new Map<number, any>((Array.isArray(actividadesBd) ? actividadesBd : []).map((a: any) => [Number(a.id), a]));

        const actividades: any[] = [];
        for (const actividadPuesto of Array.isArray(actividadesPuesto) ? actividadesPuesto : []) {
            const actividad = actividadById.get(Number(actividadPuesto.actividad_id));
            if (!actividad) continue;
            let is_today = false;

            const fechaInicio = actividad.fecha_inicio instanceof Date
                ? actividad.fecha_inicio
                : new Date(actividad.fecha_inicio);

            const fechaFin = actividad.fecha_fin
                ? (actividad.fecha_fin instanceof Date ? actividad.fecha_fin : new Date(actividad.fecha_fin))
                : null;

            is_today = validateDates(fechaInicio, fechaMarca, actividad.frecuencia, fechaFin);

            let pendiente = false;
            let registro: any = null;

            if (is_today) {
                registro = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_actividades_puesto_plaza",
                        operation: "findFirst",
                        where: {
                            actividad_puesto_id: actividadPuesto.id,
                            plaza_id: marcaDia.plaza_id,
                            created_at: { gte: shiftStart.toISOString(), lte: now.toISOString() },
                        },
                        orderBy: { id: "desc" },
                    }
                });
                if (!registro) {
                    registro = await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "e_actividades_puesto_plaza",
                            data: {
                                actividad_puesto_id: actividadPuesto.id,
                                plaza_id: marcaDia.plaza_id,
                                bitacora: "-",
                                articles: null,
                                marcada: false,
                                created_at: now.toISOString(),
                                updated_at: now.toISOString(),
                            },
                        },
                    });
                }
            } else {
                registro = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_actividades_puesto_plaza",
                        operation: "findFirst",
                        where: { actividad_puesto_id: actividadPuesto.id, plaza_id: marcaDia.plaza_id, marcada: false },
                        orderBy: { id: "asc" },
                    }
                });
                if (registro) {
                    pendiente = true;
                }
            }

            if (!registro) continue;

            const es_revision_equipo = Boolean(actividad.es_revision_equipo);
            let articlesParsed: any[] = [];
            // Para actividades de tipo Inventario: siempre refrescar artículos del puesto y actualizar el registro
            // (tanto si el registro se acaba de crear como si ya existía al recargar la ventana).
            if (es_revision_equipo) {
                if (!marcaDia.puesto_id) {
                    continue;
                }
                const articlesFromPuesto = await buildArticlesFromPuesto(req, marcaDia.puesto_id);
                let existingParsed: any[] = [];
                try {
                    existingParsed = registro.articles ? (typeof registro.articles === "string" ? JSON.parse(registro.articles) : registro.articles) : [];
                } catch {
                    existingParsed = [];
                }
                if (!Array.isArray(existingParsed)) existingParsed = [];
                // Clave compuesta tipo:id para no mezclar Plan y Asignado que pueden compartir id
                const existingByKey = new Map<string, any>(
                    existingParsed.map((a: any) => [`${String(a?.tipo ?? "")}:${Number(a?.id)}`, a])
                );
                articlesParsed = (Array.isArray(articlesFromPuesto) ? articlesFromPuesto : []).map((item: any) => {
                    const key = `${String(item?.tipo ?? "")}:${Number(item?.id)}`;
                    const existing = existingByKey.get(key);
                    if (!existing) return { ...item };
                    return {
                        ...item,
                        cantidad_real: existing.cantidad_real !== undefined ? existing.cantidad_real : item.cantidad_real,
                        estado: existing.estado !== undefined && existing.estado !== "" ? existing.estado : item.estado,
                        observaciones: existing.observaciones !== undefined ? existing.observaciones : item.observaciones,
                        marcada: existing.marcada !== undefined ? existing.marcada : item.marcada,
                        file_name: existing.file_name !== undefined ? existing.file_name : item.file_name,
                    };
                });
                // Persistir en BD siempre (creación o invocación del registro) para que al recargar se vea actualizado
                console.log("Actualizando artículos en la actividad", registro.id);
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "UPDATE",
                        table: "e_actividades_puesto_plaza",
                        where: { id: registro.id },
                        data: { articles: JSON.stringify(articlesParsed), updated_at: now.toISOString() },
                        returning: false,
                    },
                });
            }

            const inventario = es_revision_equipo
                ? (Array.isArray(articlesParsed) ? articlesParsed : []).map((item: any) => ({
                    id: Number(item.id),
                    nombre: String(item.nombre || "Artículo"),
                    tipo: String(item.tipo || ""),
                    cantidad_requerida: Number(item.cantidad_requerida || 0),
                    cantidad_real: Number(item.cantidad_real || 0),
                    estado: String(item.estado || "Bueno"),
                    observaciones: String(item.observaciones || ""),
                    reglas: [],
                    revision_equipo: {
                        id: Number(registro.id),
                        marcada: Boolean(item.marcada),
                        es_correcto: String(item.estado || "Bueno") === "Bueno",
                        motivo_incorrecto: String(item.observaciones || ""),
                        imagen_adjunta: item.file_name || null,
                    },
                }))
                : [];

            let frecuencia = "";
            let scheduleTimes: string[] = [];
            try {
                const frecuencia_json = JSON.parse(actividad.frecuencia);
                frecuencia = frecuencia_json.title || "";
                if (Array.isArray(frecuencia_json.schedule)) {
                    scheduleTimes = (frecuencia_json.schedule as unknown[])
                        .filter((x): x is string => typeof x === "string" && /^\d{2}:\d{2}$/.test(String(x).trim()))
                        .map((x) => String(x).trim());
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Error desconocido";
                console.log(errorMessage);
            }

            actividades.push({
                id: registro.id,
                nombre_actividad: actividad.nombre_actividad,
                descripcion_actividad: actividad.descripcion_actividad,
                frecuencia,
                ...(scheduleTimes.length > 0 ? { schedule: scheduleTimes } : {}),
                is_revision_equipo: es_revision_equipo,
                is_marcada: Boolean(registro.marcada),
                is_pendiente: pendiente,
                inventario,
                imagen_adjunta: registro.file_name || null
            });
        }


        return { status: true, actividades };
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return { status: false, message: errorMessage };
    }
}

/**
 * Obtiene los artículos del puesto con la misma lógica que GET /api/entrega-puestos
 * (combo -> plan directo sin duplicados -> asignados/entrega; luego último mantenimiento por artículo).
 */
async function buildArticlesFromPuesto(_req: NextRequest, puestoId: number) {
    const articulos_return: any[] = [];

    const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } });
    if (!puesto || !puesto.id) return articulos_return;
    const corpoId = puesto.sucursal_id;

    // 1) Artículos del combo del puesto (si existe) — igual que entrega-puestos
    if (puesto.comboArticulosCP_id) {
        const combo_articulo_cp = await prisma.e_estructura_combo_articulo_cp.findUnique({
            where: { id: puesto.comboArticulosCP_id },
        });
        if (combo_articulo_cp && combo_articulo_cp.id) {
            const articulos_combo_articulo_cp = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
                where: { combo_id: combo_articulo_cp.id },
            });
            const articulosComboArray = Array.isArray(articulos_combo_articulo_cp) ? articulos_combo_articulo_cp : [];
            for (const articulo of articulosComboArray) {
                let art_bd = null;
                if (articulo.articuloCP_id) {
                    art_bd = await prisma.n_articulo_corpo_puesto.findUnique({
                        where: { id: articulo.articuloCP_id },
                    });
                }
                const cantidad = Number(articulo.cantidad) || 0;
                articulos_return.push({
                    id: articulo.id,
                    nombre: art_bd ? art_bd.nombre : "Artículo inidentificable",
                    tipo: "Plan",
                    marca: "",
                    serie: "",
                    modelo: "",
                    cantidad_requerida: cantidad,
                    cantidad_real: cantidad,
                    estado: "Bueno",
                    observaciones: "",
                    marcada: false,
                    file_name: null,
                });
            }
        }
    }

    // 2) Plan directo del puesto (evitar duplicados por id) — igual que entrega-puestos
    const planOr: { puesto_id?: number; corpo_id?: number }[] = [{ puesto_id: puestoId }];
    if (corpoId != null) planOr.push({ corpo_id: corpoId });
    const articulos_puesto_plan = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
        where: {
            OR: planOr,
            id: { notIn: articulos_return.map((a: any) => a.id) },
        },
    });
    const articulosPlanArray = Array.isArray(articulos_puesto_plan) ? articulos_puesto_plan : [];
    for (const articulo of articulosPlanArray) {
        let art_bd = null;
        if (articulo.articuloCP_id) {
            art_bd = await prisma.n_articulo_corpo_puesto.findUnique({
                where: { id: articulo.articuloCP_id },
            });
        }
        const cantidad = Number(articulo.cantidad) || 0;
        articulos_return.push({
            id: articulo.id,
            nombre: art_bd ? art_bd.nombre : "Artículo inidentificable",
            tipo: "Plan",
            marca: "",
            serie: "",
            modelo: "",
            cantidad_requerida: cantidad,
            cantidad_real: cantidad,
            estado: "Bueno",
            observaciones: "",
            marcada: false,
            file_name: null,
        });
    }

    // 3) Asignados del puesto (entrega) — mismo where que entrega-puestos: OR puesto_id / corpo_id
    const entregaOr: { puesto_id?: number; corpo_id?: number }[] = [{ puesto_id: puestoId }];
    if (corpoId != null) entregaOr.push({ corpo_id: corpoId });
    const articulos_puesto_entrega = await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({
        where: { OR: entregaOr },
    });
    const articulosEntregaArray = Array.isArray(articulos_puesto_entrega) ? articulos_puesto_entrega : [];
    for (const articulo of articulosEntregaArray) {
        let art_bd = null;
        if (articulo.nomencladorArticuloCP_id) {
            art_bd = await prisma.n_articulo_corpo_puesto.findUnique({
                where: { id: articulo.nomencladorArticuloCP_id },
            });
        }
        articulos_return.push({
            id: articulo.id,
            nombre: art_bd ? art_bd.nombre : "Artículo inidentificable",
            tipo: "Asignado",
            marca: articulo.marca || "",
            serie: articulo.serie || "",
            modelo: articulo.modelo || "",
            cantidad_requerida: 1,
            cantidad_real: 1,
            estado: "Bueno",
            observaciones: "",
            marcada: false,
            file_name: null,
        });
    }

    // 4) Adjuntar último mantenimiento a cada artículo — mismo criterio que entrega-puestos
    const planIds = articulos_return.filter((a: any) => a.tipo === "Plan").map((a: any) => a.id);
    const asignadoIds = articulos_return.filter((a: any) => a.tipo === "Asignado").map((a: any) => a.id);
    if (planIds.length > 0 || asignadoIds.length > 0) {
        const or: any[] = [];
        if (planIds.length) or.push({ articulo_plan_id: { in: planIds } });
        if (asignadoIds.length) or.push({ articulo_asignado_id: { in: asignadoIds } });
        const mantenimientos = await callDynamicPrisma({
            req: _req,
            data: {
                action: "GET",
                table: "c_articulo_mantenimiento",
                operation: "findMany",
                where: { OR: or },
                orderBy: { id: "desc" },
                select: { articulo_plan_id: true, articulo_asignado_id: true, estado: true, cantidad_real: true },
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
            const ultimo = a.tipo === "Plan" ? latestByPlanId.get(a.id) ?? null : a.tipo === "Asignado" ? latestByAsignadoId.get(a.id) ?? null : null;
            if (ultimo) {
                if (ultimo.estado === "Bueno" || ultimo.estado === "Malo" || ultimo.estado === "No está") a.estado = ultimo.estado;
                if (typeof ultimo.cantidad_real === "number") a.cantidad_real = Math.max(0, ultimo.cantidad_real);
            }
        }
    }

    return articulos_return;
}


function validateJSON(jsonString: string) {
    try {
        const config = JSON.parse(jsonString);

        // Validaciones básicas
        if (!config.type) {
            throw new Error('Tipo de repetición requerido');
        }

        if (config.type === 'custom') {
            if (!config.unit) {
                throw new Error('Unidad requerida para tipo personalizado');
            }
            if (!config.interval || config.interval < 1) {
                throw new Error('Intervalo debe ser mayor a 0');
            }
        }

        if (config.endType === 'date' && !config.endDate) {
            throw new Error('Fecha de finalización requerida');
        }

        return { valid: true, config };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return { valid: false, error: errorMessage };
    }
}

function validateDates(
    startDate: Date,
    currentDate: Date,
    jsonString: string,
    fechaFinActividad?: Date | null
) {

    const jsonValidation = validateJSON(jsonString);

    if (!jsonValidation.valid) {
        return false;
    }

    const isValid = isEventDate(startDate, currentDate, jsonValidation.config, fechaFinActividad);

    return isValid;
}


function isEventDate(start: Date, current: Date, config: any, fechaFinActividad?: Date | null) {

    // Si la fecha actual es anterior a la fecha de inicio, no es válida
    if (current < start) {
        console.log('Fecha actual es anterior a fecha de inicio');
        return false;
    }

    // Verificar si la fecha actual coincide con la configuración de repetición
    let result = false;
    switch (config.type) {
        case 'daily':
            result = isDailyMatch(start, current, config);
            break;

        case 'weekly':
            result = isWeeklyMatch(start, current, config);
            break;

        case 'monthly-weekday':
            result = isMonthlyWeekdayMatch(start, current, config);
            break;

        case 'monthly-last':
            result = isMonthlyWeekdayMatch(start, current, config);
            break;

        case 'yearly':
            result = isYearlyMatch(start, current, config);
            break;

        case 'weekdays':
            result = isWeekdaysMatch(start, current, config);
            break;

        case 'custom':
            result = isCustomMatch(start, current, config);
            break;

        default:
            result = false;
    }

    // Verificar condiciones de finalización
    if (result) {
        const endConditionsValid = checkEndConditions(current, config, fechaFinActividad);
        if (!endConditionsValid) {
            console.log('Condiciones de finalización no cumplidas');
            result = false;
        }
    }

    // Log de depuración
    console.log(`Validación ${config.type}:`, {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        config: config,
        result: result
    });

    return result;
}

function isDailyMatch(start: Date, current: Date, config: any) {
    const daysDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff % config.interval === 0;
}

function isWeeklyMatch(start: Date, current: Date, config: any) {
    const daysDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const targetWeekday = config.weekday !== undefined ? config.weekday : start.getDay();

    // Log de depuración detallado
    console.log('isWeeklyMatch debug:', {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        startWeekday: start.getDay(),
        currentWeekday: current.getDay(),
        targetWeekday: targetWeekday,
        daysDiff: daysDiff,
        config: config
    });

    // Verificar que la fecha actual sea el día de la semana correcto
    if (current.getDay() !== targetWeekday) {
        console.log('Día de la semana no coincide:', current.getDay(), 'vs', targetWeekday);
        return false;
    }

    // Calcular cuántas semanas han pasado desde el inicio
    const weeksDiff = Math.floor(daysDiff / 7);
    const result = weeksDiff >= 0 && weeksDiff % config.interval === 0;

    console.log('Cálculo de semanas:', {
        weeksDiff: weeksDiff,
        interval: config.interval,
        result: result
    });

    return result;
}

function isMonthlyWeekdayMatch(start: Date, current: Date, config: any) {
    // Calcular la diferencia de meses
    const monthsDiff = (current.getFullYear() - start.getFullYear()) * 12 +
        (current.getMonth() - start.getMonth());

    if (monthsDiff < 0 || monthsDiff % config.interval !== 0) {
        return false;
    }

    // Usar el día de la semana y ordinal guardados en la configuración
    const targetWeekday = config.weekday !== undefined ? config.weekday : start.getDay();
    const weekOrdinal = config.weekOrdinal !== undefined ? config.weekOrdinal : 4;

    // Log de depuración
    console.log('isMonthlyWeekdayMatch debug:', {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        targetWeekday: targetWeekday,
        weekOrdinal: weekOrdinal,
        monthsDiff: monthsDiff,
        config: config
    });

    let targetDate;
    if (weekOrdinal === 5) {
        // Último día de la semana del mes
        targetDate = getLastWeekdayOfMonth(current.getFullYear(), current.getMonth(), targetWeekday);
    } else {
        // N-ésimo día de la semana del mes
        targetDate = getNthWeekdayOfMonth(current.getFullYear(), current.getMonth(), targetWeekday, weekOrdinal);
    }

    console.log('Target date calculation:', {
        targetDate: targetDate,
        currentDay: current.getDate(),
        result: targetDate !== null && current.getDate() === targetDate
    });

    // Verificar que el día calculado existe y coincide
    return targetDate !== null && current.getDate() === targetDate;
}


function getLastWeekdayOfMonth(year: number, month: number, weekday: number) {
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    const daysToSubtract = (lastWeekday - weekday + 7) % 7;
    const targetDate = new Date(year, month + 1, 0 - daysToSubtract);
    return targetDate.getDate();
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysToAdd = (weekday - firstWeekday + 7) % 7 + (n - 1) * 7;
    const targetDate = new Date(year, month, 1 + daysToAdd);

    // Verificar que el día esté en el mes correcto
    if (targetDate.getMonth() !== month) {
        return null;
    }

    return targetDate.getDate();
}


function isYearlyMatch(start: Date, current: Date, config: any) {
    const yearsDiff = current.getFullYear() - start.getFullYear();
    const targetMonth = config.month !== undefined ? config.month - 1 : start.getMonth(); // -1 porque getMonth() es 0-indexado
    const targetDay = config.day !== undefined ? config.day : start.getDate();

    // Log de depuración
    console.log('isYearlyMatch debug:', {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        yearsDiff: yearsDiff,
        interval: config.interval,
        targetMonth: targetMonth,
        targetDay: targetDay,
        currentMonth: current.getMonth(),
        currentDay: current.getDate(),
        config: config
    });

    // Verificar que la fecha actual sea el día y mes correctos
    if (current.getMonth() !== targetMonth || current.getDate() !== targetDay) {
        console.log('Día o mes no coinciden');
        return false;
    }

    // Verificar que sea un año válido según el intervalo
    const result = yearsDiff >= 0 && yearsDiff % config.interval === 0;
    console.log('Verificación de años:', {
        yearsDiff: yearsDiff,
        interval: config.interval,
        result: result
    });

    return result;
}

function isWeekdaysMatch(start: Date, current: Date, config: any) {
    const daysDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) return false;

    // Verificar que la fecha actual sea un día laborable
    const dayOfWeek = current.getDay();
    if (dayOfWeek < 1 || dayOfWeek > 5) { // No es lunes a viernes
        return false;
    }

    // Contar solo días laborables desde el inicio hasta la fecha actual
    let weekdaysCount = 0;
    const tempDate = new Date(start);

    while (tempDate <= current) {
        const tempDayOfWeek = tempDate.getDay();
        if (tempDayOfWeek >= 1 && tempDayOfWeek <= 5) { // Lunes a viernes
            weekdaysCount++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // Verificar que sea un día laborable válido según el intervalo
    return weekdaysCount > 0 && (weekdaysCount - 1) % config.interval === 0;
}

function isCustomMatch(start: Date, current: Date, config: any) {
    switch (config.unit) {
        case 'day':
            return isDailyMatch(start, current, config);

        case 'week':
            return isCustomWeeklyMatch(start, current, config);

        case 'month':
            if (config.monthOption === 'day-of-month') {
                return isMonthlyDayMatch(start, current, config);
            } else {
                return isMonthlyWeekdayMatch(start, current, config);
            }

        case 'year':
            return isYearlyMatch(start, current, config);

        default:
            return false;
    }
}

function isCustomWeeklyMatch(start: Date, current: Date, config: any) {
    // Log de depuración
    console.log('isCustomWeeklyMatch debug:', {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        config: config
    });

    // Si no hay días de la semana especificados, usar la lógica semanal normal
    if (!config.weekdays || config.weekdays.length === 0) {
        return isWeeklyMatch(start, current, config);
    }

    // Verificar que la fecha actual sea uno de los días de la semana especificados
    const currentWeekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][current.getDay()];
    if (!config.weekdays.includes(currentWeekday)) {
        console.log('Día de la semana no está en la lista:', currentWeekday, 'vs', config.weekdays);
        return false;
    }

    // Calcular cuántas semanas han pasado desde el inicio
    const daysDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);

    console.log('Cálculo de semanas personalizado:', {
        daysDiff: daysDiff,
        weeksDiff: weeksDiff,
        interval: config.interval,
        result: weeksDiff >= 0 && weeksDiff % config.interval === 0
    });

    return weeksDiff >= 0 && weeksDiff % config.interval === 0;
}

function isMonthlyDayMatch(start: Date, current: Date, config: any) {
    const monthsDiff = (current.getFullYear() - start.getFullYear()) * 12 +
        (current.getMonth() - start.getMonth());

    // Log de depuración
    console.log('isMonthlyDayMatch debug:', {
        startDate: start.toDateString(),
        currentDate: current.toDateString(),
        monthsDiff: monthsDiff,
        interval: config.interval,
        config: config
    });

    if (monthsDiff < 0 || monthsDiff % config.interval !== 0) {
        console.log('Meses no coinciden con el intervalo');
        return false;
    }

    // Usar el día guardado en la configuración si está disponible
    const targetDay = config.day !== undefined ? config.day : start.getDate();
    const result = current.getDate() === targetDay;

    console.log('Verificación de día:', {
        currentDay: current.getDate(),
        targetDay: targetDay,
        result: result
    });

    return result;
}


function checkEndConditions(currentDate: Date, config: any, fechaFinActividad?: Date | null) {
    const normalizeDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const parseFechaFin = (value: Date | null | undefined) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return normalizeDate(value);
        return null;
    };

    const current = normalizeDate(currentDate);
    let endDate: Date | null = null;

    // Si la configuración indica que nunca termina, ignoramos cualquier límite de fecha,
    // incluyendo el campo fecha_fin de la actividad.
    if (config.endType === 'never') {
        return true;
    }

    // Límite proveniente de la configuración de frecuencia
    if (config.endType === 'date' && config.endDate) {
        endDate = createLocalDate(config.endDate.toString());
    }

    // Límite proveniente del campo fecha_fin de la actividad
    const endDateActividad = parseFechaFin(fechaFinActividad);
    if (endDateActividad) {
        endDate = endDate ? new Date(Math.min(endDate.getTime(), endDateActividad.getTime())) : endDateActividad;
    }

    if (endDate) {
        const result = current <= endDate;
        console.log('Verificación de fecha de finalización:', {
            currentDate: current.toDateString(),
            endDate: endDate.toDateString(),
            result: result
        });
        return result;
    }

    return true;
}

function createLocalDate(dateString: string) {
    // Crear fecha local sin problemas de zona horaria
    // dateString debe estar en formato "YYYY-MM-DD"
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 porque Date usa 0-indexado para meses
}
/*
function esSemanal(fechaInicio: Date, fechaFin: Date) {
    // Convertimos ambas fechas a objetos Date (por si no lo son)
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Calculamos la diferencia en milisegundos
    const diffMs = Math.abs(fin.getTime() - inicio.getTime()) as number;

    // Convertimos a días (1 día = 1000 ms * 60 s * 60 min * 24 h)
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si es múltiplo de 7
    return diffDias % 7 === 0;
}

function esQuincenal(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Ignorar horas (opcional, pero recomendado)
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    // Diferencia en milisegundos
    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si es múltiplo de 15
    return diffDias % 15 === 0;
}

function esMensual(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si es múltiplo de 30 días
    return diffDias % 30 === 0;
}

function esBimensual(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si pasaron múltiplos de 60 días (2 meses aprox)
    return diffDias % 60 === 0;
}

function esTrimestral(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si pasaron múltiplos de 90 días (~3 meses)
    return diffDias % 90 === 0;
}

function esSemestral(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Ignorar horas para evitar errores de redondeo
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    // Diferencia en días
    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si pasaron múltiplos de 180 días (≈ 6 meses)
    return diffDias % 180 === 0;
}

function esAnual(fechaInicio: Date, fechaFin: Date) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Ignorar horas para evitar problemas de redondeo
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    // Diferencia en días
    const diffMs = Math.abs(fin.getTime() - inicio.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Verificamos si es múltiplo de 360 días (~1 año)
    return diffDias % 360 === 0;
}
*/