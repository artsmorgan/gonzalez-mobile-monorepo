import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles, deleteDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { prisma } from "../../../../../utils/prismaClient";
import { reportError } from "../../../../../utils/reportError";
import { auditUpdateFields } from "../../../../../utils/auditFields";
import { isSuperAdminEmpleado } from "../../../../../utils/isSuperAdminEmpleado";
import { fetchActivePlazaIdsForPuestos, sendNotificationByEmployee, sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { dynDesdeRequest } from "../../../../../utils/documentos/dyn";
import { aplicarEdicionManual, destinatariosDelDocumento, EdicionError, mensajeNuevaVersion, MENSAJE_QUIZ_REQUIERE_VERSION, quizCambio, validarEdicion } from "../../../../../utils/documentos/edicion";
import { autorizarGestionManual, cuerpoDenegado } from "../../../../../utils/documentos/permisosEdicion";
import { rolDeMarca } from "../../../../../utils/documentos/rolDeMarca";

const ENDPOINT = "api/job-manuals/[id]/edit";

/**
 * Edita un documento ya subido (solo con conexión, sin cola ni sincronización): título, descripción, clasificación, quiz y archivos nuevos. Los archivos se
 * borran aparte y al instante (`DELETE …/files/{fileId}`). `nueva_version: true` publica una versión nueva (todos los usuarios vinculados deben volver a ver y
 * firmar el documento y reciben una notificación); modificar el quiz EXIGE nueva versión. Solo para roles distintos de OPERATIVO (se comprueba aquí).
 * Reglas completas en `utils/documentos/edicion.ts`.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const subidosParaLimpiar: string[] = [];
    let manualId = 0;
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

        manualId = Number((await context.params).id);
        if (!Number.isInteger(manualId) || manualId <= 0) {
            await reportError(req, ENDPOINT, "PUT", 400, "Documento inválido");
            return NextResponse.json({ status: false, code: "invalid_request", message: "Documento inválido" }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const validacion = validarEdicion(body);
        if (!validacion.ok) {
            await reportError(req, ENDPOINT, "PUT", 400, validacion.message);
            return NextResponse.json({ status: false, code: validacion.code, message: validacion.message }, { status: validacion.status });
        }
        const edicion = validacion.edicion;

        // Permiso: la marca es suya y su rol no es OPERATIVO (o es administrador). Antes de leer o escribir nada del documento.
        const marca = await prisma.c_marca_dia.findUnique({ where: { id: edicion.marcaId } });
        const decision = await autorizarGestionManual({
            callerId: payload?.id,
            marca,
            roleNameOfMarca: (m) => rolDeMarca(req, m),
            isAdmin: () => isSuperAdminEmpleado(req, Number(payload?.id)),
        });
        if (!decision.allowed) {
            await reportError(req, ENDPOINT, "PUT", decision.status, decision.message);
            return NextResponse.json(cuerpoDenegado(decision), { status: decision.status });
        }

        const manual: any = await callDynamicPrisma({ req, data: { action: "GET", table: "e_manual_puesto", operation: "findUnique", where: { id: manualId } } });
        if (!manual || manual.isActive === false) {
            await reportError(req, ENDPOINT, "PUT", 404, "Documento no encontrado");
            return NextResponse.json({ status: false, code: "not_found", message: "Documento no encontrado" }, { status: 404 });
        }

        // Antes de subir nada: modificar el quiz exige nueva versión.
        if (edicion.quiz !== undefined && quizCambio(manual.quiz, edicion.quiz) && !edicion.nuevaVersion) {
            await reportError(req, ENDPOINT, "PUT", 400, MENSAJE_QUIZ_REQUIERE_VERSION);
            return NextResponse.json({ status: false, code: "quiz_requires_new_version", message: MENSAJE_QUIZ_REQUIERE_VERSION }, { status: 400 });
        }

        let archivosSubidos: { name: string; type: string; original_name: string; extension: string }[] = [];
        if (edicion.archivosNuevos.length > 0) {
            let subidos: any;
            try {
                subidos = await uploadDynamicFiles({
                    req,
                    folderPath: `job-manuals/${manualId}`,
                    files: edicion.archivosNuevos.map((f) => ({ type: f.type, extension: f.extension, file_base64: f.file_base64 })),
                    shouldVerifyAccessToken: true,
                });
            } catch (e) {
                // El almacenamiento de archivos (S3) rechazó la subida: no se escribió nada del documento. El detalle real queda en el registro de errores.
                const detalle = e instanceof Error ? e.message : String(e);
                console.error(`Error subiendo archivos de job-manuals/${manualId}:`, detalle);
                await reportError(req, ENDPOINT, "PUT", 502, `No se pudieron subir los archivos al almacenamiento: ${detalle}`);
                return NextResponse.json({ status: false, code: "storage_unavailable", message: "No se pudieron subir los archivos al almacenamiento. No se guardó ningún cambio; inténtalo de nuevo o avisa a soporte." }, { status: 502 });
            }
            const lista: any[] = Array.isArray(subidos?.files) ? subidos.files : [];
            archivosSubidos = lista.map((u, i) => ({ name: u.name, type: u.type, original_name: edicion.archivosNuevos[i]?.original_name || u.original_name || u.name, extension: u.extension }));
            subidosParaLimpiar.push(...archivosSubidos.map((a) => a.name));
        }

        const ahoraIso = (toZonedTime(new Date(), "America/Costa_Rica") as Date).toISOString();
        const dyn = dynDesdeRequest(req);
        const resultado = await aplicarEdicionManual(dyn, manual, edicion, {
            ahoraIso,
            publicadoPor: String(payload?.id ?? ""),
            auditFields: auditUpdateFields(payload) as Record<string, unknown>,
            archivosSubidos,
        });
        subidosParaLimpiar.length = 0; // quedaron registrados: ya no son huérfanos

        if (resultado.sinCambios) {
            return NextResponse.json({ status: true, message: "No hubo cambios", version: resultado.version, version_cambio: false, sin_cambios: true }, { status: 200 });
        }

        // Bitácora (c_cambios_apps_modules): quién, cuándo y qué cambió. Un fallo aquí no deshace la edición ya guardada.
        try {
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: { nombre_tabla: "e_manual_puesto", registro_id: manualId, cambios: JSON.stringify(resultado.cambios), created_at: ahoraIso, created_by: Number(payload?.id ?? 0) },
                },
            });
        } catch (e) {
            await reportError(req, ENDPOINT, "PUT", 500, `No se pudo registrar el cambio en la bitácora: ${e instanceof Error ? e.message : String(e)}`);
        }

        // Nueva versión (o quiz modificado, que siempre la implica): se avisa a los usuarios vinculados para que lo vuelvan a ver y firmar.
        let notificados = { plazas: 0, empleados: 0, ok: true };
        if (resultado.versionCambio) {
            try {
                const msg = mensajeNuevaVersion(String(edicion.title ?? manual.title ?? "documento"), resultado.version, resultado.quizCambio);
                const { puestoIds, empleadoIds } = await destinatariosDelDocumento(dyn, manual);
                const plazaIds = await fetchActivePlazaIdsForPuestos(req, puestoIds);
                if (plazaIds.length > 0) await sendNotificationByPlaza(req, Number(marca!.id), msg.title, msg.description, plazaIds);
                if (empleadoIds.length > 0) await sendNotificationByEmployee(req, Number(marca!.corpo_id ?? 0), [Number(payload?.id ?? 0)], msg.title, msg.description, empleadoIds);
                notificados = { plazas: plazaIds.length, empleados: empleadoIds.length, ok: true };
            } catch (e) {
                // La edición ya quedó guardada: un fallo al avisar no la deshace, pero se informa y queda en el registro de errores.
                notificados = { plazas: 0, empleados: 0, ok: false };
                await reportError(req, ENDPOINT, "PUT", 500, `No se pudo notificar la nueva versión: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: resultado.versionCambio ? `Versión ${resultado.version} publicada` : "Documento actualizado",
                version: resultado.version,
                version_cambio: resultado.versionCambio,
                sin_cambios: false,
                notificados,
            },
            { status: 200 },
        );
    } catch (error: unknown) {
        // Archivos subidos que no llegaron a registrarse: no se dejan huérfanos.
        for (const name of subidosParaLimpiar) {
            try { await deleteDynamicFile({ req, url: `job-manuals/${manualId}/${name}` }); } catch { /* mejor esfuerzo */ }
        }
        if (error instanceof EdicionError) {
            await reportError(req, ENDPOINT, "PUT", error.status, error.message);
            return NextResponse.json({ status: false, code: error.code, message: error.message }, { status: error.status });
        }
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in PUT /${ENDPOINT}:`, errorMessage);
        await reportError(req, ENDPOINT, "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
