import { PrismaClient } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function getActivities(marcaDia: any) {
    try {
        const actividades_bd = await prisma.e_actividad_corpo.findMany({
            where: {
                puesto_id: marcaDia.puesto_id, // ← el valor que buscas
                OR: [
                    { plaza_id: marcaDia.plaza_id }, // ← coincide con el valor
                    { plaza_id: null }        // ← o es nulo
                ]
            }
        });

        const actividades = [];
        for (const actividad of actividades_bd) {
            let add = false;
            switch (actividad.frecuencia) {
                case "Semanal":
                    add = esSemanal(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Quincenal":
                    add = esQuincenal(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Mensual":
                    add = esMensual(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Bimensual":
                    add = esBimensual(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Trimestral":
                    add = esTrimestral(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Semestral":
                    add = esSemestral(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                case "Anual":
                    add = esAnual(actividad.fecha_inicio, marcaDia.fecha);
                    break;
                default:
                    add = true;
            }

            if (add) {
                const fecha_inicio = new Date(marcaDia.fecha);
                fecha_inicio.setHours(marcaDia.hora_inicio.getHours(), marcaDia.hora_inicio.getMinutes(), marcaDia.hora_inicio.getSeconds(), marcaDia.hora_inicio.getMilliseconds());
                const fecha_fin = toZonedTime(new Date(), "America/Costa_Rica");

                let marcada = await prisma.e_actividad_corpo_marcada.findFirst({
                    where: {
                        actividadCorpo_id: actividad.id,
                        created_at: {
                            gte: fecha_inicio,
                            lte: fecha_fin
                        }
                    }
                });

                if (!marcada) {
                    marcada = await prisma.e_actividad_corpo_marcada.create({
                        data: {
                            actividadCorpo_id: actividad.id,
                            empleado_id: marcaDia.empleadoFijo_id,
                            bitacora: "-",
                            marcada: actividad.es_revision_equipo,
                            created_at: fecha_fin,
                            updated_at: fecha_fin
                        }
                    });
                }

                const es_revision_equipo = actividad.es_revision_equipo;

                const inventario = [];
                if (es_revision_equipo) {
                    const equipo = await prisma.e_actividad_corpo_equipo.findFirst({
                        where: {
                            actividadCorpo_id: actividad.id,
                        }
                    });
                    if (equipo) {
                        const equipo_items = JSON.parse(equipo.reglas);
                        for (const item of equipo_items) {
                            const articulo = await prisma.n_articulo_corpo_puesto.findFirst({ where: { id: item.id } });
                            if (articulo) {
                                const item_add: { id: number, nombre: string, reglas: { nombre: string, valor: string }[], revision_equipo: { id: number, es_correcto: boolean, motivo_incorrecto: string } | null } = {
                                    id: articulo.id,
                                    nombre: articulo.nombre,
                                    reglas: [],
                                    revision_equipo: null
                                }
                                for (const regla of item.reglas as { nombre: string, valor: string }[]) {
                                    item_add.reglas.push({ nombre: regla.nombre, valor: regla.valor });
                                }

                                let revision_equipo: { id: number, marcada: boolean, es_correcto: boolean, motivo_incorrecto: string } | null = null;
                                let corpo_revision_equipo = await prisma.e_actividad_corpo_revision_equipo.findFirst({ where: { actividadCorpoEquipo_id: equipo.id, articulo_id: articulo.id, created_at: { gte: fecha_inicio, lte: fecha_fin } } });
                                if (!corpo_revision_equipo) {
                                    corpo_revision_equipo = await prisma.e_actividad_corpo_revision_equipo.create({
                                        data: {
                                            actividadCorpoEquipo_id: equipo.id,
                                            empleado_id: marcaDia.empleadoFijo_id,
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
                                    motivo_incorrecto: corpo_revision_equipo.motivo_incorrecto
                                };
                                item_add.revision_equipo = revision_equipo;
                                inventario.push(item_add);
                            }
                        }
                    }
                }

                console.log(inventario);

                actividades.push({
                    id: actividad.id,
                    nombre_actividad: actividad.nombre_actividad,
                    descripcion_actividad: actividad.descripcion_actividad,
                    frecuencia: actividad.frecuencia,
                    is_revision_equipo: es_revision_equipo,
                    is_marcada: marcada.marcada,
                    inventario: inventario
                });
            }
        }

        return { status: true, actividades };
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return { status: false, message: errorMessage };
    }
}


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
