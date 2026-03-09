import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { marca_id,
            corpo_id,
            puesto_id,
            plaza_id,
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
            firma_empleado_manual,
            tipo } = await req.json();

        console.log("marca_id", marca_id);
        console.log("nombre_colaborador", nombre_colaborador);
        console.log("cedula_colaborador", cedula_colaborador);
        console.log("tipo", tipo);
        console.log("corpo_id", corpo_id);
        console.log("puesto_id", puesto_id);
        console.log("plaza_id", plaza_id);
        console.log("empleado_id", empleado_id);
        console.log("evaluador_id", evaluador_id);
        console.log("fecha_ingreso", fecha_ingreso);
        console.log("fecha_evaluacion", fecha_evaluacion);
        //console.log("evaluacion", evaluacion);
        console.log("firma_evaluador", firma_evaluador);
        console.log("firma_empleado", firma_empleado);
        console.log("firma_empleado_manual", firma_empleado_manual);
        console.log("comentarios", comentarios);
        console.log("--------------------------------");
        if (!marca_id || !nombre_colaborador || !cedula_colaborador || !tipo || !empleado_id || !evaluador_id || !fecha_ingreso || !fecha_evaluacion || !evaluacion || !firma_evaluador) {
            console.log("Datos incompletos");
            return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marca_id } }
        });
        if (!marca) return NextResponse.json({ message: "Marca no encontrada" }, { status: 404 });

        const cliente = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: marca.cliente_id } }
        });
        if (!cliente) return NextResponse.json({ message: "Cliente no encontrado" }, { status: 404 });

        const corpoIdToUse = corpo_id ?? marca.corpo_id;
        const puestoIdToUse = puesto_id ?? marca.puesto_id;
        const plazaIdToUse = plaza_id ?? marca.plaza_id;

        const corpo = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoIdToUse } }
        });
        if (!corpo) return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });

        const puesto = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoIdToUse } }
        });
        if (!puesto) return NextResponse.json({ message: "Puesto no encontrado" }, { status: 404 });

        const plaza = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_plazas", operation: "findUnique", where: { id: plazaIdToUse } }
        });
        if (!plaza) return NextResponse.json({ message: "Plaza no encontrada" }, { status: 404 });

        const empleado = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: empleado_id } }
        });
        if (!empleado) return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
        if (empleado.fecha_contratacion == null) return NextResponse.json({ message: "Empleado no ha sido contratado" }, { status: 400 });
        if (empleado.estado == "BA") return NextResponse.json({ message: "Empleado fue dado de baja" }, { status: 400 });

        const evaluador = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: evaluador_id } }
        });
        if (!evaluador) return NextResponse.json({ message: "Evaluador no encontrado" }, { status: 404 });
        if (evaluador.fecha_contratacion == null) return NextResponse.json({ message: "Evaluador no ha sido contratado" }, { status: 400 });
        if (evaluador.estado == "BA") return NextResponse.json({ message: "Evaluador fue dado de baja" }, { status: 400 });
        if (!evaluador.nombre) return NextResponse.json({ message: "Evaluador no tiene nombre" }, { status: 400 });

        const evaluacion_empleado = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_evaluacion_empleado",
                data: {
                    empleado_id: empleado_id,
                    evaluador_id: evaluador_id,
                    fecha_ingreso: new Date(fecha_ingreso).toISOString(),
                    fecha_evaluacion: new Date(fecha_evaluacion).toISOString(),
                    evaluacion: "-",
                    tipo: tipo,
                    comentarios: comentarios,
                    firma_evaluador: firma_evaluador,
                    firma_empleado: (firma_empleado != null && String(firma_empleado).trim().length > 0) ? String(firma_empleado) : null,
                    firma_empleado_manual: (firma_empleado_manual != null && typeof firma_empleado_manual === "string" && firma_empleado_manual.trim().length > 0) ? firma_empleado_manual : null,
                    corpo_id: corpo.id,
                    puesto_id: puesto.id,
                    plaza_id: plaza.id,
                    nombre_empleado: nombre_colaborador,
                    nombre_evaluador: evaluador.nombre + " " + evaluador.primer_apellido + (evaluador.segundo_apellido ? " " + evaluador.segundo_apellido : ""),
                    cedula_empleado: cedula_colaborador,
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString()
                }
            }
        });

        if (evaluacion_empleado) {
            const description = `Se ha registrado tu evaluación realizada por ${nombre_colaborador} el día ${fecha_evaluacion} para la sucursal ${corpo.nombre} de la empresa ${cliente.nombre}`;
            await sendNotificationByEmployee(req, corpo.id, [empleado_id], "Evaluación realizada", description, [evaluador_id]);
            const evaluacion_json = JSON.parse(evaluacion);

            const imagesToUpload: { question: any; file: string; index?: number; fromArray: boolean }[] = [];
            for (const item of evaluacion_json) {
                for (const question of item.questions || []) {
                    // Nuevo: múltiples imágenes en `images` (tiene prioridad)
                    if (Array.isArray(question.images) && question.images.length > 0) {
                        question.images.forEach((img: any, idx: number) => {
                            if (typeof img === "string" && img.startsWith("data:")) {
                                imagesToUpload.push({ question, file: img, index: idx, fromArray: true });
                            }
                        });
                    } else if (question.image && typeof question.image === "string" && question.image.startsWith("data:")) {
                        // Soporte legado: una sola imagen en `image`
                        imagesToUpload.push({ question, file: question.image, fromArray: false });
                    }
                }
            }

            if (imagesToUpload.length > 0) {
                const getExt = (f: string) => {
                    const m = f.match(/^data:(.+);base64,/);
                    return m ? m[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg" : "jpg";
                };
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `evaluations/${evaluacion_empleado.id}/images`,
                    files: imagesToUpload.map(({ file }) => ({ type: "image", extension: getExt(file), file_base64: file })),
                });
                const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                imagesToUpload.forEach(({ question, index, fromArray }, i) => {
                    if (!uploaded[i]) return;
                    const name = uploaded[i].name;
                    if (fromArray) {
                        if (!Array.isArray(question.images)) {
                            question.images = [];
                        }
                        if (typeof index === "number") {
                            question.images[index] = name;
                        } else {
                            question.images.push(name);
                        }
                        if (!question.image && question.images.length > 0) {
                            question.image = question.images[0];
                        }
                    } else {
                        question.image = name;
                        if (!Array.isArray(question.images)) {
                            question.images = [];
                        }
                        if (!question.images.includes(name)) {
                            question.images.push(name);
                        }
                    }
                });
            }

            const updated_evaluacion = await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "c_evaluacion_empleado",
                    where: { id: evaluacion_empleado.id },
                    data: { evaluacion: JSON.stringify(evaluacion_json) }
                }
            });
        }
        return NextResponse.json({ status: true, message: "Evaluación creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}