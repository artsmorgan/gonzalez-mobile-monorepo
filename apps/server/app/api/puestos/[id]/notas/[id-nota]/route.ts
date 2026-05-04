import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { sendNotificationByPlaza } from "../../../../../../utils/sendNotification";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { uploadDynamicFiles } from "../../../../../../utils/callDynamicFilesApi";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const nota = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findUnique",
                where: { id: id_nota }
            }
        });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        return NextResponse.json({ status: true, nota }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const {
            marca_id,
            titulo,
            description,
            categoria_id,
            relevancia,
            empleado_id,
            empresa_id,
            cliente_id,
            division_id,
            contrato_id,
            corpo_id,
            firma_responsable,
            firma_manual_responsable,
            imagenes
        } = await req.json();

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const empleado = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id: empleado_id }
            }
        });
        if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });

        const categoriaData = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_novedades_categoria",
                operation: "findUnique",
                where: { id: categoria_id }
            }
        });
        if (!categoriaData) return NextResponse.json({ status: false, message: "Categoría no encontrada" }, { status: 200 });

        const nota = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findUnique",
                where: { id: id_nota }
            }
        });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        const previous_titulo = nota.titulo;
        const previous_description = nota.description;
        const previous_categoria = categoriaData.nombre;

        const updated_at = toZonedTime(new Date(), "America/Costa_Rica");

        // Si relevancia no viene o es null, usar "Baja" por defecto
        const relevanciaValue = relevancia || 'Baja';

        const updatedNota = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_puesto_notas",
                where: { id: id_nota },
                data: {
                    titulo,
                    description,
                    categoria_id: categoria_id,
                    relevancia: relevanciaValue,
                    empresa_id: empresa_id ?? nota.empresa_id ?? null,
                    cliente_id: cliente_id ?? nota.cliente_id ?? null,
                    division_id: division_id ?? nota.division_id ?? null,
                    contrato_id: contrato_id ?? nota.contrato_id ?? null,
                    corpo_id: corpo_id ?? nota.corpo_id ?? null,
                    puesto_id: puesto.id,
                    firma_responsable: (firma_responsable && String(firma_responsable).trim().length > 0) ? String(firma_responsable) : nota.firma_responsable,
                    firma_manual_responsable: (firma_manual_responsable && String(firma_manual_responsable).trim().length > 0) ? String(firma_manual_responsable) : null,
                    is_modified: true,
                    updated_at: updated_at.toISOString()
                }
            }
        });

        let imagesParsed: Array<{ file_base64: string; extension?: string; original_name?: string }> = [];
        if (imagenes) {
            try {
                imagesParsed = typeof imagenes === "string" ? JSON.parse(imagenes) : imagenes;
            } catch {
                imagesParsed = [];
            }
        }
        if (Array.isArray(imagesParsed) && imagesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `puesto-notas/${id_nota}`,
                files: imagesParsed
                    .filter((img) => img?.file_base64)
                    .map((img) => ({
                        type: "image",
                        extension: String(img.extension || "jpg").replace(".", "").trim() || "jpg",
                        original_name: img.original_name,
                        file_base64: img.file_base64,
                    })),
            });
            const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            for (const uploaded of uploadedFiles) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "c_imagenes_puesto_notas",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            nota_id: id_nota,
                        },
                    },
                });
            }
        }

        if (updatedNota) {
            const all_plazas_puesto = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_plazas",
                    operation: "findMany",
                    where: { puesto_id: puesto.id }
                }
            });
            if (all_plazas_puesto.length > 0) {
                await sendNotificationByPlaza(req, marca_id, "Bitácora actualizada", `${empleado.nombre} ${empleado.primer_apellido} ha actualizado la nota ${previous_titulo} de tipo ${previous_categoria}`, all_plazas_puesto.map((plaza: { id: number }) => plaza.id));
            }
        }

        // Registro de cambios (nueva modalidad)
        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        if (nota.titulo !== titulo) cambiosArr.push({ prop: "titulo", before: nota.titulo, after: titulo });
        if (nota.description !== description) cambiosArr.push({ prop: "description", before: nota.description, after: description });
        if ((nota.categoria_id ?? null) !== (categoria_id ?? null)) cambiosArr.push({ prop: "categoria_id", before: nota.categoria_id ?? null, after: categoria_id ?? null });
        if ((nota.relevancia ?? null) !== (relevanciaValue ?? null)) cambiosArr.push({ prop: "relevancia", before: nota.relevancia ?? null, after: relevanciaValue ?? null });
        if ((nota.firma_responsable ?? null) !== ((firma_responsable && String(firma_responsable).trim().length > 0) ? String(firma_responsable) : (nota.firma_responsable ?? null))) {
            cambiosArr.push({ prop: "firma_responsable", before: nota.firma_responsable ?? null, after: (firma_responsable && String(firma_responsable).trim().length > 0) ? String(firma_responsable) : nota.firma_responsable ?? null });
        }
        const nextFirmaManual = (firma_manual_responsable && String(firma_manual_responsable).trim().length > 0) ? String(firma_manual_responsable) : null;
        if ((nota.firma_manual_responsable ?? null) !== nextFirmaManual) {
            cambiosArr.push({ prop: "firma_manual_responsable", before: nota.firma_manual_responsable ?? null, after: nextFirmaManual });
        }
        if (!nota.is_modified) cambiosArr.push({ prop: "is_modified", before: false, after: true });

        if (cambiosArr.length > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "c_puesto_notas",
                        registro_id: id_nota,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: updated_at.toISOString(),
                        created_by: empleado.id,
                    },
                    returning: false
                },
            });
        }

        return NextResponse.json({ status: true, message: "Nota actualizada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const nota = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findUnique",
                where: { id: id_nota }
            }
        });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_puesto_notas",
                where: { id: id_nota },
                data: { isActive: false, updated_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString() },
                returning: false
            }
        });

        // Registro de cambios (nueva modalidad) - delete (solo datos escritos)
        const beforeLimited = {
            id: nota.id,
            titulo: nota.titulo,
            description: nota.description,
            categoria_id: nota.categoria_id ?? null,
            relevancia: nota.relevancia ?? null,
            puesto_id: nota.puesto_id,
        };
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "c_puesto_notas",
                    registro_id: id_nota,
                    cambios: JSON.stringify([{ prop: "__deleted__", before: beforeLimited, after: null }]),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                    created_by: createdBy,
                },
                returning: false
            },
        });
        return NextResponse.json({ status: true, message: "Nota eliminada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}   