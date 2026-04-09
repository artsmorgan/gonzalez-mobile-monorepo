import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";

export async function GET(req: NextRequest, _context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const puestoIdParam = req.nextUrl.searchParams.get("puesto_id");
        const puestoIdToUse = puestoIdParam ? parseInt(String(puestoIdParam), 10) : NaN;

        if (!Number.isFinite(puestoIdToUse) || puestoIdToUse <= 0) {
            return NextResponse.json(
                { status: false, message: "puesto_id es requerido y debe ser válido" },
                { status: 200 }
            );
        }

        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id: puestoIdToUse }
            }
        });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const notas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findMany",
                where: { puesto_id: puesto.id },
                orderBy: { updated_at: "desc" }
            }
        });
        const baseUrl = req.nextUrl.origin;
        const notas_return: {
            id: number,
            titulo: string,
            description: string,
            categoria_id: number | null,
            relevancia: string | null,
            puesto_id: number,
            empleado: string,
            creador: string,
            is_modified: boolean,
            firma_responsable: string,
            firma_manual_responsable: string | null,
            images: Array<{ id: number; name: string; url: string }>,
            created_at: Date,
            updated_at: Date,
            id_local: string
        }[] = [];

        for (const nota of notas) {

            let empleado_name = "-";
            let creador_name = "-";

            const lastChange = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_cambios_apps_modules",
                    operation: "findFirst",
                    where: { nombre_tabla: "c_puesto_notas", registro_id: nota.id },
                    orderBy: { id: "desc" }
                }
            });

            const firstChange = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_cambios_apps_modules",
                    operation: "findFirst",
                    where: { nombre_tabla: "c_puesto_notas", registro_id: nota.id },
                    orderBy: { id: "asc" }
                }
            });


            if (lastChange) {
                const empleado = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: lastChange.created_by }
                    }
                });
                if (empleado) {
                    empleado_name = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }
            }
            if (firstChange) {
                const empleadoCreador = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: firstChange.created_by }
                    }
                });
                if (empleadoCreador) {
                    creador_name = empleadoCreador.nombre + " " + empleadoCreador.primer_apellido + " " + empleadoCreador.segundo_apellido;
                }
            }

            const notaImages = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_imagenes_puesto_notas",
                    operation: "findMany",
                    where: { nota_id: nota.id }
                }
            });

            notas_return.push({
                id: nota.id,
                titulo: nota.titulo,
                description: nota.description,
                categoria_id: nota.categoria_id ?? null,
                relevancia: nota.relevancia ?? null,
                empleado: empleado_name,
                creador: creador_name,
                is_modified: Boolean(nota.is_modified),
                firma_responsable: nota.firma_responsable || "",
                firma_manual_responsable: nota.firma_manual_responsable || null,
                images: (Array.isArray(notaImages) ? notaImages : []).map((img: any) => ({
                    id: Number(img.id),
                    name: String(img.name || ""),
                    url: baseUrl ? `${baseUrl}/api/puestos/${nota.puesto_id}/notas/${nota.id}/get-image/${encodeURIComponent(String(img.name || ""))}` : "",
                })),
                puesto_id: nota.puesto_id,
                created_at: nota.created_at,
                updated_at: nota.updated_at,
                id_local: "",
            });
        }
        return NextResponse.json({ status: true, notas: notas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest, _context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            empleado_id,
            titulo,
            description,
            categoria_id,
            relevancia,
            puestos,
            firma_responsable,
            firma_manual_responsable,
            imagenes
        } = await req.json();

        const created_at = toZonedTime(new Date(), "America/Costa_Rica");
        const updated_at = toZonedTime(new Date(), "America/Costa_Rica");

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

        if (!firma_responsable || String(firma_responsable).trim().length === 0) {
            return NextResponse.json({ status: false, message: "Firma responsable requerida" }, { status: 200 });
        }

        const puestos_parse: number[] = JSON.parse(puestos);

        // Si relevancia no viene o es null, usar "Baja" por defecto
        const relevanciaValue = relevancia || 'Baja';

        for (const puesto_id of puestos_parse) {
            const puesto = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_puesto",
                    operation: "findUnique",
                    where: { id: puesto_id }
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

            const newNote = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_puesto_notas",
                    data: {
                        titulo,
                        description,
                        categoria_id: categoria_id,
                        relevancia: relevanciaValue,
                        puesto_id,
                        firma_responsable: String(firma_responsable),
                        firma_manual_responsable: (firma_manual_responsable && String(firma_manual_responsable).trim().length > 0) ? String(firma_manual_responsable) : null,
                        is_modified: false,
                        created_at: created_at.toISOString(),
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
                    folderPath: `puesto-notas/${newNote.id}`,
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
                                nota_id: newNote.id,
                            },
                        },
                    });
                }
            }

            // Registro de cambios (nueva modalidad) - create
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "c_puesto_notas",
                        registro_id: newNote.id,
                        cambios: JSON.stringify([
                            { prop: "__created__", before: null, after: true },
                            { prop: "titulo", before: null, after: titulo },
                            { prop: "description", before: null, after: description },
                            { prop: "categoria_id", before: null, after: categoria_id ?? null },
                            { prop: "relevancia", before: null, after: relevanciaValue ?? null },
                            { prop: "puesto_id", before: null, after: puesto_id },
                            { prop: "firma_responsable", before: null, after: String(firma_responsable) },
                            { prop: "firma_manual_responsable", before: null, after: (firma_manual_responsable && String(firma_manual_responsable).trim().length > 0) ? String(firma_manual_responsable) : null },
                            { prop: "is_modified", before: null, after: false },
                        ]),
                        created_at: created_at.toISOString(),
                        created_by: empleado_id,
                    },
                    returning: false
                },
            });

            const plazaIds = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_plazas",
                    operation: "findMany",
                    where: { puesto_id: puesto.id }
                }
            });
            await sendNotificationByPlaza(req, marca_id, "Bitácora creada", `${empleado.nombre} ${empleado.primer_apellido} ha creado una nota llamada ${newNote.titulo} de tipo ${categoriaData.nombre}`, plazaIds.map((plaza: { id: number }) => plaza.id));

        }
        return NextResponse.json({ status: true, message: "Nota creada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
} 