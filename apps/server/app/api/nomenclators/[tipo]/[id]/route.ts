import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import {
    isForeignKeyConstraintError,
    mapNomenclatorRow,
    NOMENCLATOR_DELETE_BLOCKED_MESSAGE,
    resolveNomenclatorKind,
    resolveNomenclatorTable,
} from "../../../../../utils/nomenclatorsConfig";
import {
    EJECUTIVO_COORDINADOR_TABLE,
    mapEjecutivoCoordinadorRow,
    parseEjecutivoCoordinadorPayload,
    validateEjecutivoCoordinadorAssignment,
} from "../../../../../utils/nomenclatorsEjecutivoCoordinador";
import {
    assignEmpleadoEjecutivo,
    findEmpleadoEjecutivoById,
    mapEmpleadoEjecutivoRow,
    parseEmpleadoEjecutivoPayload,
    removeEmpleadoEjecutivo,
} from "../../../../../utils/nomenclatorsEmpleadoEjecutivo";
import {
    mapMobileVariableRow,
    parseMobileVariablePayload,
    updateMobileVariable,
} from "../../../../../utils/nomenclatorsMobileVariables";
import {
    articuloCorpoPuestoExists,
    mapTipoMantenimientoArticuloRow,
    parseTipoMantenimientoArticuloPayload,
} from "../../../../../utils/nomenclatorsTipoMantenimientoArticulo";
import { deleteSuperAdmin } from "../../../../../utils/nomenclatorsSuperAdmins";
import { isSuperAdminEmpleado } from "../../../../../utils/isSuperAdminEmpleado";

