import { PrismaClient } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function getActivities(id: number) {
    try {
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }

        const actividades_puesto_plaza = await prisma.e_actividad_puesto_plaza.findMany({
            where: {
                OR: [
                    { plaza_id: marcaDia.plaza_id },
                    { plaza_id: null, puesto_id: marcaDia.puesto_id }
                ]
            }
        });

        const actividades_bd = await prisma.e_actividad_corpo.findMany({
            where: {
                id: { in: actividades_puesto_plaza.map((item) => item.actividadCorpo_id) }
            }
        });

        const actividades = [];
        for (const actividad of actividades_bd) {
            let is_today = false;

            is_today = validateDates(actividad.fecha_inicio, marcaDia.fecha, actividad.frecuencia);

            let pendiente = false;
            let id_no_marcado = null;

            if (!is_today) {
                const actividad_marcada = await prisma.e_actividad_corpo_plaza.findFirst({ where: { actividadCorpo_id: actividad.id, marcada: false } });
                if (actividad_marcada) {
                    pendiente = true;
                    id_no_marcado = actividad_marcada.id;
                }
            }

            if (is_today || pendiente) {
                const fecha_inicio = new Date(marcaDia.fecha);
                if (marcaDia.hora_inicio) {
                    fecha_inicio.setHours(marcaDia.hora_inicio.getHours(), marcaDia.hora_inicio.getMinutes(), marcaDia.hora_inicio.getSeconds(), marcaDia.hora_inicio.getMilliseconds());
                }
                else {
                    fecha_inicio.setHours(0, 0, 0, 0);
                }
                const fecha_fin = toZonedTime(new Date(), "America/Costa_Rica");

                // Si es pendiente, debo obtener la actividad cuyo dato "marcada" sea false, y si no, la obtengo según el dato created_at

                let marcada = null;
                if (pendiente) {
                    marcada = await prisma.e_actividad_corpo_plaza.findFirst({ where: { id: id_no_marcado as number } });
                }
                else {
                    marcada = await prisma.e_actividad_corpo_plaza.findFirst({ where: { actividadCorpo_id: actividad.id, plaza_id: marcaDia.plaza_id, created_at: { gte: fecha_inicio, lte: fecha_fin } } });
                    if (!marcada) {
                        marcada = await prisma.e_actividad_corpo_plaza.create({
                            data: {
                                actividadCorpo_id: actividad.id,
                                plaza_id: marcaDia.plaza_id,
                                bitacora: "-",
                                marcada: false,
                                created_at: fecha_fin,
                                updated_at: fecha_fin
                            }
                        });
                    }
                }

                if (marcada) {
                    const es_revision_equipo = actividad.es_revision_equipo;

                    const inventario = [];
                    if (es_revision_equipo) {
                        const equipo_items = JSON.parse(actividad.reglas);
                        for (const item of equipo_items) {
                            const articulo = await prisma.n_articulo_corpo_puesto.findFirst({ where: { id: item.id } });
                            if (articulo) {
                                const item_add: { id: number, nombre: string, reglas: { nombre: string, valor: string }[], revision_equipo: { id: number, marcada: boolean, imagen_adjunta: string | null, es_correcto: boolean, motivo_incorrecto: string } | null } = {
                                    id: articulo.id,
                                    nombre: articulo.nombre,
                                    reglas: [],
                                    revision_equipo: null
                                }
                                for (const regla of item.reglas as { nombre: string, valor: string }[]) {
                                    item_add.reglas.push({ nombre: regla.nombre, valor: regla.valor });
                                }

                                let revision_equipo: { id: number, marcada: boolean, es_correcto: boolean, motivo_incorrecto: string, imagen_adjunta: string | null } | null = null;
                                let corpo_revision_equipo = await prisma.e_actividad_corpo_revision_equipo.findFirst({ where: { actividadCorpoPlaza_id: marcada.id, articulo_id: articulo.id } });
                                if (!corpo_revision_equipo) {
                                    corpo_revision_equipo = await prisma.e_actividad_corpo_revision_equipo.create({
                                        data: {
                                            actividadCorpoPlaza_id: marcada.id,
                                            articulo_id: articulo.id,
                                            es_correcto: false,
                                            motivo_incorrecto: "",
                                            marcada: false,
                                            created_at: fecha_fin,
                                            updated_at: fecha_fin
                                        }
                                    });
                                }

                                revision_equipo = {
                                    id: corpo_revision_equipo.id,
                                    marcada: corpo_revision_equipo.marcada,
                                    es_correcto: corpo_revision_equipo.es_correcto,
                                    motivo_incorrecto: corpo_revision_equipo.motivo_incorrecto,
                                    imagen_adjunta: corpo_revision_equipo.file_name || null
                                };
                                item_add.revision_equipo = revision_equipo;
                                inventario.push(item_add);
                            }
                        }
                    }

                    let frecuencia = "";
                    try {
                        const frecuencia_json = JSON.parse(actividad.frecuencia);
                        frecuencia = frecuencia_json.title || "";
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
                        console.log(errorMessage);
                    }

                    actividades.push({
                        id: marcada.id,
                        nombre_actividad: actividad.nombre_actividad,
                        descripcion_actividad: actividad.descripcion_actividad,
                        frecuencia: frecuencia,
                        is_revision_equipo: es_revision_equipo,
                        is_marcada: marcada.marcada,
                        is_pendiente: pendiente,
                        inventario: inventario,
                        imagen_adjunta: marcada.file_name || null
                    });

                    console.log("Actividad encontrada:", actividad);
                }
            }
        }

        console.log("Resultados de actividades:", actividades);

        return { status: true, actividades };
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return { status: false, message: errorMessage };
    }
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

function validateDates(startDate: Date, currentDate: Date, jsonString: string) {

    const jsonValidation = validateJSON(jsonString);

    if (!jsonValidation.valid) {
        return false;
    }

    const isValid = isEventDate(startDate, currentDate, jsonValidation.config);

    return isValid;
}


function isEventDate(start: Date, current: Date, config: any) {

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
        const endConditionsValid = checkEndConditions(current, config);
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


function checkEndConditions(currentDate: Date, config: any) {
    if (config.endType === 'date') {
        const endDate = createLocalDate(config.endDate.toString());
        const result = currentDate <= endDate;
        console.log('Verificación de fecha de finalización:', {
            currentDate: currentDate.toDateString(),
            endDate: endDate.toDateString(),
            result: result
        });
        return result;
    }
    return true; // 'never'
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