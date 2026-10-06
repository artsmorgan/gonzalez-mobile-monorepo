import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../utils/reportError";

type ManualFileInput = {
    type: string;
    extension: string;
    file_base64: string;
};

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            await reportError(req, "api/job-manuals/[id]", "PUT", 400, "Manual no especificado");
            return NextResponse.json(
                { status: false, message: "Manual no especificado" },
                { status: 400 }
            );
        }

        const manual = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!manual) {
            await reportError(req, "api/job-manuals/[id]", "PUT", 404, "Manual no encontrado");
            return NextResponse.json(
                { status: false, message: "Manual no encontrado" },
                { status: 404 }
            );
        }
        const manualObj = manual as any;

        const {
            title,
            description,
            firma_responsable,
            filesToDelete,
            newFiles
        } = await req.json();

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_manual_puesto",
                operation: "update",
                where: { id },
                data: {
                    title: title ?? manualObj.title,
                    description: description ?? manualObj.description,
                    firma: firma_responsable ?? manualObj.firma
                }
            }
        });

        if (Array.isArray(filesToDelete) && filesToDelete.length > 0) {
            const files = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_archivos_manual_puesto",
                    operation: "findMany",
                    where: { id: { in: filesToDelete }, manual_puesto_id: id },
                },
            });
            const filesArray = Array.isArray(files) ? files : [];

            const dir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${id}`
            );

            for (const file of filesArray) {
                const fileObj = file as any;
                const filePath = path.join(dir, fileObj.name);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "e_archivos_manual_puesto",
                    operation: "deleteMany",
                    where: { id: { in: filesToDelete }, manual_puesto_id: id },
                },
            });
        }

        if (newFiles) {
            let filesParsed: ManualFileInput[] = [];
            try {
                filesParsed = JSON.parse(newFiles) as ManualFileInput[];
            } catch (err) {
                console.error("Error parsing newFiles JSON:", err);
                await reportError(req, "api/job-manuals/[id]", "PUT", 400, "Formato de archivos inválido");
                return NextResponse.json(
                    {
                        status: false,
                        message: "Formato de archivos inválido"
                    },
                    { status: 400 }
                );
            }

            if (filesParsed.length > 0) {
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `job-manuals/${id}`,
                    files: filesParsed.map((file) => ({
                        type: file.type,
                        extension: file.extension,
                        file_base64: file.file_base64,
                    })),
                    shouldVerifyAccessToken: true,
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
                                type: uploaded.type,
                                original_name: uploaded.original_name || uploaded.name,
                                extension: uploaded.extension,
                                manual_puesto_id: id
                            }
                        }
                    });
                }
            }
        }

        return NextResponse.json(
            { status: true, message: "Manual actualizado con éxito" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/job-manuals/[id]:", errorMessage);
        await reportError(req, "api/job-manuals/[id]", "PUT", 500, errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            await reportError(req, "api/job-manuals/[id]", "DELETE", 400, "Manual no especificado");
            return NextResponse.json(
                { status: false, message: "Manual no especificado" },
                { status: 400 }
            );
        }

        const manual = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!manual) {
            await reportError(req, "api/job-manuals/[id]", "DELETE", 404, "Manual no encontrado");
            return NextResponse.json(
                { status: false, message: "Manual no encontrado" },
                { status: 404 }
            );
        }

        const manualObj = manual as any;
        // Solo el creador puede eliminar
        const requesterId = String(payload?.id ?? "");
        if (String(manualObj.created_by ?? "") !== requesterId) {
            await reportError(req, "api/job-manuals/[id]", "DELETE", 403, "No tienes permiso para eliminar este manual");
            return NextResponse.json(
                { status: false, message: "No tienes permiso para eliminar este manual" },
                { status: 403 }
            );
        }

        // Baja lógica: no se eliminan filas ni archivos en disco (compatibilidad con listados e historial)
        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_manual_puesto",
                operation: "update",
                where: { id },
                data: { isActive: false },
            },
        });

        return NextResponse.json(
            { status: true, message: "Manual eliminado con éxito" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/job-manuals/[id]:", errorMessage);
        await reportError(req, "api/job-manuals/[id]", "DELETE", 500, errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


