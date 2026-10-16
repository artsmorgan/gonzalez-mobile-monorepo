import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByPlaza, sendNotificationByEmployee } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { reportError } from "../../../utils/reportError";

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
        const empleadoIdStr = req.nextUrl.searchParams.get("empleado_id");
        const hasPuestoParam = !!puestoIdStr && String(puestoIdStr).trim() !== "";
        const hasEmpleadoParam = !!empleadoIdStr && String(empleadoIdStr).trim() !== "";

        if (!hasPuestoParam && !hasEmpleadoParam) {
            await reportError(req, "api/job-manuals", "GET", 400, "Puesto o empleado no especificado");
            return NextResponse.json(
                { status: false, message: "Puesto o empleado no especificado" },
                { status: 400 }
            );
        }
        if (hasPuestoParam && hasEmpleadoParam) {
            await reportError(req, "api/job-manuals", "GET", 400, "Especifique solo puesto_id o solo empleado_id");
            return NextResponse.json(
                { status: false, message: "Especifique solo puesto_id o solo empleado_id" },
                { status: 400 }
            );
        }

        const employeeId = payload?.id as number;
        let puestoObj: any = null;
        const manualIdsSet = new Set<number>();

        if (hasPuestoParam) {
            const targetPuestoId = parseInt(String(puestoIdStr), 10);
            if (!Number.isFinite(targetPuestoId) || targetPuestoId <= 0) {
                await reportError(req, "api/job-manuals", "GET", 400, "puesto_id inválido");
                return NextResponse.json(
                    { status: false, message: "puesto_id inválido" },
                    { status: 400 }
                );
            }

            const puesto = await prisma.e_estructura_puesto.findUnique({
                where: { id: targetPuestoId },
            });
            if (!puesto) {
                await reportError(req, "api/job-manuals", "GET", 404, "Puesto no encontrado");
                return NextResponse.json(
                    { status: false, message: "Puesto no encontrado" },
                    { status: 404 }
                );
            }
            puestoObj = puesto as any;

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
                    where: { puesto_id: puestoObj.id, isActive: true },
                },
            });
            const directManualsArray = Array.isArray(directManuals) ? directManuals : [];
            directManualsArray.forEach((manual: any) => {
                if (manual.id) {
                    manualIdsSet.add(manual.id);
                }
            });
        } else {
            const targetEmpleadoId = parseInt(String(empleadoIdStr), 10);
            if (!Number.isFinite(targetEmpleadoId) || targetEmpleadoId <= 0) {
                await reportError(req, "api/job-manuals", "GET", 400, "empleado_id inválido");
                return NextResponse.json(
                    { status: false, message: "empleado_id inválido" },
                    { status: 400 }
                );
            }

            const empleado = await prisma.c_empleado.findUnique({ where: { id: targetEmpleadoId } });
            if (!empleado) {
                await reportError(req, "api/job-manuals", "GET", 404, "Empleado no encontrado");
                return NextResponse.json(
                    { status: false, message: "Empleado no encontrado" },
                    { status: 404 }
                );
            }

            const manualLinks = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_empleados_manual_puesto",
                    operation: "findMany",
                    where: { empleado_id: targetEmpleadoId },
                },
            });
            const manualLinksArray = Array.isArray(manualLinks) ? manualLinks : [];
            manualLinksArray.forEach((link: any) => {
                if (link.manual_puesto_id) {
                    manualIdsSet.add(link.manual_puesto_id);
                }
            });
        }

        const manualIds = Array.from(manualIdsSet);

        if (manualIds.length === 0) {
            return NextResponse.json(
                { status: true, manuals: [] },
                { status: 200 }
            );
        }

        // Vínculos a empleados de todos los manuales resultantes (para cachear en el cliente)
        const empleadosLinksAll = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_empleados_manual_puesto",
                operation: "findMany",
                where: { manual_puesto_id: { in: manualIds } },
            },
        });
        const empleadosVinculadosByManualId = new Map<number, number[]>();
        (Array.isArray(empleadosLinksAll) ? empleadosLinksAll : []).forEach((link: any) => {
            const mid = Number(link?.manual_puesto_id);
            const eid = Number(link?.empleado_id);
            if (!Number.isFinite(mid) || !Number.isFinite(eid)) return;
            const arr = empleadosVinculadosByManualId.get(mid) ?? [];
            arr.push(eid);
            empleadosVinculadosByManualId.set(mid, arr);
        });

        const manuals = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findMany",
                where: { id: { in: manualIds }, isActive: true },
                orderBy: { created_at: "desc" },
            },
        });
        const manualsArray = (Array.isArray(manuals) ? manuals : []).filter(
            (m: any) => m?.isActive !== false
        );

        // Usar el origin de la petición para construir URLs absolutas accesibles desde el móvil
        const baseUrl = req.nextUrl.origin;

        // En modo empleado no hay un "puesto de la consulta": se muestra el puesto propio de cada manual
        const ownPuestoIds = Array.from(
            new Set(
                manualsArray
                    .map((m: any) => Number(m?.puesto_id))
                    .filter((id: number) => Number.isFinite(id) && id > 0)
            )
        );
        const ownPuestosById = new Map<number, { id: number; nombre: string }>();
        if (!puestoObj && ownPuestoIds.length > 0) {
            const ownPuestos = await prisma.e_estructura_puesto.findMany({
                where: { id: { in: ownPuestoIds } },
                select: { id: true, nombre: true },
            });
            ownPuestos.forEach((p) => ownPuestosById.set(p.id, { id: p.id, nombre: p.nombre }));
        }

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
                const visualizacionesArray = (Array.isArray(visualizaciones) ? visualizaciones : []).filter(
                    (v: any) => v?.isActive !== false
                );
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
                    isActive: manual.isActive !== false,
                    empresa_id: manual.empresa_id ?? null,
                    cliente_id: manual.cliente_id ?? null,
                    corpo_id: manual.corpo_id ?? null,
                    division_id: manual.division_id ?? null,
                    contrato_id: manual.contrato_id ?? null,
                    // Para el cliente móvil: en modo puesto, el puesto de la consulta; en modo empleado, el puesto propio del manual
                    puesto: puestoObj
                        ? { id: puestoObj.id, nombre: puestoObj.nombre }
                        : ownPuestosById.get(Number(manual.puesto_id)) ?? { id: manual.puesto_id, nombre: "" },
                    empleados_vinculados_ids: empleadosVinculadosByManualId.get(Number(manual.id)) ?? [],
                    created_by: manual.created_by,
                    created_at: manual.created_at,
                    classification: manual.classification ?? null,
                    files: filesMapped,
                    visualizaciones: visualizacionesArray.map((v: any) => ({
                        id: v.id,
                        empleado_id: v.empleado_id,
                        manual_puesto_id: v.manual_puesto_id,
                        nombre_empleado: v.nombre_empleado,
                        firma_empleado: v.firma_empleado,
                        firma_empleado_manual: v.firma_empleado_manual ?? null,
                        quiz_answear: v.quiz_answear ?? null,
                        approved: v.approved ?? null,
                        created_at: v.created_at,
                        updated_at: v.updated_at,
                        isActive: v.isActive !== false,
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
        console.log('error: ', error);
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/job-manuals:", errorMessage);
        await reportError(req, "api/job-manuals", "GET", 500, errorMessage);
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
            empleados,
            files,
            quiz,
            classification,
            empresa_id: empresa_id_raw,
            cliente_id: cliente_id_raw,
            corpo_id: corpo_id_raw,
            division_id: division_id_raw,
            contrato_id: contrato_id_raw,
        } = await req.json();

        const parseOptInt = (v: unknown): number | null => {
            if (v === null || v === undefined || v === "") return null;
            const n = parseInt(String(v), 10);
            return Number.isFinite(n) && n > 0 ? n : null;
        };

        const empresa_id = parseOptInt(empresa_id_raw);
        const cliente_id = parseOptInt(cliente_id_raw);
        const corpo_id = parseOptInt(corpo_id_raw);
        const division_id = parseOptInt(division_id_raw);
        const contrato_id = parseOptInt(contrato_id_raw);

        if (!marca_id || !title || !description || !firma_responsable) {
            await reportError(req, "api/job-manuals", "POST", 400, "Datos incompletos");
            return NextResponse.json(
                { status: false, message: "Datos incompletos" },
                { status: 400 }
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

        const marca = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(marca_id) },
        });
        if (!marca) {
            await reportError(req, "api/job-manuals", "POST", 404, "Marca no encontrada");
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 404 }
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

        const empleadosParsedRaw: number[] = empleados ? JSON.parse(empleados) : [];
        const empleadosParsed = Array.from(
            new Set(
                (Array.isArray(empleadosParsedRaw) ? empleadosParsedRaw : [])
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
                await reportError(req, "api/job-manuals", "POST", 400, "Formato de archivos inválido");
                return NextResponse.json(
                    {
                        status: false,
                        message: "Formato de archivos inválido"
                    },
                    { status: 400 }
                );
            }
        }

        let plazasIds: number[] = [];

        // Crear un único manual y asociarlo a puestos y/o empleados específicos: se requiere al
        // menos uno de los dos (mediante e_puestos_manual_puesto / e_empleados_manual_puesto).
        if (puestosParsed.length === 0 && empleadosParsed.length === 0) {
            await reportError(req, "api/job-manuals", "POST", 400, "Debe especificarse al menos un puesto o un empleado");
            return NextResponse.json(
                { status: false, message: "Debe especificarse al menos un puesto o un empleado" },
                { status: 400 }
            );
        }

        // 1) Confirmar puestos existentes en BD (findMany con ids recibidos), si se especificaron
        let confirmedPuestoIds: number[] = [];
        if (puestosParsed.length > 0) {
            const existingPuestos = await prisma.e_estructura_puesto.findMany({
                where: { id: { in: puestosParsed } },
                select: { id: true },
            });
            const existingPuestosArray = Array.isArray(existingPuestos) ? existingPuestos : [];
            confirmedPuestoIds = Array.from(
                new Set(
                    existingPuestosArray
                        .map((p: any) => Number(p?.id))
                        .filter((id: number) => Number.isFinite(id) && id > 0)
                )
            );

            if (confirmedPuestoIds.length === 0) {
                await reportError(req, "api/job-manuals", "POST", 404, "No se encontraron puestos válidos");
                return NextResponse.json(
                    { status: false, message: "No se encontraron puestos válidos" },
                    { status: 404 }
                );
            }
        }
        // `puesto_id` es obligatorio en e_manual_puesto por compatibilidad; si no se vinculó
        // ningún puesto, se usa el puesto de la marca actual solo para completar la columna,
        // sin crear un vínculo real en e_puestos_manual_puesto.
        const primaryPuestoId = confirmedPuestoIds.length > 0 ? confirmedPuestoIds[0] : marcaObj.puesto_id;

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
                    classification: classification != null && String(classification).trim() !== "" ? String(classification).trim() : null,
                    firma: firma_responsable,
                    // Se mantiene el campo puesto_id por compatibilidad, usando el primer puesto
                    puesto_id: primaryPuestoId,
                    created_by: String(payload?.id),
                    created_at: created_at.toISOString(),
                    empresa_id,
                    cliente_id,
                    corpo_id,
                    division_id,
                    contrato_id,
                    isActive: true,
                }
            }
        });
        const manualObj = manual as any;

        // 2) Crear relaciones en e_puestos_manual_puesto con una sola petición createMany, si aplica
        if (confirmedPuestoIds.length > 0) {
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
        }

        // 2b) Vínculos opcionales a empleados específicos (e_empleados_manual_puesto)
        let confirmedEmpleadoIds: number[] = [];
        if (empleadosParsed.length > 0) {
            const existingEmpleados = await prisma.c_empleado.findMany({
                where: { id: { in: empleadosParsed } },
                select: { id: true },
            });
            confirmedEmpleadoIds = Array.from(
                new Set(
                    (Array.isArray(existingEmpleados) ? existingEmpleados : [])
                        .map((e: any) => Number(e?.id))
                        .filter((id: number) => Number.isFinite(id) && id > 0)
                )
            );
            if (confirmedEmpleadoIds.length > 0) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_empleados_manual_puesto",
                        operation: "createMany",
                        many: true,
                        data: confirmedEmpleadoIds.map((empleado_id: number) => ({
                            manual_puesto_id: manualObj.id,
                            empleado_id,
                        })),
                    }
                });
            }
        }

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
        const plazas = await prisma.e_estructura_plazas.findMany({
            where: {
                puesto_id: { in: confirmedPuestoIds },
                deleted: null,
                OR: [
                    { fecha_inactivacion: null },
                    { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                ],
            },
        });

        plazasIds = plazas.map((p: any) => p.id);

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];

        if (plazasIds.length > 0) {
            await sendNotificationByPlaza(req, marcaObj.id, "Manual creado", `Se ha creado el manual ${title} para tu puesto el día ${fecha_string} a las ${hora_string}`, plazasIds);
        }

        if (confirmedEmpleadoIds.length > 0) {
            try {
                await sendNotificationByEmployee(
                    req,
                    marcaObj.corpo_id,
                    [],
                    "Manual creado",
                    `Se te ha vinculado el manual ${title} el día ${fecha_string} a las ${hora_string}`,
                    confirmedEmpleadoIds
                );
            } catch (err) {
                console.warn("Fallo enviando notificación a empleados vinculados (no bloquea la creación):", err);
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Manual creado con éxito",
                id: manualObj.id,
                manualIds: [manualObj.id]
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/job-manuals:", errorMessage);
        await reportError(req, "api/job-manuals", "POST", 500, errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


