import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByPlaza } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

type ManualFileInput = {
    type: string; // 'image' | 'audio' | 'video' | 'document' | etc
    extension: string; // e.g. 'png', 'mp4', 'pdf'
    original_name?: string; // nombre original del archivo (para mostrar en app)
    file_base64: string;
};

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");
        if (!puestoIdStr || String(puestoIdStr).trim() === "") {
            return NextResponse.json(
                { status: false, message: "Puesto no especificado" },
                { status: 200 }
            );
        }

        const targetPuestoId = parseInt(String(puestoIdStr), 10);
        if (!Number.isFinite(targetPuestoId) || targetPuestoId <= 0) {
            return NextResponse.json(
                { status: false, message: "puesto_id inválido" },
                { status: 200 }
            );
        }

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id: targetPuestoId },
            },
        });

        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 200 }
            );
        }

        const puestoObj = puesto as any;
        const employeeId = payload?.id as number;

        // Obtener manuales asociados al puesto mediante la tabla de relación
        const manualLinks = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_puestos_manual_puesto",
                operation: "findMany",
                where: { puesto_id: puestoObj.id },
            },
        });

        const manualIdsSet = new Set<number>();
        const manualLinksArray = Array.isArray(manualLinks) ? manualLinks : [];
        manualLinksArray.forEach((link: any) => {
            if (link.manual_puesto_id) {
                manualIdsSet.add(link.manual_puesto_id);
            }
        });

        // Compatibilidad hacia atrás: también incluir manuales que tengan puesto_id directamente
        const directManuals = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findMany",
                where: { puesto_id: puestoObj.id },
            },
        });
        const directManualsArray = Array.isArray(directManuals) ? directManuals : [];
        directManualsArray.forEach((manual: any) => {
            if (manual.id) {
                manualIdsSet.add(manual.id);
            }
        });

        const manualIds = Array.from(manualIdsSet);

        if (manualIds.length === 0) {
            return NextResponse.json(
                { status: true, manuals: [] },
                { status: 200 }
            );
        }

        const manuals = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findMany",
                where: { id: { in: manualIds } },
                orderBy: { created_at: "desc" },
            },
        });
        const manualsArray = Array.isArray(manuals) ? manuals : [];

        // Usar el origin de la petición para construir URLs absolutas accesibles desde el móvil
        const baseUrl = req.nextUrl.origin;

        const manualsWithFiles = await Promise.all(
            manualsArray.map(async (manual: any) => {
                const files = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_archivos_manual_puesto",
                        operation: "findMany",
                        where: { manual_puesto_id: manual.id },
                    },
                });

                const visualizaciones = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_empleado_visualizacion_manual_puesto",
                        operation: "findMany",
                        where: { manual_puesto_id: manual.id },
                        include: { e_empleado_visualizacion_archivos: true },
                    },
                });
                const visualizacionesArray = Array.isArray(visualizaciones) ? visualizaciones : [];
                const filesArray = Array.isArray(files) ? files : [];

                const currentEmployeeSigned = visualizacionesArray.some(
                    (v: any) => v.empleado_id === employeeId
                );

                const filesMapped = filesArray.map((file: any) => {
                    const fileName = file.name;

                    // Construir URLs hacia las APIs específicas, similar a incidents
                    let urlPath = `/uploads/job-manuals/${manual.id}/${fileName}`;
                    if (file.type === 'image') {
                        urlPath = `/api/job-manuals/${manual.id}/get-image/${fileName}`;
                    } else if (file.type === 'audio') {
                        urlPath = `/api/job-manuals/${manual.id}/get-audio/${fileName}`;
                    } else if (file.type === 'video') {
                        urlPath = `/api/job-manuals/${manual.id}/get-video/${fileName}`;
                    } else {
                        urlPath = `/api/job-manuals/${manual.id}/get-file/${fileName}`;
                    }

                    const url = `${baseUrl}${urlPath}`;

                    return {
                        id: file.id,
                        name: file.name,
                        original_name: file.original_name,
                        type: file.type,
                        extension: file.extension,
                        url
                    };
                });

                const visFilesMappedByVisId = new Map<number, any[]>();
                visualizacionesArray.forEach((v: any) => {
                    const arr = (v?.e_empleado_visualizacion_archivos || []) as any[];
                    const mapped = arr.map((file: any) => {
                        const fileName = file.name;
                        let urlPath = `/uploads/job-manuals/${manual.id}/visualizaciones/${v.id}/${fileName}`;
                        if (file.type === 'image') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-image/${fileName}`;
                        } else if (file.type === 'audio') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-audio/${fileName}`;
                        } else if (file.type === 'video') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-video/${fileName}`;
                        } else {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-file/${fileName}`;
                        }

                        const url = `${baseUrl}${urlPath}`;

                        return {
                            id: file.id,
                            name: file.name,
                            original_name: file.original_name,
                            type: file.type,
                            extension: file.extension,
                            url
                        };
                    });
                    visFilesMappedByVisId.set(v.id, mapped);
                });

                return {
                    id: manual.id,
                    title: manual.title,
                    description: manual.description,
                    quiz: manual.quiz ?? null,
                    firma: manual.firma,
                    // Para el cliente móvil, mostramos el puesto actual del colaborador
                    puesto: {
                        id: puesto.id,
                        nombre: puesto.nombre
                    },
                    created_by: manual.created_by,
                    created_at: manual.created_at,
                    files: filesMapped,
                    visualizaciones: visualizacionesArray.map((v: any) => ({
                        id: v.id,
                        empleado_id: v.empleado_id,
                        manual_puesto_id: v.manual_puesto_id,
                        nombre_empleado: v.nombre_empleado,
                        firma_empleado: v.firma_empleado,
                        quiz_answear: v.quiz_answear ?? null,
                        approved: v.approved ?? null,
                        created_at: v.created_at,
                        updated_at: v.updated_at,
                        files: visFilesMappedByVisId.get(v.id) ?? [],
                    })),
                    currentEmployeeSigned
                };
            })
        );

        return NextResponse.json(
            { status: true, manuals: manualsWithFiles },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/job-manuals:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            title,
            description,
            firma_responsable,
            puestos,
            files,
            quiz
        } = await req.json();

        if (!marca_id || !title || !description || !firma_responsable) {
            return NextResponse.json(
                { status: false, message: "Datos incompletos" },
                { status: 200 }
            );
        }

        // Quiz: almacenar como string (objeto con questions y minApprovalPercentage, o array para compatibilidad). Si viene vacío o inválido, guardar null.
        let quizToStore: string | null = null;
        if (typeof quiz === "string") {
            const trimmed = quiz.trim();
            if (trimmed.length > 0) {
                try {
                    const parsed = JSON.parse(trimmed);
                    // Nuevo formato: objeto con questions y minApprovalPercentage
                    if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                        quizToStore = trimmed;
                    }
                    // Formato antiguo: array de preguntas (compatibilidad)
                    else if (Array.isArray(parsed) && parsed.length > 0) {
                        quizToStore = trimmed;
                    } else {
                        quizToStore = null;
                    }
                } catch {
                    // Si no es JSON válido, no rompemos creación: guardamos null
                    quizToStore = null;
                }
            }
        }

        const marca = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: parseInt(marca_id) },
            },
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }
        const marcaObj = marca as any;

        const created_at = toZonedTime(
            new Date(),
            "America/Costa_Rica"
        ) as Date;

        const puestosParsedRaw: number[] = puestos
            ? JSON.parse(puestos)
            : [marcaObj.puesto_id];
        const puestosParsed = Array.from(
            new Set(
                (Array.isArray(puestosParsedRaw) ? puestosParsedRaw : [])
                    .map((id: any) => Number(id))
                    .filter((id: number) => Number.isFinite(id) && id > 0)
            )
        );

        let filesParsed: ManualFileInput[] = [];
        if (files) {
            try {
                filesParsed = JSON.parse(files) as ManualFileInput[];
            } catch (err) {
                console.error("Error parsing files JSON:", err);
                return NextResponse.json(
                    {
                        status: false,
                        message: "Formato de archivos inválido"
                    },
                    { status: 200 }
                );
            }
        }

        let plazasIds: number[] = [];

        // Crear un único manual y luego asociarlo a múltiples puestos mediante e_puestos_manual_puesto
        if (puestosParsed.length === 0) {
            return NextResponse.json(
                { status: false, message: "Debe especificarse al menos un puesto" },
                { status: 200 }
            );
        }

        // 1) Confirmar puestos existentes en BD (findMany con ids recibidos)
        const existingPuestos = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findMany",
                where: { id: { in: puestosParsed } },
                select: { id: true },
            },
        });
        const existingPuestosArray = Array.isArray(existingPuestos) ? existingPuestos : [];
        const confirmedPuestoIds = Array.from(
            new Set(
                existingPuestosArray
                    .map((p: any) => Number(p?.id))
                    .filter((id: number) => Number.isFinite(id) && id > 0)
            )
        );

        if (confirmedPuestoIds.length === 0) {
            return NextResponse.json(
                { status: false, message: "No se encontraron puestos válidos" },
                { status: 200 }
            );
        }
        const primaryPuestoId = confirmedPuestoIds[0];

        const manual = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_manual_puesto",
                operation: "create",
                data: {
                    title,
                    description,
                    quiz: quizToStore,
                    firma: firma_responsable,
                    // Se mantiene el campo puesto_id por compatibilidad, usando el primer puesto
                    puesto_id: primaryPuestoId,
                    created_by: String(payload?.id),
                    created_at: created_at.toISOString(),
                }
            }
        });
        const manualObj = manual as any;

        // 2) Crear relaciones en e_puestos_manual_puesto con una sola petición createMany
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_puestos_manual_puesto",
                operation: "createMany",
                many: true,
                data: confirmedPuestoIds.map((puesto_id: number) => ({
                    manual_puesto_id: manualObj.id,
                    puesto_id,
                })),
            }
        });

        // Guardar archivos una sola vez para el manual, delegando a /api/dynamic-prisma/files
        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `job-manuals/${manualObj.id}`,
                files: filesParsed.map((file) => ({
                    type: file.type,
                    extension: file.extension,
                    original_name: file.original_name,
                    file_base64: file.file_base64,
                })),
            });

            const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            for (const uploaded of uploadedFiles) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_archivos_manual_puesto",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            type: uploaded.type,
                            extension: uploaded.extension,
                            manual_puesto_id: manualObj.id
                        }
                    }
                });
            }
        }


        // 3) Buscar plazas de los puestos confirmados para notificación
        const plazas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_plazas",
                operation: "findMany",
                where: {
                    puesto_id: { in: confirmedPuestoIds }, deleted: null,
                    OR: [
                        { fecha_inactivacion: null },
                        { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                    ],
                }, // In: confirmedPuestoIds
            },
        });

        plazasIds = plazas.map((p: any) => p.id);

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];

        await sendNotificationByPlaza(req, marcaObj.id, "Manual creado", `Se ha creado el manual ${title} para tu puesto el día ${fecha_string} a las ${hora_string}`, plazasIds);

        return NextResponse.json(
            {
                status: true,
                message: "Manual creado con éxito",
                manualIds: [manualObj.id]
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/job-manuals:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


