import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { prisma } from "../../../../../../utils/prismaClient";
import { reportError } from "../../../../../../utils/reportError";
import { auditUpdateFields } from "../../../../../../utils/auditFields";
import { isSuperAdminEmpleado } from "../../../../../../utils/isSuperAdminEmpleado";
import { autorizarGestionManual, cuerpoDenegado } from "../../../../../../utils/documentos/permisosEdicion";
import { rolDeMarca } from "../../../../../../utils/documentos/rolDeMarca";

const ENDPOINT = "api/job-manuals/[id]/files/[fileId]";

/**
 * Borra AL INSTANTE un archivo de un documento (sin esperar a «Aceptar» en el formulario de edición): quita su fila y su archivo del almacén. Solo con conexión
 * y solo para roles distintos de OPERATIVO (se comprueba aquí). `marca_id` va en la consulta (`?marca_id=`) porque un DELETE no lleva cuerpo de forma fiable.
 * Borrar un archivo no cambia la versión del documento ni obliga a firmar de nuevo.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; fileId: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

        const params = await context.params;
        const manualId = Number(params.id);
        const fileId = Number(params.fileId);
        const marcaId = Number(new URL(req.url).searchParams.get("marca_id"));
        if (!Number.isInteger(manualId) || manualId <= 0 || !Number.isInteger(fileId) || fileId <= 0) {
            await reportError(req, ENDPOINT, "DELETE", 400, "Identificadores inválidos");
            return NextResponse.json({ status: false, code: "invalid_request", message: "Identificadores inválidos" }, { status: 400 });
        }
        if (!Number.isInteger(marcaId) || marcaId <= 0) {
            await reportError(req, ENDPOINT, "DELETE", 400, "Marca inválida");
            return NextResponse.json({ status: false, code: "invalid_request", message: "Marca inválida" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marcaId } });
        const decision = await autorizarGestionManual({
            callerId: payload?.id,
            marca,
            roleNameOfMarca: (m) => rolDeMarca(req, m),
            isAdmin: () => isSuperAdminEmpleado(req, Number(payload?.id)),
        });
        if (!decision.allowed) {
            await reportError(req, ENDPOINT, "DELETE", decision.status, decision.message);
            return NextResponse.json(cuerpoDenegado(decision), { status: decision.status });
        }

        const manual: any = await callDynamicPrisma({ req, data: { action: "GET", table: "e_manual_puesto", operation: "findUnique", where: { id: manualId } } });
        if (!manual || manual.isActive === false) {
            await reportError(req, ENDPOINT, "DELETE", 404, "Documento no encontrado");
            return NextResponse.json({ status: false, code: "not_found", message: "Documento no encontrado" }, { status: 404 });
        }
        // El archivo tiene que ser de ESTE documento: un id suelto no alcanza archivos de otros.
        const archivo: any = await callDynamicPrisma({ req, data: { action: "GET", table: "e_archivos_manual_puesto", operation: "findFirst", where: { id: fileId, manual_puesto_id: manualId } } });
        if (!archivo) {
            await reportError(req, ENDPOINT, "DELETE", 404, "Archivo no encontrado");
            return NextResponse.json({ status: false, code: "not_found", message: "Archivo no encontrado" }, { status: 404 });
        }

        // Primero la fila (el documento deja de mostrarlo de inmediato); después el archivo del almacén, que si falla no deshace el borrado.
        await callDynamicPrisma({ req, data: { action: "DELETE", table: "e_archivos_manual_puesto", operation: "deleteMany", where: { id: fileId, manual_puesto_id: manualId } } });
        const name = String(archivo.name ?? "").trim();
        let almacenLimpio = true;
        if (name) {
            try {
                await deleteDynamicFile({ req, url: `job-manuals/${manualId}/${name}` });
            } catch (e) {
                // El documento ya no muestra el archivo, pero quedó en el almacenamiento: se deja constancia para limpiarlo.
                almacenLimpio = false;
                console.error("deleteDynamicFile job-manuals (continuando):", e);
                await reportError(req, ENDPOINT, "DELETE", 502, `El archivo «${name}» se quitó del documento pero no se pudo borrar del almacenamiento: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        const ahoraIso = (toZonedTime(new Date(), "America/Costa_Rica") as Date).toISOString();
        try {
            await callDynamicPrisma({ req, data: { action: "UPDATE", table: "e_manual_puesto", operation: "update", where: { id: manualId }, data: { ...auditUpdateFields(payload) } } });
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: { nombre_tabla: "e_manual_puesto", registro_id: manualId, cambios: JSON.stringify([{ prop: "archivo_eliminado", before: String(archivo.original_name || archivo.name || `#${fileId}`), after: null }]), created_at: ahoraIso, created_by: Number(payload?.id ?? 0) },
                },
            });
        } catch (e) {
            await reportError(req, ENDPOINT, "DELETE", 500, `No se pudo registrar el borrado en la bitácora: ${e instanceof Error ? e.message : String(e)}`);
        }

        return NextResponse.json({ status: true, message: "Archivo eliminado", data: { id: fileId }, almacen_limpio: almacenLimpio }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in DELETE /${ENDPOINT}:`, errorMessage);
        await reportError(req, ENDPOINT, "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
