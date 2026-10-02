import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";
import { reportError } from "../../../utils/reportError";

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const contentType = req.headers.get("content-type") || "";
        let body: Record<string, any>;
        /** `Request#formData()`; doble aserción por colisión de tipos `FormData` en el entorno. */
        type MultipartBody = { get(name: string): string | { arrayBuffer(): Promise<ArrayBuffer> } | null };
        let multipartForm: MultipartBody | null = null;
        if (contentType.includes("multipart/form-data")) {
            try {
                const formData = (await req.formData()) as unknown as MultipartBody;
                multipartForm = formData;
                const rawMeta = formData.get("metadata");
                if (typeof rawMeta !== "string") {
                    await reportError(req, "api/evaluation", "POST", 400, "metadata faltante o inválido");
                    return NextResponse.json({ message: "metadata faltante o inválido" }, { status: 400 });
                }
                body = JSON.parse(rawMeta);
            } catch {
                await reportError(req, "api/evaluation", "POST", 400, "Cuerpo multipart inválido");
                return NextResponse.json({ message: "Cuerpo multipart inválido" }, { status: 400 });
            }
        } else {
            try {
                body = await req.json();
            } catch {
                await reportError(req, "api/evaluation", "POST", 400, "JSON inválido");
                return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
            }
        }

        const { marca_id,
            corpo_id,
            empresa_id,
            cliente_id,
            division_id,
            contrato_id,
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
            tipo } = body;

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
            await reportError(req, "api/evaluation", "POST", 400, "Datos incompletos");
            return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca || !marca.cliente_id) {
            await reportError(req, "api/evaluation", "POST", 404, "Marca no encontrada o cliente");
            return NextResponse.json({ message: "Marca no encontrada o cliente" }, { status: 404 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
        if (!cliente) {
            await reportError(req, "api/evaluation", "POST", 404, "Cliente no encontrado");
            return NextResponse.json({ message: "Cliente no encontrado" }, { status: 404 });
        }

        const corpoIdToUse = corpo_id ?? marca.corpo_id;
        const puestoIdToUse = puesto_id ?? marca.puesto_id;
        const plazaIdToUse = plaza_id ?? marca.plaza_id;
        const empresaIdToUse = empresa_id != null && Number(empresa_id) > 0 ? Number(empresa_id) : null;
        const clienteIdToUse = cliente_id != null && Number(cliente_id) > 0 ? Number(cliente_id) : null;
        const divisionIdToUse = division_id != null && Number(division_id) > 0 ? Number(division_id) : null;
        const contratoIdToUse = contrato_id != null && Number(contrato_id) > 0 ? Number(contrato_id) : null;
        if (
            empresaIdToUse == null || !Number.isFinite(empresaIdToUse) ||
            clienteIdToUse == null || !Number.isFinite(clienteIdToUse) ||
            divisionIdToUse == null || !Number.isFinite(divisionIdToUse) ||
            contratoIdToUse == null || !Number.isFinite(contratoIdToUse)
        ) {
            await reportError(req, "api/evaluation", "POST", 400, "Jerarquía incompleta (empresa, cliente, división y contrato requeridos)");
            return NextResponse.json({ message: "Jerarquía incompleta (empresa, cliente, división y contrato requeridos)" }, { status: 400 });
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpoIdToUse } });
        if (!corpo) {
            await reportError(req, "api/evaluation", "POST", 404, "Corpo no encontrado");
            return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoIdToUse } });
        if (!puesto) {
            await reportError(req, "api/evaluation", "POST", 404, "Puesto no encontrado");
            return NextResponse.json({ message: "Puesto no encontrado" }, { status: 404 });
        }

        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: plazaIdToUse } });
        if (!plaza) {
            await reportError(req, "api/evaluation", "POST", 404, "Plaza no encontrada");
            return NextResponse.json({ message: "Plaza no encontrada" }, { status: 404 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
        if (!empleado) {
            await reportError(req, "api/evaluation", "POST", 404, "Empleado no encontrado");
            return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
        }
        if (empleado.fecha_contratacion == null) {
            await reportError(req, "api/evaluation", "POST", 400, "Empleado no ha sido contratado");
            return NextResponse.json({ message: "Empleado no ha sido contratado" }, { status: 400 });
        }
        if (empleado.estado == "BA") {
            await reportError(req, "api/evaluation", "POST", 400, "Empleado fue dado de baja");
            return NextResponse.json({ message: "Empleado fue dado de baja" }, { status: 400 });
        }

        const evaluador = await prisma.c_empleado.findUnique({ where: { id: evaluador_id } });
        if (!evaluador) {
            await reportError(req, "api/evaluation", "POST", 404, "Evaluador no encontrado");
            return NextResponse.json({ message: "Evaluador no encontrado" }, { status: 404 });
        }
        if (evaluador.fecha_contratacion == null) {
            await reportError(req, "api/evaluation", "POST", 400, "Evaluador no ha sido contratado");
            return NextResponse.json({ message: "Evaluador no ha sido contratado" }, { status: 400 });
        }
        if (evaluador.estado == "BA") {
            await reportError(req, "api/evaluation", "POST", 400, "Evaluador fue dado de baja");
            return NextResponse.json({ message: "Evaluador fue dado de baja" }, { status: 400 });
        }
        if (!evaluador.nombre) {
            await reportError(req, "api/evaluation", "POST", 400, "Evaluador no tiene nombre");
            return NextResponse.json({ message: "Evaluador no tiene nombre" }, { status: 400 });
        }

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
                    empresa_id: empresaIdToUse,
                    cliente_id: clienteIdToUse,
                    division_id: divisionIdToUse,
                    contrato_id: contratoIdToUse,
                    isActive: true,
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

            let evaluacionStr = typeof evaluacion === "string" ? evaluacion : JSON.stringify(evaluacion);

            if (multipartForm) {
                const matches = Array.from(evaluacionStr.matchAll(/__STAFFEVAL_FILE__:(\d+)__/g));
                const uniqueSorted = [...new Set(matches.map((m) => parseInt(m[1], 10)))].sort((a, b) => a - b);
                if (uniqueSorted.length > 0) {
                    const filePayload: { type: "image"; extension: string; file_base64: string }[] = [];
                    for (const idx of uniqueSorted) {
                        const part = multipartForm.get(`file_${idx}`);
                        if (part == null || typeof part === "string") {
                            await reportError(req, "api/evaluation", "POST", 400, `Archivo file_${idx} faltante`);
                            return NextResponse.json({ message: `Archivo file_${idx} faltante` }, { status: 400 });
                        }
                        const fileBlob = part as unknown as Blob;
                        const ab = await fileBlob.arrayBuffer();
                        const mime = (fileBlob as { type?: string }).type || "image/jpeg";
                        const b64 = Buffer.from(ab).toString("base64");
                        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
                        filePayload.push({ type: "image", extension: ext, file_base64: `data:${mime};base64,${b64}` });
                    }
                    const uploadResp = await uploadDynamicFiles({
                        req,
                        folderPath: `evaluations/${evaluacion_empleado.id}/images`,
                        files: filePayload,
                    });
                    const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                    for (let i = 0; i < uniqueSorted.length; i++) {
                        if (!uploaded[i] || !uploaded[i].name) {
                            await reportError(req, "api/evaluation", "POST", 500, "Error al subir imágenes");
                            return NextResponse.json({ message: "Error al subir imágenes" }, { status: 500 });
                        }
                    }
                    for (let i = 0; i < uniqueSorted.length; i++) {
                        const idx = uniqueSorted[i];
                        const name = uploaded[i]!.name;
                        const token = `__STAFFEVAL_FILE__:${idx}__`;
                        evaluacionStr = evaluacionStr.split(token).join(name);
                    }
                }
            }

            const evaluacion_json = JSON.parse(evaluacionStr);

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
        if (!evaluacion_empleado) {
            await reportError(req, "api/evaluation", "POST", 500, "No se pudo crear el registro");
            return NextResponse.json({ status: false, message: "No se pudo crear el registro" }, { status: 500 });
        }

        const finalRow = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_evaluacion_empleado",
                operation: "findUnique",
                where: { id: evaluacion_empleado.id },
            },
        });
        const row = (finalRow ?? evaluacion_empleado) as {
            id: number;
            evaluacion?: string;
            comentarios?: string;
            firma_evaluador?: string;
            firma_empleado?: string | null;
            firma_empleado_manual?: string | null;
            tipo?: string;
            fecha_ingreso?: string | Date;
            fecha_evaluacion?: string | Date;
        };

        return NextResponse.json(
            {
                status: true,
                message: "Evaluación creada correctamente",
                data: {
                    id: row.id,
                    evaluacion: row.evaluacion ?? null,
                    comentarios: row.comentarios ?? null,
                    firma_evaluador: row.firma_evaluador ?? null,
                    firma_empleado: row.firma_empleado ?? null,
                    firma_empleado_manual: row.firma_empleado_manual ?? null,
                    tipo: row.tipo ?? null,
                    fecha_ingreso: row.fecha_ingreso instanceof Date ? row.fecha_ingreso.toISOString() : row.fecha_ingreso,
                    fecha_evaluacion: row.fecha_evaluacion instanceof Date ? row.fecha_evaluacion.toISOString() : row.fecha_evaluacion,
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/evaluation", "POST", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}