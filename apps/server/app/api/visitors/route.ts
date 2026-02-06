/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../utils/prismaClient";
import { verifyAccessToken } from "../../../utils/verifyToken";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from "date-fns-tz";
import path from "path";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { getUserMarca } from "../../../utils/getUserMarca";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }
        const searchParams = req.nextUrl.searchParams;
        const marca = searchParams.get("m");

        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const lastMarca = await getUserMarca(marcaDia.empleadoFijo_id);
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marcaDia.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
        }

        const visitas = await prisma.e_registro_personas.findMany({ where: { corpo_id: marcaDia.corpo_id } });

        const visitas_return: any[] = [];
        for (const v of visitas) {

            const responsable = await prisma.c_empleado.findUnique({ where: { id: v.responsable_id } });
            if (!responsable) {
                return NextResponse.json({ status: false, message: "Responsable no encontrado" }, { status: 200 });
            }

            const activos = [];
            const activo_visitante = await prisma.e_activo_visitante.findMany({ where: { visitante_id: v.id } });
            if (activo_visitante.length > 0) {
                for (const a of activo_visitante) {
                    const tipo_activo = await prisma.n_tipo_activo_visitas.findUnique({ where: { id: a.tipo_id } });
                    if (tipo_activo) {
                        activos.push({
                            tipo: {
                                id: tipo_activo.id,
                                nombre: tipo_activo.nombre,
                            },
                            detalles: a.detalles,
                            numero_serie: a.numero_serie,
                            numero_activo: a.numero_activo,
                        });
                    }
                }
            }

            visitas_return.push({
                id: v.id,
                nombre: v.nombre,
                cedula: v.cedula,
                hora_entrada: v.hora_entrada,
                hora_salida: v.hora_salida,
                razon_visita: v.razon_visita,
                responsable: {
                    id: v.responsable_id,
                    nombre: responsable.nombre + " " + responsable.primer_apellido + " " + responsable.segundo_apellido,
                },
                es_funcionario: v.es_funcionario,
                observaciones: v.observaciones,
                tipo_accion: v.tipo_accion,
                pers_autoriza_salida: v.pers_autoriza_salida,
                foto_cedula: v.foto_cedula,
                updated_at: v.updated_at,
                activos: activos,
                id_local: ""
            });
        }

        return NextResponse.json({ status: true, data: visitas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            nombre,
            cedula,
            hora_entrada,
            hora_salida, // Opcional
            razon_visita,
            es_funcionario,
            observaciones, // Opcional
            tipo_accion, // Opcional
            pers_autoriza_salida, // Opcional
            foto_cedula, // viene en base64 y opcional
            activos,
        } = await req.json();

        console.log(activos);


        // Verificar marca
        const marcaDia = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(marca_id) },
        });
        if (!marcaDia) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        // Crear registro
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

        const new_visita = await prisma.e_registro_personas.create({
            data: {
                cliente_id: marcaDia.cliente_id,
                corpo_id: marcaDia.corpo_id,
                puesto_id: marcaDia.puesto_id,
                responsable_id: createdBy,
                created_at: createdAt,
                updated_at: createdAt,
                nombre,
                cedula,
                hora_entrada: new Date(hora_entrada),
                hora_salida: hora_salida ? new Date(hora_salida) : null,
                razon_visita,
                es_funcionario,
                observaciones,
                tipo_accion,
                pers_autoriza_salida,
            },
        });

        // Registrar cambio de creación
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "e_registro_personas",
                registro_id: new_visita.id,
                cambios: JSON.stringify([{
                    prop: "__created__",
                    before: null,
                    after: {
                        id: new_visita.id,
                        nombre: new_visita.nombre,
                        cedula: new_visita.cedula,
                        hora_entrada: new_visita.hora_entrada.toISOString(),
                        hora_salida: new_visita.hora_salida ? new_visita.hora_salida.toISOString() : null,
                        razon_visita: new_visita.razon_visita,
                        es_funcionario: new_visita.es_funcionario,
                        observaciones: new_visita.observaciones,
                        tipo_accion: new_visita.tipo_accion,
                        pers_autoriza_salida: new_visita.pers_autoriza_salida,
                        activos: activos,
                    },
                }]),
                created_at: createdAt,
                created_by: createdBy,
            },
        });

        if (new_visita) {
            const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
            if (empleado) {
                const entrada = new_visita.hora_entrada.toISOString();
                const fecha_entrada = entrada.split("T")[0];
                const hora_entrada = entrada.split("T")[1].split(".")[0];
                const tipo_visitante = es_funcionario ? "Funcionario" : "Visitante";
                const desc = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha registrado la visita de ${nombre} con la cedula ${cedula} el día ${fecha_entrada} a las ${hora_entrada}. Tipo de visitante: ${tipo_visitante}. Razón de la visita: ${razon_visita}`;
                await sendNotificationByRole(marcaDia.corpo_id, [marcaDia.plaza_id], "Visita registrada", desc, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }

            if (activos.length > 0) {
                for (const a of activos) {
                    const tipo_activo = await prisma.n_tipo_activo_visitas.findUnique({ where: { id: a.tipo_id } });
                    if (tipo_activo) {
                        await prisma.e_activo_visitante.create({
                            data: {
                                visitante_id: new_visita.id,
                                tipo_id: tipo_activo.id,
                                detalles: JSON.stringify(a.detalles),
                                numero_serie: a.numero_serie,
                                numero_activo: a.numero_activo ? a.numero_activo : null,
                            },
                        });
                    }
                }
            }

            // Guardar imagen si existe
            if (foto_cedula) {
                // ejemplo de cadena base64: data:image/jpeg;base64,/9j/4AAQ...
                const matches = foto_cedula.match(/^data:(.+);base64,(.+)$/);
                if (!matches) {
                    throw new Error("Formato base64 inválido");
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

                const id_cedula = uuidv4();
                const file_name = `${id_cedula}.${extension}`;

                const dir = path.join(
                    process.cwd(),
                    "public",
                    "uploads",
                    "visitors",
                    `${new_visita.id}`,
                    "cedula"
                );

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const filePath = path.join(dir, file_name);

                // Escribir el archivo en binario
                fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

                // Guardar el nombre del archivo en la BD
                await prisma.e_registro_personas.update({
                    where: { id: new_visita.id },
                    data: { foto_cedula: file_name },
                });
            }
        }

        return NextResponse.json(
            { status: true, message: "Visita registrada correctamente" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}