async function requireCallerSuperAdmin(req: NextRequest, payload: any): Promise<NextResponse | null> {
    const empleadoId = payload?.id != null ? Number(payload.id) : 0;
    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
        return NextResponse.json({ status: false, message: "Usuario no autorizado" }, { status: 403 });
    }
    const ok = await isSuperAdminEmpleado(req, empleadoId);
    if (!ok) {
        return NextResponse.json(
            { status: false, message: "Se requiere rol SUPER_ADMIN para administrar este nomenclador" },
            { status: 403 }
        );
    }
    return null;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ tipo: string; id: string }> }
) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const { tipo, id } = await context.params;
        const table = resolveNomenclatorTable(tipo);
        if (!table) {
            return NextResponse.json(
                { status: false, message: "Tipo de nomenclador no válido" },
                { status: 400 }
            );
        }

        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum) || idNum <= 0) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const kind = resolveNomenclatorKind(tipo);

        if (kind === "empleado-ejecutivo") {
            const row = await findEmpleadoEjecutivoById(req, idNum);
            const mapped = await mapEmpleadoEjecutivoRow(req, row);
            if (!mapped) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }
            return NextResponse.json({ status: true, data: mapped }, { status: 200 });
        }

        const row = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table,
                operation: "findUnique",
                where: { id: idNum },
            },
        });

        if (kind === "ejecutivo-coordinador") {
            const mapped = await mapEjecutivoCoordinadorRow(req, row);
            if (!mapped) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }
            return NextResponse.json({ status: true, data: mapped }, { status: 200 });
        }

        if (kind === "mobile-variable") {
            const mapped = mapMobileVariableRow(row);
            if (!mapped) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }
            return NextResponse.json({ status: true, data: mapped }, { status: 200 });
        }

        if (kind === "tipo-mantenimiento-articulo") {
            const mapped = await mapTipoMantenimientoArticuloRow(req, row);
            if (!mapped) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }
            return NextResponse.json({ status: true, data: mapped }, { status: 200 });
        }

        const mapped = mapNomenclatorRow(row);
        if (!mapped) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ status: true, data: mapped }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in GET /api/nomenclators/[tipo]/[id]:`, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ tipo: string; id: string }> }
) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const { tipo, id } = await context.params;
        const table = resolveNomenclatorTable(tipo);
        if (!table) {
            return NextResponse.json(
                { status: false, message: "Tipo de nomenclador no válido" },
                { status: 400 }
            );
        }

        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum) || idNum <= 0) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const kind = resolveNomenclatorKind(tipo);
        const body = await req.json();

        if (kind === "super-admin") {
            return NextResponse.json(
                { status: false, message: "Los super admins no se editan; elimine y cree de nuevo" },
                { status: 405 }
            );
        }

        if (kind === "empleado-ejecutivo") {
            const planillasToken =
                decodeURIComponent(req.headers.get("Planillas-Token") ?? req.headers.get("planillas-token") ?? "") ||
                null;
            if (!planillasToken) {
                return NextResponse.json(
                    { status: false, message: "Token de Planillas requerido" },
                    { status: 401 }
                );
            }

            const existing = await findEmpleadoEjecutivoById(req, idNum);
            if (!existing) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }

            const payload = parseEmpleadoEjecutivoPayload(body, idNum);
            if (!payload) {
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un ejecutivo de cuenta válido" },
                    { status: 400 }
                );
            }

            const mapped = await assignEmpleadoEjecutivo(
                req,
                payload.empleado_id,
                payload.ejecutivo_cuenta_id,
                planillasToken
            );

            return NextResponse.json(
                { status: true, message: "Relación actualizada correctamente", data: mapped },
                { status: 200 }
            );
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table,
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        if (kind === "ejecutivo-coordinador") {
            const payload = parseEjecutivoCoordinadorPayload(body);
            if (!payload) {
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un ejecutivo de cuenta y un coordinador válidos" },
                    { status: 400 }
                );
            }

            const validation = await validateEjecutivoCoordinadorAssignment(
                req,
                payload.ejecutivo_cuenta_id,
                payload.coordinador_id,
                idNum
            );
            if (!validation.valid) {
                return NextResponse.json(
                    { status: false, message: validation.message },
                    { status: 409 }
                );
            }

            const updated = await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: EJECUTIVO_COORDINADOR_TABLE,
                    operation: "update",
                    where: { id: idNum },
                    data: {
                        ejecutivo_cuenta_id: payload.ejecutivo_cuenta_id,
                        coordinador_id: payload.coordinador_id,
                    },
                },
            });

            const mapped = await mapEjecutivoCoordinadorRow(req, updated);
            if (!mapped) {
                return NextResponse.json(
                    { status: false, message: "No se pudo actualizar el registro" },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { status: true, message: "Registro actualizado correctamente", data: mapped },
                { status: 200 }
            );
        }

        if (kind === "mobile-variable") {
            const payload = parseMobileVariablePayload(body);
            if (!payload) {
                return NextResponse.json(
                    { status: false, message: "Debe indicar un valor para la variable" },
                    { status: 400 }
                );
            }

            try {
                const mapped = await updateMobileVariable(req, idNum, payload.variable_value);
                return NextResponse.json(
                    { status: true, message: "Variable actualizada correctamente", data: mapped },
                    { status: 200 }
                );
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "No se pudo actualizar la variable";
                return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
            }
        }

        if (kind === "tipo-mantenimiento-articulo") {
            const payload = parseTipoMantenimientoArticuloPayload(body);
            if (!payload) {
                return NextResponse.json(
                    { status: false, message: "Debe seleccionar un artículo e indicar un nombre válido" },
                    { status: 400 }
                );
            }

            const exists = await articuloCorpoPuestoExists(req, payload.articulo_id);
            if (!exists) {
                return NextResponse.json(
                    { status: false, message: "El artículo seleccionado no existe" },
                    { status: 400 }
                );
            }

            const updated = await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table,
                    operation: "update",
                    where: { id: idNum },
                    data: {
                        articulo_id: payload.articulo_id,
                        nombre: payload.nombre,
                    },
                },
            });

            const mapped = await mapTipoMantenimientoArticuloRow(req, updated);
            if (!mapped) {
                return NextResponse.json(
                    { status: false, message: "No se pudo actualizar el registro" },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { status: true, message: "Registro actualizado correctamente", data: mapped },
                { status: 200 }
            );
        }

        const nombre = String(body?.nombre ?? "").trim();
        if (!nombre) {
            return NextResponse.json(
                { status: false, message: "El nombre es obligatorio" },
                { status: 400 }
            );
        }

        const updated = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table,
                operation: "update",
                where: { id: idNum },
                data: { nombre },
            },
        });

        const mapped = mapNomenclatorRow(updated);
        if (!mapped) {
            return NextResponse.json(
                { status: false, message: "No se pudo actualizar el registro" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { status: true, message: "Registro actualizado correctamente", data: mapped },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in PUT /api/nomenclators/[tipo]/[id]:`, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ tipo: string; id: string }> }
) {
    try {
        const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const { tipo, id } = await context.params;
        const table = resolveNomenclatorTable(tipo);
        if (!table) {
            return NextResponse.json(
                { status: false, message: "Tipo de nomenclador no válido" },
                { status: 400 }
            );
        }

        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum) || idNum <= 0) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const kind = resolveNomenclatorKind(tipo);

        if (kind === "super-admin") {
            const denied = await requireCallerSuperAdmin(req, payload);
            if (denied) return denied;

            const result = await deleteSuperAdmin(req, idNum);
            if (!result.ok) {
                return NextResponse.json(
                    { status: false, message: result.message },
                    { status: result.status }
                );
            }
            return NextResponse.json(
                { status: true, message: "Super admin eliminado correctamente" },
                { status: 200 }
            );
        }

        if (kind === "empleado-ejecutivo") {
            const planillasToken =
                decodeURIComponent(req.headers.get("Planillas-Token") ?? req.headers.get("planillas-token") ?? "") ||
                null;
            if (!planillasToken) {
                return NextResponse.json(
                    { status: false, message: "Token de Planillas requerido" },
                    { status: 401 }
                );
            }

            const existing = await findEmpleadoEjecutivoById(req, idNum);
            if (!existing) {
                return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
            }

            await removeEmpleadoEjecutivo(req, idNum, planillasToken);
            return NextResponse.json(
                { status: true, message: "Relación eliminada correctamente" },
                { status: 200 }
            );
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table,
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        if (kind === "mobile-variable") {
            return NextResponse.json(
                { status: false, message: "No se pueden eliminar variables del sistema desde esta pantalla" },
                { status: 405 }
            );
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table,
                operation: "delete",
                where: { id: idNum },
            },
        });

        return NextResponse.json(
            { status: true, message: "Registro eliminado correctamente" },
            { status: 200 }
        );
    } catch (error: unknown) {
        if (isForeignKeyConstraintError(error)) {
            return NextResponse.json(
                { status: false, message: NOMENCLATOR_DELETE_BLOCKED_MESSAGE },
                { status: 409 }
            );
        }

        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(`Error in DELETE /api/nomenclators/[tipo]/[id]:`, errorMessage);
        return NextResponse.json(
            { status: false, message: "No se pudo eliminar el registro" },
            { status: 400 }
        );
    }
}
