import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../utils/reportError";

export const runtime = "nodejs";

const OPENING_CLOSING_FULL_INCLUDE = {
    c_imagenes_apertura_cierre_puesto: true,
    e_estructura_cliente: { select: { nombre: true } },
    e_estructura_sucursal: { select: { nombre: true } },
    e_estructura_puesto: { select: { nombre: true } },
    n_division: { select: { nombre: true } },
};

type OpeningClosingImageInput = {
    file_base64: string;
    extension?: string; // jpg | png | etc
    original_name?: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
    try {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) return fallback;
            return JSON.parse(trimmed) as T;
        }
        if (value === null || value === undefined) return fallback;
        return value as T;
    } catch {
        return fallback;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            cliente_id,
            corpo_id,
            puesto_id,
            division_id,
            empresa_id,
            contrato_id,
            fecha,
            tipo,
            nombre_representante_cliente,
            nombre_representante_empresa_entrante,
            nombre_representante_empresa_saliente,
            actividades,
            inventario,
            otras_observaciones,
            firma_representante_cliente,
            firma_representante_empresa_entrante,
            firma_representante_empresa_saliente,
            firma_responsable,
            imagenes,
        } = await req.json();

        if (!marca_id) {
            await reportError(req, "api/opening-closing-position", "POST", 400, "Marca no especificada");
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(String(marca_id), 10) },
        });
        if (!marcaDia) {
            await reportError(req, "api/opening-closing-position", "POST", 404, "Marca no encontrada");
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }
        const marcaDiaObj = marcaDia as any;

        // Validaciones mínimas (campos NOT NULL en prisma).
        // Las firmas de representantes son opcionales, por lo que no se incluyen aquí.
        const required: Array<[string, any]> = [
            ["cliente_id", cliente_id],
            ["corpo_id", corpo_id],
            ["puesto_id", puesto_id],
            ["division_id", division_id],
            ["fecha", fecha],
            ["tipo", tipo],
            ["nombre_representante_cliente", nombre_representante_cliente],
            ["nombre_representante_empresa_entrante", nombre_representante_empresa_entrante],
            ["nombre_representante_empresa_saliente", nombre_representante_empresa_saliente],
            ["actividades", actividades],
            ["inventario", inventario],
            ["firma_responsable", firma_responsable],
        ];
        for (const [k, v] of required) {
            if (v === undefined || v === null || String(v).trim().length === 0) {
                await reportError(req, "api/opening-closing-position", "POST", 400, `El campo ${k} es requerido`);
                return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
            }
        }

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdByNum = payload?.id ? parseInt(String(payload.id), 10) : 0;
        const fechaDate = new Date(String(fecha));

        const newRecord = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_apertura_cierre_puesto",
                operation: "create",
                data: {
                    cliente_id: parseInt(String(cliente_id), 10),
                    corpo_id: parseInt(String(corpo_id), 10),
                    puesto_id: parseInt(String(puesto_id), 10),
                    division_id: parseInt(String(division_id), 10),
                    empresa_id: empresa_id != null ? parseInt(String(empresa_id), 10) : 0,
                    contrato_id: contrato_id != null ? parseInt(String(contrato_id), 10) : 0,
                    isActive: true,
                    fecha: fechaDate.toISOString(),
                    tipo: String(tipo),
                    nombre_representante_cliente: String(nombre_representante_cliente),
                    nombre_representante_empresa_entrante: String(nombre_representante_empresa_entrante),
                    nombre_representante_empresa_saliente: String(nombre_representante_empresa_saliente),
                    actividades: String(actividades ?? "[]"),
                    inventario: String(inventario ?? "[]"),
                    otras_observaciones: otras_observaciones ? String(otras_observaciones) : null,
                    firma_representante_cliente:
                        firma_representante_cliente != null && String(firma_representante_cliente).trim().length > 0
                            ? String(firma_representante_cliente)
                            : null,
                    firma_representante_empresa_entrante:
                        firma_representante_empresa_entrante != null && String(firma_representante_empresa_entrante).trim().length > 0
                            ? String(firma_representante_empresa_entrante)
                            : null,
                    firma_representante_empresa_saliente:
                        firma_representante_empresa_saliente != null && String(firma_representante_empresa_saliente).trim().length > 0
                            ? String(firma_representante_empresa_saliente)
                            : null,
                    firma_responsable: String(firma_responsable),
                    created_at: createdAt.toISOString(),
                    created_by: createdByNum,
                },
                include: { c_imagenes_apertura_cierre_puesto: true },
            },
        });
        const newRecordObj = newRecord as any;

        // Registrar cambio de creación
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_apertura_cierre_puesto",
                    registro_id: newRecordObj.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: newRecordObj.id,
                            cliente_id: newRecordObj.cliente_id,
                            corpo_id: newRecordObj.corpo_id,
                            puesto_id: newRecordObj.puesto_id,
                            division_id: newRecordObj.division_id,
                            empresa_id: newRecordObj.empresa_id,
                            contrato_id: newRecordObj.contrato_id,
                            fecha: fechaDate.toISOString(),
                            tipo: newRecordObj.tipo,
                            nombre_representante_cliente: newRecordObj.nombre_representante_cliente,
                            nombre_representante_empresa_entrante: newRecordObj.nombre_representante_empresa_entrante,
                            nombre_representante_empresa_saliente: newRecordObj.nombre_representante_empresa_saliente,
                            actividades: newRecordObj.actividades,
                            inventario: newRecordObj.inventario,
                            otras_observaciones: newRecordObj.otras_observaciones,
                            firma_representante_cliente: newRecordObj.firma_representante_cliente,
                            firma_representante_empresa_entrante: newRecordObj.firma_representante_empresa_entrante,
                            firma_representante_empresa_saliente: newRecordObj.firma_representante_empresa_saliente,
                            firma_responsable: newRecordObj.firma_responsable,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdByNum,
                },
            },
        });

        if (newRecordObj) {
            let empNombre = "Desconocido";
            let sucursalNombre = "Desconocida";
            let clienteNombre = "Desconocido";
            let fechaRegistro = fechaDate.toISOString().split("T")[0];
            if (newRecordObj.created_by) {
                const empleado = await prisma.c_empleado.findUnique({
                    where: { id: parseInt(String(newRecordObj.created_by), 10) },
                });
                if (empleado) {
                    empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }

            }
            if (newRecordObj.corpo_id) {
                const sucursal = await prisma.e_estructura_sucursal.findUnique({
                    where: { id: newRecordObj.corpo_id },
                });
                if (sucursal) {
                    sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
                }
            }
            if (newRecordObj.cliente_id) {
                const cliente = await prisma.e_estructura_cliente.findUnique({
                    where: { id: newRecordObj.cliente_id },
                });
                if (cliente) {
                    clienteNombre = cliente.nombre;
                }
            }
            const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de apertura-cierre de puesto de tipo " + newRecordObj.tipo + " en la sucursal " + sucursalNombre + " para el cliente " + clienteNombre + " el día " + fechaRegistro;
            await sendNotificationByRole(req, newRecordObj.corpo_id, [createdByNum], "Apertura-Cierre de Puesto creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        // Guardar imágenes (si vienen)
        let imagesParsed: OpeningClosingImageInput[] = [];
        if (imagenes) imagesParsed = safeParseJson<OpeningClosingImageInput[]>(imagenes, []);

        if (imagesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `opening-closing-position/${newRecordObj.id}`,
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
                        table: "c_imagenes_apertura_cierre_puesto",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            apetura_cierre_id: newRecordObj.id,
                        },
                    },
                });
            }
        }

        const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(OPENING_CLOSING_FULL_INCLUDE);

        const fullRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_apertura_cierre_puesto",
                operation: "findUnique",
                where: { id: newRecordObj.id },
                ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
            },
        });
        await hydratePreexistentRelations(fullRecord, preexistentSpecs);

        const baseUrl = req.nextUrl.origin;
        const recordToSend: any = fullRecord ?? newRecordObj;

        let empresaNombre: string | null = null;
        let contratoNombre: string | null = null;
        const empId = Number((recordToSend as any)?.empresa_id);
        const conId = Number((recordToSend as any)?.contrato_id);
        if (Number.isFinite(empId) && empId > 0) {
            try {
                const emp = await prisma.e_estructura_empresa.findUnique({ where: { id: empId } });
                empresaNombre = emp && typeof emp.nombre === "string" ? String(emp.nombre) : null;
            } catch {
                empresaNombre = null;
            }
        }
        if (Number.isFinite(conId) && conId > 0) {
            try {
                const con = await prisma.e_estructura_contrato.findUnique({ where: { id: conId } });
                contratoNombre = con && typeof con.nombre === "string" ? String(con.nombre) : null;
            } catch {
                contratoNombre = null;
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Apertura-Cierre de Puesto creado correctamente",
                data: {
                    ...recordToSend,
                    id_local: "",
                    empresa_nombre: empresaNombre,
                    cliente_nombre: recordToSend?.e_estructura_cliente?.nombre || null,
                    contrato_nombre: contratoNombre,
                    corpo_nombre: recordToSend?.e_estructura_sucursal?.nombre || null,
                    puesto_nombre: recordToSend?.e_estructura_puesto?.nombre || null,
                    division_nombre: recordToSend?.n_division?.nombre || null,
                    images: (recordToSend?.c_imagenes_apertura_cierre_puesto || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        original_name: f.original_name,
                        url: baseUrl ? `${baseUrl}/api/opening-closing-position/${recordToSend.id}/get-image/${f.name}` : "",
                    })),
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/opening-closing-position", "POST", 400, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

