import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { marca_id,
            nombre_colaborador,
            cedula_colaborador,
            empleado_id,
            evaluador_id,
            fecha_ingreso,
            fecha_evaluacion,
            evaluacion,
            comentarios,
            firma_evaluador,
            firma_empleado,
            tipo } = await req.json();

        console.log("marca_id", marca_id);
        console.log("nombre_colaborador", nombre_colaborador);
        console.log("cedula_colaborador", cedula_colaborador);
        console.log("tipo", tipo);
        console.log("empleado_id", empleado_id);
        console.log("evaluador_id", evaluador_id);
        console.log("fecha_ingreso", fecha_ingreso);
        console.log("fecha_evaluacion", fecha_evaluacion);
        //console.log("evaluacion", evaluacion);
        console.log("firma_evaluador", firma_evaluador);
        console.log("firma_empleado", firma_empleado);
        console.log("comentarios", comentarios);
        console.log("--------------------------------");
        if (!marca_id || !nombre_colaborador || !cedula_colaborador || !tipo || !empleado_id || !evaluador_id || !fecha_ingreso || !fecha_evaluacion || !evaluacion || !firma_evaluador || !firma_empleado) {
            console.log("Datos incompletos");
            return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) return NextResponse.json({ message: "Marca no encontrada" }, { status: 404 });

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (!cliente) return NextResponse.json({ message: "Cliente no encontrado" }, { status: 404 });

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
        if (!puesto) return NextResponse.json({ message: "Puesto no encontrado" }, { status: 404 });

        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marca.plaza_id } });
        if (!plaza) return NextResponse.json({ message: "Plaza no encontrada" }, { status: 404 });

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
        if (!empleado) return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
        if (empleado.fecha_contratacion == null) return NextResponse.json({ message: "Empleado no ha sido contratado" }, { status: 400 });
        if (empleado.estado == "BA") return NextResponse.json({ message: "Empleado fue dado de baja" }, { status: 400 });

        const evaluador = await prisma.c_empleado.findUnique({ where: { id: evaluador_id } });
        if (!evaluador) return NextResponse.json({ message: "Evaluador no encontrado" }, { status: 404 });
        if (evaluador.fecha_contratacion == null) return NextResponse.json({ message: "Evaluador no ha sido contratado" }, { status: 400 });
        if (evaluador.estado == "BA") return NextResponse.json({ message: "Evaluador fue dado de baja" }, { status: 400 });
        if (!evaluador.nombre) return NextResponse.json({ message: "Evaluador no tiene nombre" }, { status: 400 });

        const evaluacion_empleado = await prisma.c_evaluacion_empleado.create({
            data: {
                empleado_id: empleado_id,
                evaluador_id: evaluador_id,
                fecha_ingreso: new Date(fecha_ingreso),
                fecha_evaluacion: new Date(fecha_evaluacion),
                evaluacion: "-",
                tipo: tipo,
                comentarios: comentarios,
                firma_evaluador: firma_evaluador,
                firma_empleado: firma_empleado,
                corpo_id: corpo.id,
                puesto_id: puesto.id,
                plaza_id: plaza.id,
                nombre_empleado: nombre_colaborador,
                nombre_evaluador: evaluador.nombre + " " + evaluador.primer_apellido + (evaluador.segundo_apellido ? " " + evaluador.segundo_apellido : ""),
                cedula_empleado: cedula_colaborador,
                created_at: toZonedTime(new Date(), "America/Costa_Rica")
            }
        });

        if (evaluacion_empleado) {
            const description = `Se ha registrado tu evaluación realizada por ${nombre_colaborador} el día ${fecha_evaluacion} para la sucursal ${corpo.nombre} de la empresa ${cliente.nombre}`;
            await sendNotificationByEmployee(marca_id, "Evaluación realizada", description, [empleado_id]);
            const evaluacion_json = JSON.parse(evaluacion);
            for (const item of evaluacion_json) {
                const questions = item.questions;
                for (const question of questions) {
                    const file = question.image;
                    if (file) {
                        const matches = file.match(/^data:(.+);base64,(.+)$/);
                        if (!matches) {
                            throw new Error("Formato base64 inválido");
                        }

                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

                        const file_name = `${uuidv4()}.${extension}`;

                        const dir = path.join(process.cwd(), "public", "uploads", "evaluations", `${evaluacion_empleado.id}`, "images");
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }

                        const filePath = path.join(dir, file_name);

                        // Escribir el archivo en binario
                        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

                        question.image = file_name;
                    }
                }
            }

            const updated_evaluacion = await prisma.c_evaluacion_empleado.update({ where: { id: evaluacion_empleado.id }, data: { evaluacion: JSON.stringify(evaluacion_json) } });
        }
        return NextResponse.json({ status: true, message: "Evaluación creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}